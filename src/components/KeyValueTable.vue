<script setup>
defineProps({
  /** @type {{ key: string, value: string|null }[]} */
  entries: { type: Array, required: true },
})
</script>

<template>
  <div class="card overflow-x-auto">
    <table class="profile-table">
      <tbody>
        <tr v-for="entry in entries" :key="entry.key">
          <th scope="row" class="w-52 bg-surface font-medium text-ink-muted">{{ entry.key }}</th>
          <td class="break-words">
            <span v-if="entry.value">{{ entry.value }}</span>
            <span v-else class="text-ink-faint">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
