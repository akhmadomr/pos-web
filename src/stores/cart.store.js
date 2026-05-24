import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  SERVICE_CHARGE_RATE,
  TAX_RATE,
  buildAddonsLabel,
  buildVariantLabel,
  calculateAddonsPrice,
  calculateItemUnitPrice,
  itemFingerprint,
} from '@/utils/order'

const CART_KEY = 'kopirex-pos-cart'

function readCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistCart(state) {
  sessionStorage.setItem(
    CART_KEY,
    JSON.stringify({
      items: state.items,
      orderType: state.orderType,
      tableId: state.tableId,
      customerId: state.customerId,
      voucherCode: state.voucherCode,
      voucherData: state.voucherData,
    }),
  )
}

const saved = readCart()

export const useCartStore = defineStore('cart', () => {
  const items = ref(saved?.items ?? [])
  const orderType = ref(saved?.orderType ?? 'take_away')
  const tableId = ref(saved?.tableId ?? null)
  const customerId = ref(saved?.customerId ?? null)
  const voucherCode = ref(saved?.voucherCode ?? null)
  const voucherData = ref(saved?.voucherData ?? null)

  const subtotal = computed(() =>
    items.value.reduce(
      (sum, item) => sum + (Number(item.unit_price) + Number(item.addons_price)) * item.quantity,
      0,
    ),
  )

  const discountAmount = computed(() => {
    const voucher = voucherData.value
    if (!voucher || subtotal.value <= 0) return 0

    if (voucher.type === 'percentage') {
      const raw = subtotal.value * (Number(voucher.value) / 100)
      const max = voucher.max_discount != null ? Number(voucher.max_discount) : raw
      return Math.min(raw, max)
    }

    return Math.min(Number(voucher.value ?? 0), subtotal.value)
  })

  const taxableAmount = computed(() => Math.max(0, subtotal.value - discountAmount.value))

  const taxAmount = computed(() => taxableAmount.value * TAX_RATE)

  const serviceCharge = computed(() => taxableAmount.value * SERVICE_CHARGE_RATE)

  const total = computed(() => taxableAmount.value + taxAmount.value + serviceCharge.value)

  const itemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  watch(
    [items, orderType, tableId, customerId, voucherCode, voucherData],
    () => {
      persistCart({
        items: items.value,
        orderType: orderType.value,
        tableId: tableId.value,
        customerId: customerId.value,
        voucherCode: voucherCode.value,
        voucherData: voucherData.value,
      })
    },
    { deep: true },
  )

  function addItem(product, { variantSelections = {}, addonIds = [], quantity = 1, notes = '' } = {}) {
    const unitPrice = calculateItemUnitPrice(product, variantSelections)
    const addonsPrice = calculateAddonsPrice(product, addonIds)

    const newItem = {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      image: product.image,
      unit_price: unitPrice,
      addons_price: addonsPrice,
      quantity,
      variant_selections: { ...variantSelections },
      variant_label: buildVariantLabel(product, variantSelections) || null,
      addon_ids: [...addonIds],
      addons_label: buildAddonsLabel(product, addonIds) || null,
      notes: notes?.trim() || null,
    }

    const fingerprint = itemFingerprint(newItem)
    const existing = items.value.find((item) => itemFingerprint(item) === fingerprint)

    if (existing) {
      existing.quantity += quantity
      return existing
    }

    items.value.push(newItem)
    return newItem
  }

  function removeItem(itemIndex) {
    items.value.splice(itemIndex, 1)
  }

  function updateQty(itemIndex, qty) {
    const item = items.value[itemIndex]
    if (!item) return

    if (qty <= 0) {
      removeItem(itemIndex)
      return
    }

    item.quantity = qty
  }

  function clearCart() {
    items.value = []
    voucherCode.value = null
    voucherData.value = null
  }

  function setOrderType(type) {
    orderType.value = type
    if (type !== 'dine_in') {
      tableId.value = null
    }
  }

  function setTable(id) {
    tableId.value = id
  }

  function setCustomer(id) {
    customerId.value = id
  }

  function applyVoucher(code, data) {
    voucherCode.value = code
    voucherData.value = data
  }

  function clearVoucher() {
    voucherCode.value = null
    voucherData.value = null
  }

  return {
    items,
    orderType,
    tableId,
    customerId,
    voucherCode,
    voucherData,
    subtotal,
    discountAmount,
    taxAmount,
    serviceCharge,
    total,
    itemCount,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    setOrderType,
    setTable,
    setCustomer,
    applyVoucher,
    clearVoucher,
  }
})
