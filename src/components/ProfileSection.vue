<script setup>
defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: null },
  note: { type: String, default: null },
})
</script>

<template>
  <section class="mt-8 first:mt-0">
    <h2 class="section-label">
      {{ title }}<span v-if="count !== null"> ({{ count }})</span>
    </h2>
    <p v-if="note" class="mt-1 text-[0.8125rem] text-ink-muted">{{ note }}</p>
    <div class="mt-2.5">
      <slot />
    </div>
  </section>
</template>
