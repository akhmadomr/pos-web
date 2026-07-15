import { ref } from 'vue'
import { generateReceiptHTML, buildEscPosPayload } from '@/utils/receipt'
import { jsonToEscPos } from '@/utils/escpos-encoder'
import { useSettingsStore } from '@/stores/settings.store'

const PRINT_SERVER = import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:7878'

export function usePrinter() {
  const isPrinting = ref(false)
  const lastError = ref(null)
  const printerOnline = ref(false)
  const bluetoothDevice = ref(null)
  const bluetoothCharacteristic = ref(null)

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
      // 1. Coba Bluetooth Printer (jika terhubung)
      if (bluetoothCharacteristic.value) {
        const escPosPayload = buildEscPosPayload(receiptData, settings)
        const bytes = jsonToEscPos(escPosPayload)
        
        // Chunk write karena batas BLE (biasanya 512 bytes atau 20 bytes)
        const CHUNK_SIZE = 100
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE)
          await bluetoothCharacteristic.value.writeValue(chunk)
        }
        
        isPrinting.value = false
        return true
      }

      // 2. Coba ESC/POS server lokal (port 7878)
      const escPosPayload = buildEscPosPayload(receiptData, settings)
      const response = await fetch(`${PRINT_SERVER}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escPosPayload),
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        printerOnline.value = true
        isPrinting.value = false
        return true
      }

      // Server merespons tapi gagal
      const err = await response.json().catch(() => ({}))
      lastError.value = err.message ?? 'Printer error.'
    } catch (err) {
      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        // Server tidak tersedia → fallback browser print
        printerOnline.value = false
      } else {
        lastError.value = err.message
      }
    }

    isPrinting.value = false
    // 3. Fallback: browser print dialog
    return printViaBrowser(receiptData)
  }

  /**
   * Cetak ulang struk menggunakan browser print dialog (via hidden iframe).
   */
  function printViaBrowser(receiptData) {
    try {
      const settingsStore = useSettingsStore()
      const settings = { tax: settingsStore.tax, receipt: settingsStore.receipt }
      const html = generateReceiptHTML(receiptData, settings)

      // Buat hidden iframe
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(html)
      doc.close()

      // Hapus iframe setelah print dialog ditutup (atau dibatalkan)
      iframe.contentWindow.onafterprint = () => {
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
      }

      return true
    } catch (error) {
      lastError.value = error.message
      return false
    }
  }

  /**
   * Hubungkan ke Printer Bluetooth (Web Bluetooth API)
   */
  async function connectBluetooth() {
    if (!navigator.bluetooth) {
      alert('Browser Anda tidak mendukung fitur Bluetooth (Gunakan Google Chrome atau Edge terbaru).')
      return false
    }
    
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Custom Printer Service
          '0000e781-0000-1000-8000-00805f9b34fb' 
        ]
      })

      const server = await device.gatt.connect()
      let service = null
      
      // Cari service yang tersedia
      const services = await server.getPrimaryServices()
      if (services.length > 0) {
        service = services[0] // Gunakan service pertama yang ketemu jika tidak ada yang spesifik
      }
      
      if (!service) throw new Error('Printer tidak memiliki layanan yang cocok.')
      
      const characteristics = await service.getCharacteristics()
      if (characteristics.length === 0) throw new Error('Tidak dapat menemukan jalur komunikasi printer.')
      
      // Gunakan characteristic pertama yang memiliki properti 'write' atau 'writeWithoutResponse'
      const characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse)
      
      if (!characteristic) throw new Error('Printer tidak mendukung fitur penulisan (write).')

      bluetoothDevice.value = device
      bluetoothCharacteristic.value = characteristic
      printerOnline.value = true // Anggap online karena terhubung bluetooth
      
      device.addEventListener('gattserverdisconnected', () => {
        bluetoothDevice.value = null
        bluetoothCharacteristic.value = null
        printerOnline.value = false
      })
      
      return true
    } catch (err) {
      console.error('Bluetooth Connect Error:', err)
      alert('Gagal menghubungkan Bluetooth: ' + err.message)
      return false
    }
  }

  return {
    isPrinting,
    lastError,
    printerOnline,
    bluetoothDevice,
    checkPrinterStatus,
    printReceipt,
    printViaBrowser,
    connectBluetooth
  }
}
