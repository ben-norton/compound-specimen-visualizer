<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { select, zoom as d3Zoom, zoomIdentity } from 'd3'
import { layoutTree } from '@/lib/treeLayout.js'

const props = defineProps({
  specimen: { type: Object, required: true },
  selectedKey: { type: String, default: null },
})
const emit = defineEmits(['select'])

const container = ref(null)
const svgEl = ref(null)
const containerWidth = ref(960)
const transform = shallowRef(zoomIdentity)
const orientationOverride = ref(null)

const PADDING = 28
const MAX_HEIGHT = 620
const MIN_HEIGHT = 150
const FLIP_SCALE = 0.62
// Below this scale labels stop being readable, so the diagram is allowed to
// overflow its container and scroll sideways instead of shrinking further.
const MIN_SCALE = 0.8

/** Scale at which a layout would be drawn to fit the available box. */
function fitScale(candidate) {
  const available = Math.max(containerWidth.value - PADDING * 2, 120)
  return Math.min(
    1,
    available / Math.max(candidate.width, 1),
    MAX_HEIGHT / Math.max(candidate.height, 1),
  )
}

/**
 * Narrow viewports, and wide fan-outs that would otherwise be shrunk until the
 * labels are unreadable, get a left-to-right tree instead of a top-down one.
 */
const autoOrientation = computed(() => {
  if (containerWidth.value < 720) return 'horizontal'
  const vertical = layoutTree(props.specimen.root, { orientation: 'vertical' })
  return fitScale(vertical) < FLIP_SCALE ? 'horizontal' : 'vertical'
})

const orientation = computed(() => orientationOverride.value ?? autoOrientation.value)

const layout = computed(() => layoutTree(props.specimen.root, { orientation: orientation.value }))

const scale = computed(() => Math.max(fitScale(layout.value), MIN_SCALE))

const svgWidth = computed(() =>
  Math.max(containerWidth.value, layout.value.width * scale.value + PADDING * 2),
)

/** Scale/translate that fits the whole tree in the available box. */
const baseTransform = computed(() => {
  const { bounds, width } = layout.value
  const k = scale.value
  // A top-down tree reads best centred; a left-to-right one reads best flush left.
  const offsetX = orientation.value === 'vertical' ? (svgWidth.value - width * k) / 2 : PADDING
  const tx = offsetX - bounds.minX * k
  const ty = PADDING - bounds.minY * k
  return zoomIdentity.translate(tx, ty).scale(k)
})

const svgHeight = computed(() =>
  Math.min(
    MAX_HEIGHT + PADDING * 2,
    Math.max(MIN_HEIGHT, layout.value.height * scale.value + PADDING * 2),
  ),
)

const transformString = computed(() => transform.value.toString())

let zoomBehavior = null
let resizeObserver = null

function resetView() {
  if (!zoomBehavior || !svgEl.value) return
  select(svgEl.value).call(zoomBehavior.transform, baseTransform.value)
}

function zoomBy(factor) {
  if (!zoomBehavior || !svgEl.value) return
  select(svgEl.value).transition().duration(180).call(zoomBehavior.scaleBy, factor)
}

onMounted(() => {
  zoomBehavior = d3Zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => {
      transform.value = event.transform
    })
  select(svgEl.value).call(zoomBehavior).on('dblclick.zoom', null)

  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width
    if (width) containerWidth.value = width
  })
  resizeObserver.observe(container.value)
  containerWidth.value = container.value.clientWidth || containerWidth.value
  resetView()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// Refit whenever the tree or the available width changes.
watch([() => props.specimen, baseTransform], resetView, { flush: 'post' })
</script>

<template>
  <figure ref="container" class="relative w-full">
    <figcaption class="sr-only">
      Hierarchy of specimen {{ specimen.name }} and its {{ specimen.partCount }} part records
    </figcaption>

    <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
      <button
        type="button"
        class="tree-btn"
        :aria-pressed="orientation === 'horizontal'"
        title="Toggle tree orientation"
        @click="orientationOverride = orientation === 'vertical' ? 'horizontal' : 'vertical'"
      >
        {{ orientation === 'vertical' ? '↧' : '↦' }}
      </button>
      <button type="button" class="tree-btn" title="Zoom out" @click="zoomBy(1 / 1.3)">−</button>
      <button type="button" class="tree-btn" title="Zoom in" @click="zoomBy(1.3)">+</button>
      <button type="button" class="tree-btn tree-btn--wide" title="Fit to view" @click="resetView">
        fit
      </button>
    </div>

    <div class="overflow-x-auto">
      <svg
        ref="svgEl"
        class="block cursor-grab touch-none active:cursor-grabbing"
        :width="svgWidth"
        :height="svgHeight"
        role="img"
        :aria-label="`Specimen hierarchy for ${specimen.name}`"
      >
        <defs>
          <marker
            id="specimen-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>

        <g :transform="transformString">
          <path
            v-for="link in layout.links"
            :key="link.id"
            :d="link.d"
            fill="none"
            stroke="#64748b"
            stroke-width="1.25"
            marker-end="url(#specimen-arrow)"
          />

          <g
            v-for="node in layout.nodes"
            :key="node.id"
            :transform="`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`"
            class="cursor-pointer"
            tabindex="0"
            role="button"
            :aria-label="node.data.label"
            @click="emit('select', node.data.key)"
            @keydown.enter.prevent="emit('select', node.data.key)"
            @keydown.space.prevent="emit('select', node.data.key)"
          >
            <rect
              :width="node.width"
              :height="node.height"
              rx="3"
              :fill="node.fill"
              :stroke="selectedKey === node.data.key ? '#0f172a' : 'transparent'"
              stroke-width="2"
            />
            <text
              :x="node.width / 2"
              :y="node.height / 2 - ((node.lines.length - 1) * layout.lineHeight) / 2 + 4"
              text-anchor="middle"
              fill="#ffffff"
              font-size="11.5"
              font-weight="500"
              class="pointer-events-none select-none"
            >
              <tspan
                v-for="(line, index) in node.lines"
                :key="index"
                :x="node.width / 2"
                :dy="index === 0 ? 0 : layout.lineHeight"
              >
                {{ line }}
              </tspan>
            </text>
            <title>{{ node.data.label }}</title>
          </g>
        </g>
      </svg>
    </div>
  </figure>
</template>

<style scoped>
.tree-btn {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-rule);
  border-radius: 3px;
  background-color: rgb(255 255 255 / 0.9);
  font-size: 0.8125rem;
  line-height: 1;
  color: var(--color-ink-muted);
  transition: all 0.12s ease;
}
.tree-btn:hover {
  background-color: #fff;
  color: var(--color-ink);
  border-color: var(--color-ink-muted);
}
.tree-btn--wide {
  width: auto;
  padding-inline: 0.5rem;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
