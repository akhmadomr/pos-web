import { ref } from 'vue'
import { generateReceiptHTML, buildEscPosPayload } from '@/utils/receipt'
import { useSettingsStore } from '@/stores/settings.store'

const PRINT_SERVER = import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:7878'

export function usePrinter() {
  const isPrinting = ref(false)
  const lastError = ref(null)
  const printerOnline = ref(false)

  /**
   * Periksa apakah local print server aktif.
   */
  async function checkPrinterStatus() {
    try {
      const res = await fetch(`${PRINT_SERVER}/status`, {
        signal: AbortSignal.timeout(1500),
      })
      printerOnline.value = res.ok
    } catch {
      // Server tidak tersedia — ini normal jika tidak ada printer lokal
      printerOnline.value = false
    }
    return printerOnline.value
  }

  /**
   * Cetak struk. Prioritas:
   *   1. Local ESC/POS server (port 7878)
   *   2. Browser print dialog (fallback)
   */
  async function printReceipt(receiptData) {
    if (!receiptData) return false

    isPrinting.value = true
    lastError.value = null
    const settingsStore = useSettingsStore()
    const settings = {
      tax: settingsStore.tax,
      receipt: settingsStore.receipt
    }

    try {
      // Coba ESC/POS server terlebih dahulu
      const escPosPayload = buildEscPosPayload(receiptData, settings)
      const response = await fetch(`${PRINT_SERVER}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escPosPayload),
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        printerOnline.value = true
        return true
      }

      // Server merespons tapi gagal
      const err = await response.json().catch(() => ({}))
      lastError.value = err.message ?? 'Printer error.'
    } catch {
      // Server tidak tersedia → fallback browser print
      printerOnline.value = false
    } finally {
      isPrinting.value = false
    }

    // Fallback: browser print dialog
    return printViaBrowser(receiptData)
  }

  /**
   * Cetak ulang struk menggunakan browser print dialog.
   */
  function printViaBrowser(receiptData) {
    try {
      const settingsStore = useSettingsStore()
      const settings = { tax: settingsStore.tax, receipt: settingsStore.receipt }
      const html = generateReceiptHTML(receiptData, settings)
      const printWindow = window.open('', '_blank', 'width=420,height=700,scrollbars=yes')

      if (!printWindow) {
        lastError.value = 'Popup diblokir browser. Izinkan popup untuk mencetak struk.'
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
    printerOnline,
    checkPrinterStatus,
    printReceipt,
    printViaBrowser,
  }
}
