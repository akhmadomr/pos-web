<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: 'button',
  },
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
    :class="[
      variant === 'primary'
        ? 'bg-merchant-primary text-white shadow-lg shadow-merchant-primary/30 hover:bg-merchant-primary/90'
        : variant === 'danger'
          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ]"
  >
    <i v-if="loading" class="pi pi-spin pi-spinner" />
    <slot />
  </button>
</template>
