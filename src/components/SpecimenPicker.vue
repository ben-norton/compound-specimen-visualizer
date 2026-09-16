<script setup>
import { computed } from 'vue'
import { categoryFill } from '@/lib/palette.js'

const props = defineProps({
  specimens: { type: Array, required: true },
  datasetCodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  query: { type: String, default: '' },
  datasetFilter: { type: String, default: '' },
  kindFilter: { type: String, default: 'all' },
})
const emit = defineEmits(['select', 'update:query', 'update:datasetFilter', 'update:kindFilter'])

const filtered = computed(() => {
  const needle = props.query.trim().toLowerCase()
  return props.specimens.filter((specimen) => {
    if (props.datasetFilter && specimen.datasetCode !== props.datasetFilter) return false
    if (props.kindFilter === 'compound' && !specimen.isCompound) return false
    if (props.kindFilter === 'simple' && specimen.isCompound) return false
    if (!needle) return true
    const haystack = [specimen.name, specimen.id, specimen.datasetCode, ...specimen.parts.map((p) => p.name)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
})

defineExpose({ filtered })
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="space-y-2 border-b border-rule p-3">
      <label class="block">
        <span class="sr-only">Search specimens</span>
        <input
          type="search"
          :value="query"
          placeholder="Search name, id or part…"
          class="w-full rounded-[3px] border border-rule bg-canvas px-2.5 py-1.5 text-[0.8125rem] placeholder:text-ink-faint focus:border-accent focus:outline-none"
          @input="emit('update:query', $event.target.value)"
        />
      </label>

      <div class="flex gap-2">
        <label class="flex-1">
          <span class="sr-only">Filter by dataset</span>
          <select
            :value="datasetFilter"
            class="w-full rounded-[3px] border border-rule bg-canvas px-2 py-1.5 text-[0.8125rem] focus:border-accent focus:outline-none"
            @change="emit('update:datasetFilter', $event.target.value)"
          >
            <option value="">All datasets</option>
            <option v-for="code in datasetCodes" :key="code" :value="code">{{ code }}</option>
          </select>
        </label>
        <label class="flex-1">
          <span class="sr-only">Filter by specimen kind</span>
          <select
            :value="kindFilter"
            class="w-full rounded-[3px] border border-rule bg-canvas px-2 py-1.5 text-[0.8125rem] focus:border-accent focus:outline-none"
            @change="emit('update:kindFilter', $event.target.value)"
          >
            <option value="all">All specimens</option>
            <option value="compound">Compound only</option>
            <option value="simple">Simple only</option>
          </select>
        </label>
      </div>

      <p class="text-[0.75rem] text-ink-muted">
        {{ filtered.length }} of {{ specimens.length }} specimen{{ specimens.length === 1 ? '' : 's' }}
      </p>
    </div>

    <ul class="min-h-0 flex-1 overflow-y-auto">
      <li v-for="specimen in filtered" :key="specimen.id">
        <button
          type="button"
          class="flex w-full items-start gap-2 border-b border-rule px-3 py-2 text-left transition-colors hover:bg-surface"
          :class="selectedId === specimen.id ? 'bg-surface' : ''"
          :aria-current="selectedId === specimen.id ? 'true' : undefined"
          @click="emit('select', specimen.id)"
        >
          <span
            class="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-[1px]"
            :style="{ backgroundColor: categoryFill(specimen.materialCategory) }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[0.8125rem] font-medium leading-snug">
              {{ specimen.name }}
            </span>
            <span class="mt-0.5 block font-mono text-[0.6875rem] text-ink-muted">
              cat. {{ specimen.id }}
              <template v-if="specimen.datasetCode"> · {{ specimen.datasetCode }}</template>
            </span>
          </span>
          <span
            class="mt-0.5 shrink-0 rounded-[2px] px-1.5 py-0.5 text-[0.6875rem] font-medium"
            :class="specimen.isCompound ? 'bg-accent/10 text-accent' : 'bg-rule text-ink-muted'"
          >
            {{ specimen.isCompound ? specimen.partCount : 'simple' }}
          </span>
        </button>
      </li>
      <li v-if="!filtered.length" class="px-3 py-6 text-center text-[0.8125rem] text-ink-muted">
        No specimen matches these filters.
      </li>
    </ul>
  </div>
</template>
