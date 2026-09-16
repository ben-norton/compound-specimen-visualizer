<script setup>
import { computed, ref, watch } from 'vue'
import DataTable from './DataTable.vue'
import KeyValueTable from './KeyValueTable.vue'
import ProfileSection from './ProfileSection.vue'
import SpecimenTree from './SpecimenTree.vue'
import { legendFor, nodeFill } from '@/lib/palette.js'

const props = defineProps({
  specimen: { type: Object, required: true },
  coreColumns: { type: Array, required: true },
  extraColumns: { type: Array, required: true },
})

const selectedKey = ref(null)
watch(
  () => props.specimen.id,
  () => {
    selectedKey.value = null
  },
)

const subtitle = computed(() => {
  const parts = []
  if (props.specimen.datasetCode) parts.push(`Dataset: ${props.specimen.datasetCode}`)
  parts.push(`${props.specimen.partCount} part record(s)`)
  if (props.specimen.depth > 1) parts.push(`${props.specimen.depth} levels deep`)
  return parts.join(' · ')
})

const legend = computed(() => legendFor(props.specimen))

/** The root record, shown field by field exactly as it appears in the file. */
const parentEntries = computed(() =>
  props.coreColumns.map((column) => ({
    key: column,
    value: props.specimen.record.raw[column]?.trim() || null,
  })),
)

const partColumns = [
  { key: 'part', label: 'part' },
  { key: 'category', label: 'material category', swatch: true },
  { key: 'subcategory', label: 'material subcategory' },
  { key: 'id', label: 'id', mono: true },
  { key: 'parent', label: 'parent', mono: true },
]

const partRows = computed(() =>
  props.specimen.parts.map((part) => ({
    _key: part.key,
    _swatch: nodeFill(part),
    part: part.label,
    category: part.materialCategory,
    subcategory: part.materialSubcategory,
    id: part.record.id,
    parent: part.record.isPartOf,
  })),
)

/** Every column that is not part of the compound specimen minimum schema. */
const extraTableColumns = computed(() => [
  { key: '_record', label: 'record' },
  ...props.extraColumns.map((column) => ({ key: column, label: column })),
])

const extraRows = computed(() => {
  if (!props.extraColumns.length) return []
  const nodes = [props.specimen.root, ...props.specimen.parts]
  return nodes
    .filter((node) => node.extras.length)
    .map((node) => {
      const row = { _key: node.key, _record: node.label }
      for (const { column, value } of node.extras) row[column] = value
      return row
    })
})
</script>

<template>
  <article>
    <header class="border-b border-rule pb-4">
      <h1 class="font-serif text-[1.6rem] font-semibold leading-tight tracking-tight">
        {{ specimen.name }}
        <span class="text-ink-muted">· cat. {{ specimen.id }}</span>
      </h1>
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-muted">
        <span>{{ subtitle }}</span>
        <span
          class="rounded-[2px] px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide"
          :class="specimen.isCompound ? 'bg-accent/10 text-accent' : 'bg-rule text-ink-muted'"
        >
          {{ specimen.isCompound ? 'compound specimen' : 'simple specimen' }}
        </span>
      </p>
    </header>

    <ProfileSection title="Specimen hierarchy">
      <div class="card px-2 py-1">
        <SpecimenTree
          :specimen="specimen"
          :selected-key="selectedKey"
          @select="selectedKey = selectedKey === $event ? null : $event"
        />
      </div>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <li v-for="item in legend" :key="item.label" class="flex items-center gap-1.5 text-[0.75rem] text-ink-muted">
          <span class="inline-block h-2 w-2 rounded-[1px]" :style="{ backgroundColor: item.color }" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
    </ProfileSection>

    <ProfileSection title="Parent specimen record">
      <KeyValueTable :entries="parentEntries" />
    </ProfileSection>

    <ProfileSection title="Parts" :count="specimen.partCount">
      <DataTable
        :columns="partColumns"
        :rows="partRows"
        :selected-key="selectedKey"
        empty="This record has no part records, so it is a simple specimen."
        @select="selectedKey = selectedKey === $event ? null : $event"
      />
    </ProfileSection>

    <ProfileSection
      title="Additional attributes"
      :count="extraColumns.length"
      :note="
        extraColumns.length
          ? 'Columns beyond the compound specimen minimum schema, shown per record.'
          : null
      "
    >
      <DataTable
        :columns="extraTableColumns"
        :rows="extraRows"
        :selected-key="selectedKey"
        empty="This dataset contains only the minimum columns needed to build the hierarchy — there are no additional attributes to show."
        @select="selectedKey = selectedKey === $event ? null : $event"
      />
    </ProfileSection>
  </article>
</template>
