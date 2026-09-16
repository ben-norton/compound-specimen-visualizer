import { csvParse } from 'd3'
import { REQUIRED_FIELDS, resolveSchema } from './schema.js'

/**
 * Turn a flat compound-specimen import table into specimen hierarchies.
 *
 * Structural rules come straight from
 * docs/specifications/compound_specimens_specification.md:
 *
 *   - a record with `is_part_of` set is a *specimen part*;
 *   - a record with an `id` and no `is_part_of` is a top level specimen;
 *   - a top level specimen whose `id` appears in the `is_part_of` column is a
 *     *compound specimen*, otherwise it is a *simple specimen*;
 *   - the compound specimen carries its name in `cataloged_name`, a part
 *     carries its name in `authoritative_name`.
 *
 * The self join is `id = is_part_of`, so nesting is not limited to two levels:
 * a part that also carries an `id` may itself be the parent of further parts.
 */

const blank = (value) => value === null || value === undefined || String(value).trim() === ''
const clean = (value) => (blank(value) ? null : String(value).trim())

/** Read a canonical field off a raw CSV row. */
function readField(row, fieldToColumn, field) {
  const column = fieldToColumn[field]
  return column ? clean(row[column]) : null
}

/**
 * Parse CSV text into the application's dataset model.
 *
 * @param {string} text raw CSV text
 * @param {string} [sourceName] label shown in the UI for this file
 */
export function parseDataset(text, sourceName = 'dataset') {
  const rows = csvParse(text)
  const columns = rows.columns ?? []
  const { fieldToColumn, coreColumns, extraColumns } = resolveSchema(columns)

  const missing = REQUIRED_FIELDS.filter((field) => !fieldToColumn[field])
  if (missing.length) {
    throw new Error(
      `${sourceName}: missing required column(s) ${missing.join(', ')}. ` +
        `A compound specimen dataset needs at least an identifier column and a self-join column.`,
    )
  }

  const records = rows.map((row, index) => ({
    rowNumber: index + 2, // +1 for the header, +1 because humans count from one
    raw: row,
    id: readField(row, fieldToColumn, 'id'),
    isPartOf: readField(row, fieldToColumn, 'is_part_of'),
    materialCategory: readField(row, fieldToColumn, 'material_category'),
    materialSubcategory: readField(row, fieldToColumn, 'material_subcategory'),
    catalogedName: readField(row, fieldToColumn, 'cataloged_name'),
    authoritativeName: readField(row, fieldToColumn, 'authoritative_name'),
    verbatimName: readField(row, fieldToColumn, 'verbatim_name'),
    datasetCode: readField(row, fieldToColumn, 'dataset_code'),
  }))

  const childrenByParent = new Map()
  const recordsById = new Map()
  const orphanParentIds = new Set()

  for (const record of records) {
    if (record.id && !recordsById.has(record.id)) recordsById.set(record.id, record)
  }
  for (const record of records) {
    if (!record.isPartOf) continue
    if (!childrenByParent.has(record.isPartOf)) childrenByParent.set(record.isPartOf, [])
    childrenByParent.get(record.isPartOf).push(record)
    if (!recordsById.has(record.isPartOf)) orphanParentIds.add(record.isPartOf)
  }

  const topLevel = records.filter((record) => record.id && !record.isPartOf)
  const specimens = topLevel.map((record) => buildSpecimen(record, childrenByParent, extraColumns))

  const datasetCodes = [...new Set(records.map((r) => r.datasetCode).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )

  return {
    sourceName,
    columns,
    coreColumns,
    extraColumns,
    fieldToColumn,
    records,
    specimens,
    datasetCodes,
    warnings: buildWarnings(records, orphanParentIds),
  }
}

function buildWarnings(records, orphanParentIds) {
  const warnings = []
  if (orphanParentIds.size) {
    warnings.push(
      `${orphanParentIds.size} part record(s) reference a parent id that is not present in the file ` +
        `(${[...orphanParentIds].slice(0, 5).join(', ')}${orphanParentIds.size > 5 ? ', …' : ''}).`,
    )
  }
  const unusable = records.filter((record) => !record.id && !record.isPartOf).length
  if (unusable) {
    warnings.push(`${unusable} row(s) have neither an id nor an is_part_of value and were skipped.`)
  }
  return warnings
}

/** Build one specimen (root record + nested part tree). */
function buildSpecimen(record, childrenByParent, extraColumns) {
  const catalogNumber = record.id
  let partCount = 0
  let maxDepth = 0

  const visit = (current, depth, visited) => {
    maxDepth = Math.max(maxDepth, depth)
    const node = {
      key: `${current.rowNumber}`,
      record: current,
      depth,
      isRoot: depth === 0,
      name: nodeName(current, depth === 0),
      materialCategory: current.materialCategory,
      materialSubcategory: current.materialSubcategory,
      catalogNumber,
      label: nodeLabel(current, depth === 0, catalogNumber),
      extras: extraValues(current, extraColumns),
      children: [],
    }

    // A part row may itself carry an id, which lets the self join nest further.
    const childRecords = current.id && !visited.has(current.id) ? (childrenByParent.get(current.id) ?? []) : []
    const nextVisited = current.id ? new Set([...visited, current.id]) : visited

    for (const child of childRecords) {
      partCount += 1
      node.children.push(visit(child, depth + 1, nextVisited))
    }
    return node
  }

  const root = visit(record, 0, new Set())

  return {
    id: record.id,
    catalogNumber,
    record,
    root,
    name: root.name,
    materialCategory: record.materialCategory,
    datasetCode: record.datasetCode,
    partCount,
    depth: maxDepth,
    isCompound: partCount > 0,
    parts: flattenParts(root),
    extras: root.extras,
  }
}

/**
 * Preferred display name. The specification puts a compound specimen's name in
 * `cataloged_name` and a part's name in `authoritative_name`; the remaining
 * name fields are fallbacks for datasets that only populate one of them.
 */
function nodeName(record, isRoot) {
  const order = isRoot
    ? [record.catalogedName, record.authoritativeName, record.verbatimName]
    : [record.authoritativeName, record.catalogedName, record.verbatimName]
  return order.find((value) => !blank(value)) ?? (isRoot ? (record.id ?? 'Unnamed specimen') : 'Unnamed part')
}

/** Label drawn inside a tree node, e.g. `Grossular — Mineral · cat. 48159`. */
function nodeLabel(record, isRoot, catalogNumber) {
  const name = nodeName(record, isRoot)
  const category = record.materialCategory
  const head = isRoot || !category ? name : `${name} — ${category}`
  return catalogNumber ? `${head} · cat. ${catalogNumber}` : head
}

function extraValues(record, extraColumns) {
  return extraColumns
    .map((column) => ({ column, value: clean(record.raw[column]) }))
    .filter((entry) => entry.value !== null)
}

function flattenParts(root) {
  const out = []
  const walk = (node, parent) => {
    if (!node.isRoot) out.push({ ...node, parentLabel: parent ? parent.label : null, parent })
    for (const child of node.children) walk(child, node)
  }
  walk(root, null)
  return out
}

/** Count nodes in a specimen tree, root included. */
export function countNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
}
