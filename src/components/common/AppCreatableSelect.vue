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
  createTypes: {
    type: Array,
    default: () => [], // e.g. [{ label: 'Buat baru Operasional', value: 'ops' }, { label: 'Buat baru Bahan Baku', value: 'hpp' }]
  }
})

const emit = defineEmits(['update:modelValue', 'select-existing', 'create-new'])

const inputValue = ref('')
const showDropdown = ref(false)

const normalizedOptions = computed(() =>
  props.options.map((option) =>
    typeof option === 'object'
      ? { 
          ...option,
          value: option.value, 
          label: option.label ?? String(option.value),
          rawLabel: option.rawLabel ?? option.name ?? option.label ?? String(option.value)
        }
      : { value: option, label: String(option), rawLabel: String(option) },
  ),
)

const filteredOptions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return normalizedOptions.value
  return normalizedOptions.value.filter((option) => {
    const raw = (option.rawLabel || option.value || '').toLowerCase()
    return raw.includes(query) || option.label.toLowerCase().includes(query)
  })
})

const exactMatch = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return null
  return normalizedOptions.value.find((option) => {
    const raw = (option.rawLabel || option.value || '').toLowerCase()
    return raw === query || option.label.toLowerCase() === query
  })
})

const showCreateOption = computed(() => props.allowCreate && Boolean(inputValue.value.trim()) && !exactMatch.value)

watch(
  () => props.modelValue,
  (value) => {
    if (inputValue.value === String(value)) return
    const matched = normalizedOptions.value.find((option) => String(option.value) === String(value) || String(option.rawLabel) === String(value))
    if (matched && (inputValue.value === matched.label || inputValue.value === matched.rawLabel)) return
    inputValue.value = matched?.rawLabel ?? matched?.label ?? (value ? String(value) : '')
  },
  { immediate: true },
)

watch(normalizedOptions, () => {
  if (inputValue.value === String(props.modelValue)) return
  const matched = normalizedOptions.value.find((option) => String(option.value) === String(props.modelValue) || String(option.rawLabel) === String(props.modelValue))
  if (matched && inputValue.value !== matched.rawLabel && inputValue.value !== matched.label) {
    inputValue.value = matched.rawLabel || matched.label
  }
})

const openDropdown = () => {
  showDropdown.value = true
}

const closeDropdown = () => {
  showDropdown.value = false
}

const selectOption = (option) => {
  inputValue.value = option.rawLabel || option.label
  emit('update:modelValue', option.rawLabel || option.value)
  emit('select-existing', option)
  closeDropdown()
}

const createNew = (createType = null) => {
  const label = inputValue.value.trim()
  if (!label) return
  emit('update:modelValue', label)
  emit('create-new', { label, type: createType })
  closeDropdown()
}

const onInput = () => {
  showDropdown.value = true
  if (exactMatch.value) {
    emit('update:modelValue', exactMatch.value.rawLabel || exactMatch.value.value)
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
    } else if (props.allowCreate && inputValue.value.trim() && (!props.createTypes || props.createTypes.length === 0)) {
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

      <template v-if="showCreateOption">
        <template v-if="createTypes.length > 0">
          <button
            v-for="ctype in createTypes"
            :key="ctype.value"
            type="button"
            class="flex w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-merchant-primary hover:bg-slate-50"
            @mousedown.prevent="createNew(ctype.value)"
          >
            <i class="pi pi-plus mr-2 text-xs" />
            {{ ctype.label }}: "{{ inputValue.trim() }}"
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="flex w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-merchant-primary hover:bg-slate-50"
            @mousedown.prevent="createNew()"
          >
            <i class="pi pi-plus mr-2 text-xs" />
            Buat baru: "{{ inputValue.trim() }}"
          </button>
        </template>
      </template>
    </div>
  </div>
</template>
