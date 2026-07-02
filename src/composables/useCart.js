import { useCartStore } from '@/stores/cart.store'

/**
 * Composable useCart — thin wrapper atas cartStore
 * untuk dipakai di component tanpa import store langsung.
 */
export function useCart() {
  const cartStore = useCartStore()

  function addItem(product, options = {}) {
    return cartStore.addItem(product, options)
  }

  function removeItem(index) {
    cartStore.removeItem(index)
  }

  function updateQty(index, qty) {
    cartStore.updateQty(index, qty)
  }

  function clearCart() {
    cartStore.clearCart()
  }

  function applyVoucher(code, apiResult) {
    cartStore.applyVoucher(code, apiResult)
  }

  function clearVoucher() {
    cartStore.clearVoucher()
  }

  function setCustomer(data) {
    cartStore.setCustomer(data)
  }

  return {
    // state / computed (reactive refs dari store)
    items: cartStore.items,
    orderType: cartStore.orderType,
    tableId: cartStore.tableId,
    customerId: cartStore.customerId,
    customer: cartStore.customer,
    voucherCode: cartStore.voucherCode,
    voucherData: cartStore.voucherData,
    subtotal: cartStore.subtotal,
    discountAmount: cartStore.discountAmount,
    taxAmount: cartStore.taxAmount,
    serviceCharge: cartStore.serviceCharge,
    total: cartStore.total,
    itemCount: cartStore.itemCount,
    discountLabel: cartStore.discountLabel,
    // actions
    addItem,
    removeItem,
    updateQty,
    clearCart,
    applyVoucher,
    clearVoucher,
    setCustomer,
    buildOrderPayload: cartStore.buildOrderPayload.bind(cartStore),
  }
}
