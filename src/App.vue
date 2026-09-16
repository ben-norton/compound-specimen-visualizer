<script setup>
import { computed, ref, watch } from 'vue'
import SpecimenPicker from './components/SpecimenPicker.vue'
import SpecimenProfile from './components/SpecimenProfile.vue'
import { parseDataset } from '@/lib/specimens.js'

/**
 * Every CSV under /data is bundled at build time, so dropping another export in
 * that directory is all it takes to make it selectable here. Any other file can
 * be loaded at runtime with the file picker.
 */
const bundled = import.meta.glob('../data/*.csv', { query: '?raw', import: 'default', eager: true })

const sources = ref(
  Object.entries(bundled).map(([path, text]) => ({
    name: path.replace(/^.*\//, ''),
    text,
  })),
)

const activeSourceName = ref(sources.value[0]?.name ?? null)
const parseError = ref(null)
const selectedId = ref(null)
const query = ref('')
const datasetFilter = ref('')
const kindFilter = ref('all')
const pickerOpen = ref(false)

const dataset = computed(() => {
  const source = sources.value.find((entry) => entry.name === activeSourceName.value)
  if (!source) return null
  try {
    const parsed = parseDataset(source.text, source.name)
    parseError.value = null
    return parsed
  } catch (error) {
    parseError.value = error.message
    return null
  }
})

const specimens = computed(() => dataset.value?.specimens ?? [])

const selected = computed(
  () => specimens.value.find((specimen) => specimen.id === selectedId.value) ?? null,
)

// Default to the first compound specimen whenever the visible set changes.
watch(
  [specimens, datasetFilter, kindFilter],
  () => {
    const visible = specimens.value.filter(
      (specimen) => !datasetFilter.value || specimen.datasetCode === datasetFilter.value,
    )
    if (selected.value && visible.includes(selected.value)) return
    selectedId.value = (visible.find((s) => s.isCompound) ?? visible[0])?.id ?? null
  },
  { immediate: true },
)

const stats = computed(() => {
  const all = specimens.value
  return {
    total: all.length,
    compound: all.filter((s) => s.isCompound).length,
    parts: all.reduce((sum, s) => sum + s.partCount, 0),
    rows: dataset.value?.records.length ?? 0,
  }
})

async function onFileChosen(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const text = await file.text()
  const existing = sources.value.findIndex((entry) => entry.name === file.name)
  if (existing >= 0) sources.value.splice(existing, 1, { name: file.name, text })
  else sources.value.push({ name: file.name, text })
  activeSourceName.value = file.name
  event.target.value = ''
}

function selectSpecimen(id) {
  selectedId.value = id
  pickerOpen.value = false
}
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-20 border-b border-rule bg-canvas/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div class="mr-auto min-w-0">
          <h1 class="truncate font-serif text-[1.0625rem] font-semibold tracking-tight">
            Compound Specimen Visualizer
          </h1>
          <p class="truncate text-[0.75rem] text-ink-muted">
            {{ stats.rows }} rows · {{ stats.total }} specimens · {{ stats.compound }} compound ·
            {{ stats.parts }} parts
          </p>
        </div>

        <label class="text-[0.8125rem]">
          <span class="sr-only">Dataset file</span>
          <select
            v-model="activeSourceName"
            class="rounded-[3px] border border-rule bg-canvas px-2 py-1.5 text-[0.8125rem] focus:border-accent focus:outline-none"
          >
            <option v-for="source in sources" :key="source.name" :value="source.name">
              {{ source.name }}
            </option>
          </select>
        </label>

        <label
          class="cursor-pointer rounded-[3px] border border-rule px-2.5 py-1.5 text-[0.8125rem] text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
        >
          Load CSV…
          <input type="file" accept=".csv,text/csv" class="sr-only" @change="onFileChosen" />
        </label>

        <button
          type="button"
          class="rounded-[3px] border border-rule px-2.5 py-1.5 text-[0.8125rem] text-ink-muted lg:hidden"
          :aria-expanded="pickerOpen"
          @click="pickerOpen = !pickerOpen"
        >
          {{ pickerOpen ? 'Close list' : 'Specimens' }}
        </button>
      </div>

      <p v-if="parseError" class="border-t border-red-200 bg-red-50 px-4 py-2 text-[0.8125rem] text-red-800 sm:px-6">
        {{ parseError }}
      </p>
      <p
        v-for="warning in dataset?.warnings ?? []"
        :key="warning"
        class="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[0.8125rem] text-amber-900 sm:px-6"
      >
        {{ warning }}
      </p>
    </header>

    <div class="mx-auto flex max-w-[1400px] flex-col lg:flex-row">
      <aside
        class="border-b border-rule bg-canvas lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100vh-var(--header-h))] lg:w-[310px] lg:shrink-0 lg:border-b-0 lg:border-r"
        :class="pickerOpen ? 'block' : 'hidden lg:block'"
      >
        <div class="max-h-[60vh] lg:h-full lg:max-h-none">
          <SpecimenPicker
            :specimens="specimens"
            :dataset-codes="dataset?.datasetCodes ?? []"
            :selected-id="selectedId"
            :query="query"
            :dataset-filter="datasetFilter"
            :kind-filter="kindFilter"
            @update:query="query = $event"
            @update:datasetFilter="datasetFilter = $event"
            @update:kindFilter="kindFilter = $event"
            @select="selectSpecimen"
          />
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <SpecimenProfile
          v-if="selected && dataset"
          :key="selected.id"
          :specimen="selected"
          :core-columns="dataset.coreColumns"
          :extra-columns="dataset.extraColumns"
        />
        <p v-else class="py-16 text-center text-[0.875rem] text-ink-muted">
          {{ parseError ? 'Fix the dataset above to continue.' : 'Select a specimen to view its profile.' }}
        </p>
      </main>
    </div>
  </div>
</template>
