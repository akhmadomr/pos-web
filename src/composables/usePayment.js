import { computed, ref } from 'vue'
import { createPayment } from '@/api/payments'

export function usePayment() {
  const isProcessing = ref(false)
  const error = ref(null)
  const paymentMethod = ref(null)
  const cashReceived = ref('')
  const referenceNumber = ref('')
  const paymentResult = ref(null)

  const changeAmount = computed(() => {
    const received = Number(String(cashReceived.value).replace(/\D/g, '') || 0)
    const total = Number(paymentResult.value?.orderTotal ?? 0)
    if (!total || paymentMethod.value !== 'cash') return 0
    return Math.max(0, received - total)
  })

  function setMethod(method) {
    paymentMethod.value = method
    error.value = null
    if (method !== 'cash') {
      cashReceived.value = ''
    }
  }

  function setCashReceived(amount) {
    cashReceived.value = String(amount ?? '')
  }

  function calculateChange(total) {
    const received = Number(String(cashReceived.value).replace(/\D/g, '') || 0)
    return Math.max(0, received - total)
  }

  function isCashValid(total) {
    const received = Number(String(cashReceived.value).replace(/\D/g, '') || 0)
    return received >= total
  }

  async function processPayment(orderId, paymentData, orderTotal = 0) {
    isProcessing.value = true
    error.value = null

    try {
      const result = await createPayment({
        order_id: orderId,
        payment_method: paymentData.payment_method,
        amount: paymentData.amount,
        reference_number: paymentData.reference_number ?? null,
      })

      paymentResult.value = {
        ...result,
        orderTotal,
      }

      return result
    } catch (err) {
      error.value =
        err.data?.message || err.response?.data?.message || 'Pembayaran gagal diproses.'
      throw err
    } finally {
      isProcessing.value = false
    }
  }

  function resetPayment() {
    isProcessing.value = false
    error.value = null
    paymentMethod.value = null
    cashReceived.value = ''
    referenceNumber.value = ''
    paymentResult.value = null
  }

  return {
    isProcessing,
    error,
    paymentMethod,
    cashReceived,
    referenceNumber,
    paymentResult,
    changeAmount,
    setMethod,
    setCashReceived,
    calculateChange,
    isCashValid,
    processPayment,
    resetPayment,
  }
}
