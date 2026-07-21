<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import {
  buildAddonsLabel,
  buildDefaultVariantSelections,
  buildVariantLabel,
  calculateAddonsPrice,
  calculateItemUnitPrice,
  groupVariantsByType,
} from '@/utils/order'
import { formatRupiah } from '@/utils/currency'
import { resolveImageUrl } from '@/utils/media'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  product: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'add'])

const quantity = ref(1)
const notes = ref('')
const addonCounts = reactive({})
const variantSelections = reactive({})

const variantGroups = computed(() => {
  if (!props.product) return {}
  return groupVariantsByType(props.product.variants ?? [])
})

const imageUrl = computed(() => resolveImageUrl(props.product?.image))

const unitPrice = computed(() => {
  if (!props.product) return 0
  return calculateItemUnitPrice(props.product, variantSelections)
})

const getAddonIdsArray = () => {
  const ids = []
  Object.entries(addonCounts).forEach(([id, qty]) => {
    for (let i = 0; i < qty; i++) {
      ids.push(Number(id))
    }
  })
  return ids
}

const addonsPrice = computed(() => {
  if (!props.product) return 0
  return calculateAddonsPrice(props.product, getAddonIdsArray())
})

const lineTotal = computed(() => (unitPrice.value + addonsPrice.value) * quantity.value)

const resetForm = () => {
  if (!props.product) return

  Object.keys(variantSelections).forEach((key) => delete variantSelections[key])
  const defaults = buildDefaultVariantSelections(props.product.variants ?? [])
  Object.assign(variantSelections, defaults)

  Object.keys(addonCounts).forEach((key) => delete addonCounts[key])
  quantity.value = 1
  notes.value = ''
}

watch(
  () => [props.show, props.product?.id],
  ([visible]) => {
    if (visible) resetForm()
  },
)

const toggleAddon = (addonId, checked) => {
  if (checked) {
    addonCounts[addonId] = 1
  } else {
    delete addonCounts[addonId]
  }
}

const updateAddonQty = (addonId, delta) => {
  if (!addonCounts[addonId]) return
  const newQty = addonCounts[addonId] + delta
  if (newQty <= 0) {
    delete addonCounts[addonId]
  } else {
    addonCounts[addonId] = newQty
  }
}

const handleAdd = () => {
  if (!props.product) return

  emit('add', {
    product: props.product,
    variantSelections: { ...variantSelections },
    addonIds: getAddonIdsArray(),
    quantity: quantity.value,
    notes: notes.value,
    variant_label: buildVariantLabel(props.product, variantSelections),
    addons_label: buildAddonsLabel(props.product, getAddonIdsArray()),
  })
  emit('close')
}

const handleClose = () => emit('close')
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="handleClose" />

        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-full sm:translate-y-4 sm:scale-95 sm:opacity-0"
          enter-to-class="translate-y-0 sm:scale-100 sm:opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-y-0 sm:scale-100 sm:opacity-100"
          leave-to-class="translate-y-full sm:translate-y-4 sm:scale-95 sm:opacity-0"
        >
          <div
            v-if="show && product"
            class="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div class="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 sm:hidden" />

            <div class="overflow-y-auto p-6">
              <div class="mb-6 flex gap-4">
                <div class="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-merchant-accent">
                  <img v-if="imageUrl" :src="imageUrl" :alt="product.name" class="h-full w-full object-cover" />
                  <div v-else class="flex h-full items-center justify-center text-merchant-primary/40">
                    <i class="pi pi-image text-2xl" />
                  </div>
                </div>
                <div>
                  <h3 class="text-xl font-black text-slate-900">{{ product.name }}</h3>
                  <p v-if="product.slang" class="text-sm font-medium text-slate-400">{{ product.slang }}</p>
                  <p class="mt-1 text-lg font-bold text-merchant-primary">{{ formatRupiah(lineTotal) }}</p>
                </div>
              </div>

              <div v-for="(options, type) in variantGroups" :key="type" class="mb-6">
                <p class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{{ type }}</p>
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="option in options"
                    :key="option.id"
                    class="cursor-pointer"
                  >
                    <input
                      v-model="variantSelections[type]"
                      type="radio"
                      :value="option.name"
                      class="peer sr-only"
                    />
                    <span
                      class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold transition peer-checked:border-merchant-primary peer-checked:bg-merchant-accent peer-checked:text-merchant-primary"
                    >
                      {{ option.name }}
                      <span
                        v-if="option.price_adjustment"
                        class="text-xs text-slate-500"
                      >
                        {{ option.price_adjustment > 0 ? '+' : '' }}{{ formatRupiah(option.price_adjustment) }}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div v-if="product.addons?.length" class="mb-6">
                <p class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Tambahan</p>
                <div class="space-y-2">
                  <div
                    v-for="addon in product.addons"
                    :key="addon.id"
                    class="flex flex-col rounded-xl border transition"
                    :class="addonCounts[addon.id] ? 'border-merchant-primary bg-merchant-accent' : 'border-slate-200'"
                  >
                    <label class="flex cursor-pointer items-center justify-between px-4 py-3">
                      <div class="flex items-center gap-3">
                        <input
                          type="checkbox"
                          class="h-5 w-5 rounded border-slate-300 text-merchant-primary focus:ring-merchant-primary"
                          :checked="!!addonCounts[addon.id]"
                          @change="e => toggleAddon(addon.id, e.target.checked)"
                        />
                        <span class="font-semibold text-slate-800">{{ addon.name }}</span>
                      </div>
                      <span class="text-sm font-bold text-merchant-primary">+{{ formatRupiah(addon.price) }}</span>
                    </label>

                    <!-- Addon Quantity Control -->
                    <div v-if="addonCounts[addon.id]" class="flex items-center justify-between border-t border-merchant-primary/20 px-4 py-3 bg-white/40 rounded-b-xl">
                      <span class="text-xs font-bold text-slate-500">Jumlah {{ addon.name }}</span>
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base font-bold shadow-sm ring-1 ring-slate-200"
                          @click="updateAddonQty(addon.id, -1)"
                        >
                          −
                        </button>
                        <span class="min-w-[1.5rem] text-center text-sm font-black">{{ addonCounts[addon.id] }}</span>
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-lg bg-merchant-primary text-base font-bold text-white shadow-sm"
                          @click="updateAddonQty(addon.id, 1)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mb-6">
                <label class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Catatan</label>
                <input
                  v-model="notes"
                  type="text"
                  placeholder="Misalnya: kurang manis"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-merchant-primary focus:outline-none focus:ring-2 focus:ring-merchant-primary/20"
                />
              </div>

              <div class="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span class="text-sm font-bold text-slate-600">Jumlah</span>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-bold shadow ring-1 ring-slate-200"
                    @click="quantity = Math.max(1, quantity - 1)"
                  >
                    −
                  </button>
                  <span class="min-w-[2rem] text-center text-xl font-black">{{ quantity }}</span>
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-merchant-primary text-lg font-bold text-white shadow"
                    @click="quantity += 1"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div class="border-t border-slate-100 bg-slate-50/80 p-4 sm:p-6">
              <AppButton class="w-full py-4 text-base" @click="handleAdd">
                <i class="pi pi-plus" />
                Tambah ke Pesanan — {{ formatRupiah(lineTotal) }}
              </AppButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
