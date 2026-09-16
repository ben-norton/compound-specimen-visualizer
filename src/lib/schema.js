/**
 * Canonical schema for compound specimen import datasets.
 *
 * The dataset under /data represents the *minimum* information needed to draw a
 * specimen hierarchy. Every canonical field below maps to one column in the
 * source CSV; a small alias list keeps the app working against exports that use
 * a slightly different header spelling. Any column that is not claimed by a
 * canonical field is treated as an "additional attribute" and rendered in the
 * table below the tree.
 */

/** Canonical field name -> accepted column headers, in order of preference. */
export const FIELD_ALIASES = {
  id: ['id', 'specimen_id', 'material_entity_id', 'occurrence_id'],
  is_part_of: ['is_part_of', 'ispartof', 'parent_id', 'part_of'],
  material_category: ['material_category', 'materialcategory'],
  material_subcategory: ['material_subcategory', 'materialsubcategory'],
  cataloged_name: ['cataloged_name', 'catalogedname', 'catalogued_name'],
  authoritative_name: ['authoritative_name', 'authoritativename'],
  verbatim_name: ['verbatim_name', 'verbatimname'],
  dataset_code: ['dataset_code', 'datasetcode', 'dataset_name', 'dataset'],
}

/** The two fields that are structurally required to build a hierarchy. */
export const REQUIRED_FIELDS = ['id', 'is_part_of']

/** Human readable labels used in the record tables. */
export const FIELD_LABELS = {
  id: 'id',
  is_part_of: 'is_part_of',
  material_category: 'material_category',
  material_subcategory: 'material_subcategory',
  cataloged_name: 'cataloged_name',
  authoritative_name: 'authoritative_name',
  verbatim_name: 'verbatim_name',
  dataset_code: 'dataset_code',
}

const normalizeHeader = (header) => String(header).trim().toLowerCase().replace(/[\s-]+/g, '_')

/**
 * Resolve canonical field names against the headers actually present in a file.
 *
 * @param {string[]} columns raw header row
 * @returns {{ fieldToColumn: Record<string,string>, coreColumns: string[], extraColumns: string[] }}
 */
export function resolveSchema(columns) {
  const byNormalized = new Map()
  for (const column of columns) {
    const key = normalizeHeader(column)
    if (!byNormalized.has(key)) byNormalized.set(key, column)
  }

  const fieldToColumn = {}
  const claimed = new Set()

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const column = byNormalized.get(alias)
      if (column && !claimed.has(column)) {
        fieldToColumn[field] = column
        claimed.add(column)
        break
      }
    }
  }

  return {
    fieldToColumn,
    coreColumns: columns.filter((column) => claimed.has(column)),
    extraColumns: columns.filter((column) => !claimed.has(column)),
  }
}
