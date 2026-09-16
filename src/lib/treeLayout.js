import { hierarchy, linkHorizontal, linkVertical, tree as d3Tree } from 'd3'
import { nodeFill } from './palette.js'

/**
 * Lay out a specimen tree with d3-hierarchy and return plain data that Vue can
 * render declaratively. d3 owns the maths (tidy tree layout, link curves);
 * Vue owns the DOM.
 */

const NODE_WIDTH = 186
const NODE_WIDTH_NARROW = 168
const LINE_HEIGHT = 14
const PADDING_Y = 11
const MAX_LINES = 3
const SIBLING_GAP = 26
const LEVEL_GAP = 52

let measureContext = null

/** Measure a string in the node font, using a cached offscreen canvas. */
function measure(text) {
  if (typeof document === 'undefined') return text.length * 5.8
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d')
    measureContext.font = '500 11.5px Roboto, Helvetica, Arial, sans-serif'
  }
  return measureContext.measureText(text).width
}

/** Greedy word wrap into at most MAX_LINES lines, ellipsising the overflow. */
function wrap(text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
      if (lines.length === MAX_LINES) break
    }
  }
  if (lines.length < MAX_LINES && current) lines.push(current)

  if (lines.length === MAX_LINES) {
    // If anything was left over, mark the final line as truncated.
    const rendered = lines.join(' ')
    if (rendered.replace(/\s+/g, ' ') !== String(text).replace(/\s+/g, ' ').trim()) {
      let last = lines[MAX_LINES - 1]
      while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
      lines[MAX_LINES - 1] = `${last}…`
    }
  }
  return lines.length ? lines : ['—']
}

/**
 * @param {object} root specimen root node from specimens.js
 * @param {{ orientation?: 'vertical'|'horizontal' }} [options]
 */
export function layoutTree(root, { orientation = 'vertical' } = {}) {
  const vertical = orientation === 'vertical'
  const nodeWidth = vertical ? NODE_WIDTH : NODE_WIDTH_NARROW

  const h = hierarchy(root, (d) => d.children)

  // Wrap every label first so all boxes can share one height and stay aligned.
  let maxLines = 1
  h.each((d) => {
    d.lines = wrap(d.data.label, nodeWidth - 20)
    maxLines = Math.max(maxLines, d.lines.length)
  })
  const nodeHeight = maxLines * LINE_HEIGHT + PADDING_Y * 2

  const layout = vertical
    ? d3Tree().nodeSize([nodeWidth + SIBLING_GAP, nodeHeight + LEVEL_GAP])
    : d3Tree().nodeSize([nodeHeight + 18, nodeWidth + LEVEL_GAP + 14])
  layout.separation(() => 1)
  layout(h)

  const nodes = h.descendants().map((d) => {
    // d3.tree() works in (x = breadth, y = depth); swap for a horizontal tree.
    const x = vertical ? d.x : d.y
    const y = vertical ? d.y : d.x
    return {
      id: d.data.key,
      data: d.data,
      lines: d.lines,
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
      fill: nodeFill(d.data),
      depth: d.depth,
    }
  })

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const linkPath = vertical ? linkVertical() : linkHorizontal()
  const links = h
    .links()
    .map(({ source, target }) => {
      const s = byId.get(source.data.key)
      const t = byId.get(target.data.key)
      if (!s || !t) return null
      const endpoints = vertical
        ? {
            source: [s.x, s.y + nodeHeight / 2],
            target: [t.x, t.y - nodeHeight / 2 - 7],
          }
        : {
            source: [s.x + nodeWidth / 2, s.y],
            target: [t.x - nodeWidth / 2 - 7, t.y],
          }
      return { id: `${s.id}->${t.id}`, d: linkPath(endpoints) }
    })
    .filter(Boolean)

  const bounds = nodes.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.x - n.width / 2),
      maxX: Math.max(acc.maxX, n.x + n.width / 2),
      minY: Math.min(acc.minY, n.y - n.height / 2),
      maxY: Math.max(acc.maxY, n.y + n.height / 2),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  )

  return {
    nodes,
    links,
    bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    lineHeight: LINE_HEIGHT,
    orientation,
  }
}
