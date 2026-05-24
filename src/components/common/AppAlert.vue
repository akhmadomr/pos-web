<script setup>
defineProps({
  type: {
    type: String,
    default: 'info',
  },
  message: {
    type: String,
    required: true,
  },
  dismissible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['dismiss'])

const typeClass = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium" :class="typeClass[type]">
    <i
      :class="[
        'pi mt-0.5',
        type === 'error'
          ? 'pi-times-circle'
          : type === 'success'
            ? 'pi-check-circle'
            : type === 'warning'
              ? 'pi-exclamation-triangle'
              : 'pi-info-circle',
      ]"
    />
    <p class="flex-1">{{ message }}</p>
    <button
      v-if="dismissible"
      type="button"
      class="rounded-lg p-1 opacity-70 hover:opacity-100"
      @click="emit('dismiss')"
    >
      <i class="pi pi-times" />
    </button>
  </div>
</template>
