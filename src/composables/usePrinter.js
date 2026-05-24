import { ref } from 'vue'
import { generateReceiptHTML } from '@/utils/receipt'

const PRINT_SERVER = import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:7878'

export function usePrinter() {
  const isPrinting = ref(false)
  const lastError = ref(null)

  async function printReceipt(receiptData) {
    if (!receiptData) return false

    isPrinting.value = true
    lastError.value = null

    try {
      const response = await fetch(`${PRINT_SERVER}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptData),
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        return true
      }
    } catch {
      // fallback to browser print
    } finally {
      isPrinting.value = false
    }

    return printViaBrowser(receiptData)
  }

  function printViaBrowser(receiptData) {
    try {
      const html = generateReceiptHTML(receiptData)
      const printWindow = window.open('', '_blank', 'width=400,height=600')

      if (!printWindow) {
        lastError.value = 'Popup diblokir. Izinkan popup untuk mencetak struk.'
        return false
      }

      printWindow.document.write(html)
      printWindow.document.close()
      return true
    } catch (error) {
      lastError.value = error.message
      return false
    }
  }

  return {
    isPrinting,
    lastError,
    printReceipt,
  }
}
