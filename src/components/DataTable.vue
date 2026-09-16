<script setup>
defineProps({
  /** @type {{ key: string, label: string, mono?: boolean, swatch?: boolean }[]} */
  columns: { type: Array, required: true },
  /** Row objects keyed by column key, plus an optional `_key` used for selection. */
  rows: { type: Array, required: true },
  selectedKey: { type: String, default: null },
  empty: { type: String, default: 'No records.' },
})
defineEmits(['select'])
</script>

<template>
  <div class="card overflow-x-auto">
    <table v-if="rows.length" class="profile-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="row._key ?? index"
          :class="[
            row._key ? 'cursor-pointer' : '',
            selectedKey && row._key === selectedKey ? 'bg-amber-50' : '',
          ]"
          @click="row._key && $emit('select', row._key)"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            :class="column.mono ? 'font-mono text-[0.75rem] text-ink-muted' : ''"
          >
            <span v-if="column.swatch && row[column.key]" class="inline-flex items-center gap-1.5">
              <span
                class="inline-block h-2 w-2 shrink-0 rounded-[1px]"
                :style="{ backgroundColor: row._swatch }"
                aria-hidden="true"
              />
              {{ row[column.key] }}
            </span>
            <span v-else-if="row[column.key]">{{ row[column.key] }}</span>
            <span v-else class="text-ink-faint">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="px-3 py-4 text-[0.8125rem] text-ink-muted">{{ empty }}</p>
  </div>
</template>
