<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'Ketik atau pilih...',
  },
  allowCreate: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'select-existing', 'create-new'])

const inputValue = ref('')
const showDropdown = ref(false)

const normalizedOptions = computed(() =>
  props.options.map((option) =>
    typeof option === 'object'
      ? { value: option.value, label: option.label ?? String(option.value) }
      : { value: option, label: String(option) },
  ),
)

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return normalizedOptions.value
  return normalizedOptions.value.filter((option) => option.label.toLowerCase().includes(query))
})

const exactMatch = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  return normalizedOptions.value.find((option) => option.label.toLowerCase() === query)
})

const showCreateOption = computed(() => props.allowCreate && Boolean(inputValue.value.trim()) && !exactMatch.value)

watch(
  () => props.modelValue,
  (value) => {
    const matched = normalizedOptions.value.find((option) => String(option.value) === String(value))
    inputValue.value = matched?.label ?? (value ? String(value) : '')
  },
  { immediate: true },
)

watch(normalizedOptions, () => {
  const matched = normalizedOptions.value.find((option) => String(option.value) === String(props.modelValue))
  if (matched) inputValue.value = matched.label
})

const openDropdown = () => {
  showDropdown.value = true
}

const closeDropdown = () => {
  showDropdown.value = false
}

const selectOption = (option) => {
  inputValue.value = option.label
  emit('update:modelValue', option.value)
  emit('select-existing', option)
  closeDropdown()
}

const createNew = () => {
  const label = inputValue.value.trim()
  if (!label) return
  emit('update:modelValue', label)
  emit('create-new', label)
  closeDropdown()
}

const onInput = () => {
  showDropdown.value = true
  if (exactMatch.value) {
    emit('update:modelValue', exactMatch.value.value)
    emit('select-existing', exactMatch.value)
    return
  }
  if (props.allowCreate) {
    emit('update:modelValue', inputValue.value.trim())
  }
}

const onBlur = () => {
  window.setTimeout(() => {
    closeDropdown()
    if (exactMatch.value) {
      selectOption(exactMatch.value)
    } else if (props.allowCreate && inputValue.value.trim()) {
      createNew()
    }
  }, 150)
}
</script>

<template>
  <div class="relative">
    <input
      v-model="inputValue"
      type="text"
      class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-merchant-primary focus:ring-2 focus:ring-merchant-primary/10"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="openDropdown"
      @input="onInput"
      @blur="onBlur"
    />

    <div
      v-if="showDropdown && (filteredOptions.length || showCreateOption)"
      class="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
    >
      <button
        v-for="option in filteredOptions"
        :key="option.value"
        type="button"
        class="flex w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
        @mousedown.prevent="selectOption(option)"
      >
        {{ option.label }}
      </button>

      <button
        v-if="showCreateOption"
        type="button"
        class="flex w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-merchant-primary hover:bg-slate-50"
        @mousedown.prevent="createNew"
      >
        <i class="pi pi-plus mr-2 text-xs" />
        Buat baru: "{{ inputValue.trim() }}"
      </button>
    </div>
  </div>
</template>
