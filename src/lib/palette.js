/**
 * Node colours for the hierarchy diagram.
 *
 * The reference profile colours the compound specimen itself green and its
 * parts by material category (Rock purple, Mineral blue). Categories that are
 * not in the fixed list fall back to a stable cycle so that any dataset gets
 * consistent, repeatable colours.
 */

export const ROOT_FILL = '#2f7a4f'

const FIXED = {
  mineral: '#2f7cbf',
  rock: '#8e3b9e',
  ore: '#b06a12',
  fossil: '#0f766e',
  meteorite: '#7c5f3a',
  sediment: '#8a6d1f',
}

const CYCLE = ['#3f5f8a', '#a24b6d', '#4a6f4a', '#7d5aa6', '#a6603a', '#3f7d85']

const assigned = new Map()

/** Fill colour for a tree node. */
export function nodeFill(node) {
  if (node.isRoot) return ROOT_FILL
  return categoryFill(node.materialCategory)
}

/** Fill colour for a material category value (null-safe). */
export function categoryFill(category) {
  if (!category) return '#5b6672'
  const key = String(category).trim().toLowerCase()
  if (FIXED[key]) return FIXED[key]
  if (!assigned.has(key)) assigned.set(key, CYCLE[assigned.size % CYCLE.length])
  return assigned.get(key)
}

/** Legend entries for the categories present in a specimen tree. */
export function legendFor(specimen) {
  const seen = new Map()
  for (const part of specimen.parts) {
    const label = part.materialCategory ?? 'uncategorised'
    if (!seen.has(label)) seen.set(label, categoryFill(part.materialCategory))
  }
  return [
    { label: specimen.isCompound ? 'compound specimen' : 'simple specimen', color: ROOT_FILL },
    ...[...seen].map(([label, color]) => ({ label, color })),
  ]
}
