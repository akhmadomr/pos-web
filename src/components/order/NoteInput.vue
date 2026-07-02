<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: 'Tambahkan catatan pesanan (opsional)...',
  },
})

const emit = defineEmits(['update:modelValue'])

const internalValue = ref(props.modelValue)

watch(internalValue, (val) => {
  emit('update:modelValue', val)
})

watch(() => props.modelValue, (val) => {
  internalValue.value = val
})
</script>

<template>
  <div class="w-full">
    <textarea
      v-model="internalValue"
      rows="2"
      :placeholder="placeholder"
      class="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-merchant-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
    />
  </div>
</template>
