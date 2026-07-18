import { formatRupiah } from '@/utils/currency'

// Default layout jika di database kosong
export const DEFAULT_RECEIPT_LAYOUT = [
  { id: 'logo', type: 'image', content: '', align: 'center', deletable: true },
  { id: 'outlet', type: 'text', content: 'KOPIREX', bold: true, size: 'large', align: 'center', deletable: true },
  { id: 'address', type: 'text', content: 'Jl. Contoh Alamat No. 123\nKota', align: 'center', deletable: true },
  { id: 'order_info', type: 'static_order_info', name: 'Info Transaksi', deletable: false },
  { id: 'items', type: 'static_items', name: 'Daftar Produk', deletable: false },
  { id: 'totals', type: 'static_totals', name: 'Subtotal & Total', deletable: false },
  { id: 'footer', type: 'text', content: 'Terima kasih atas kunjungan Anda!', align: 'center', deletable: true }
]

/**
 * Generate HTML untuk cetak struk via browser print dialog.
 */
export function generateReceiptHTML(data, settings = {}) {
  const ts = settings.tax || {}
  
  // Baca layout dari pengaturan, gunakan fallback default jika tidak ada
  let layout = DEFAULT_RECEIPT_LAYOUT
  try {
    if (settings.receipt?.layout) {
      if (typeof settings.receipt.layout === 'string') {
        layout = JSON.parse(settings.receipt.layout)
      } else if (Array.isArray(settings.receipt.layout)) {
        layout = settings.receipt.layout
      }
    }
  } catch(e) { console.error('Parse layout fail', e) }

  let htmlBody = ''

  layout.forEach(block => {
    switch(block.type) {
      case 'image':
        if (block.content) {
          htmlBody += `<div class="center" style="margin-bottom:8px;"><img src="${escapeHtml(block.content)}" style="max-height:48px;width:auto;filter:grayscale(100%);" alt="Logo" /></div>`
        }
        break
      case 'text':
        if (block.content) {
          let style = `margin-bottom:4px;white-space:pre-wrap;text-align:${block.align || 'left'};`
          if (block.bold) style += 'font-weight:900;'
          if (block.size === 'large') style += 'font-size:15px;letter-spacing:0.5px;margin-bottom:6px;'
          else style += 'font-size:10px;'
          htmlBody += `<div style="${style}">${escapeHtml(block.content)}</div>`
        }
        break
      case 'static_order_info':
        htmlBody += `
          <table style="margin:6px 0;width:100%;">
            <tr class="label-row"><td>No. Order</td><td style="text-align:right">${escapeHtml(data.order_number ?? '-')}</td></tr>
            <tr class="label-row"><td>Kasir</td><td style="text-align:right">${escapeHtml(data.cashier_name ?? '-')}</td></tr>
            <tr class="label-row"><td>Waktu</td><td style="text-align:right">${escapeHtml(data.timestamp ?? '-')}</td></tr>
          </table>
          <hr class="divider-dash" style="margin-bottom:6px;"/>
        `
        break
      case 'static_items':
        htmlBody += `<table style="margin-bottom:6px;width:100%;">`
        for (const item of data.items ?? []) {
          htmlBody += `
            <tr><td colspan="2" style="padding-bottom:0;font-weight:600">${escapeHtml(item.name)}</td></tr>
            <tr><td style="padding-left:8px;color:#555">${item.qty}x ${formatRupiah(item.unit_price)}</td><td style="text-align:right;font-weight:600">${formatRupiah(item.total)}</td></tr>
          `
        }
        htmlBody += `</table><hr class="divider-dash" style="margin-bottom:6px;"/>`
        break
      case 'static_totals':
        let totalsHtml = `<table style="width:100%;">`
        totalsHtml += `<tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(data.subtotal)}</td></tr>`
        if (data.discount_amount > 0) totalsHtml += `<tr><td>${escapeHtml(data.discount_label ?? 'Diskon')}</td><td style="text-align:right">-${formatRupiah(data.discount_amount)}</td></tr>`
        if (data.tax_amount > 0) totalsHtml += `<tr><td>PPN (${ts.rate}%)</td><td style="text-align:right">${formatRupiah(data.tax_amount)}</td></tr>`
        if (data.service_charge > 0) totalsHtml += `<tr><td>Service</td><td style="text-align:right">${formatRupiah(data.service_charge)}</td></tr>`
        
        totalsHtml += `
          <tr class="total-row" style="border-top:1px solid #000;border-bottom:1px solid #000;">
            <td style="font-weight:bold;padding:4px 0;">TOTAL</td>
            <td style="text-align:right;font-weight:bold;padding:4px 0;">${formatRupiah(data.total_amount)}</td>
          </tr>
        `
        if (ts.enabled === '0') totalsHtml += `<tr><td colspan="2" class="center" style="font-size:9px;font-style:italic;padding-top:4px;">Sudah termasuk PPN</td></tr>`
        
        totalsHtml += `</table><hr class="divider-dash" style="margin:6px 0;"/>`
        
        totalsHtml += `<table style="width:100%;">`
        totalsHtml += `<tr><td>Bayar (${escapeHtml(data.payment_method ?? '-')})</td><td style="text-align:right">${formatRupiah(data.cash_received ?? data.total_amount)}</td></tr>`
        if (data.change_amount > 0) totalsHtml += `<tr><td>Kembalian</td><td style="text-align:right">${formatRupiah(data.change_amount)}</td></tr>`
        totalsHtml += `</table><hr class="divider-dash" style="margin-top:6px;margin-bottom:8px;"/>`
        htmlBody += totalsHtml
        break
    }
  })

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Struk ${escapeHtml(data.order_number ?? '')}</title>
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; line-height: 1.5;
    }
    .center { text-align: center; }
    .divider-dash { border: none; border-top: 1px dashed #000; }
    table { border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .label-row td { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  </style>
</head>
<body>
  ${htmlBody}
  <p class="center" style="font-size:9px;color:#777;font-weight:bold;margin-top:12px;">Powered by Kasir Kopirex</p>
  <script>setTimeout(function(){ window.print(); }, 500);</script>
</body>
</html>`
}

function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Format data struk untuk payload ke ESC/POS thermal server.
 */
export async function buildEscPosPayload(data, settings = {}) {
  const ts = settings.tax || {}
  let layout = DEFAULT_RECEIPT_LAYOUT
  try {
    if (settings.receipt?.layout) {
      if (typeof settings.receipt.layout === 'string') {
        layout = JSON.parse(settings.receipt.layout)
      } else if (Array.isArray(settings.receipt.layout)) {
        layout = settings.receipt.layout
      }
    }
  } catch(e) { console.error('Parse layout fail', e) }
  
  const lines = []

  for (const block of layout) {
    switch(block.type) {
      case 'image':
        if (block.content) {
          try {
            // Kurangi ukuran lebar logo menjadi 200px (dari 384px) agar ukuran byte jauh lebih kecil
            // sehingga proses print Bluetooth menjadi 4x lebih cepat
            const imgData = await processImageToMonochrome(block.content, 200)
            if (imgData) {
              lines.push({ type: 'align', value: 'center' })
              lines.push({ type: 'image', pixels: imgData.pixels, width: imgData.width, height: imgData.height })
              lines.push({ type: 'align', value: 'left' })
            }
          } catch(e) { console.error('Image render fail', e) }
        }
        break
      case 'text':
        if (block.content) {
          lines.push({ 
            type: 'text', 
            value: block.content, 
            bold: block.bold, 
            size: block.size === 'large' ? 2 : 1 
          })
          if (block.align === 'center') lines.splice(lines.length-1, 0, { type: 'align', value: 'center' })
          else lines.splice(lines.length-1, 0, { type: 'align', value: 'left' })
        }
        break
      case 'static_order_info':
        lines.push({ type: 'align', value: 'left' })
        lines.push({ type: 'keyvalue', key: 'No. Order', value: data.order_number ?? '-' })
        lines.push({ type: 'keyvalue', key: 'Kasir', value: data.cashier_name ?? '-' })
        lines.push({ type: 'keyvalue', key: 'Waktu', value: data.timestamp ?? '-' })
        lines.push({ type: 'separator', style: 'dashed' })
        break
      case 'static_items':
        for (const item of data.items ?? []) {
          lines.push({ type: 'text', value: item.name, bold: true })
          lines.push({ type: 'keyvalue', key: `  ${item.qty}x ${formatRupiah(item.unit_price)}`, value: formatRupiah(item.total) })
        }
        lines.push({ type: 'separator', style: 'dashed' })
        break
      case 'static_totals':
        lines.push({ type: 'keyvalue', key: 'Subtotal', value: formatRupiah(data.subtotal) })
        if (data.discount_amount > 0) lines.push({ type: 'keyvalue', key: data.discount_label ?? 'Diskon', value: `-${formatRupiah(data.discount_amount)}` })
        if (data.tax_amount > 0) lines.push({ type: 'keyvalue', key: `PPN (${ts.rate}%)`, value: formatRupiah(data.tax_amount) })
        if (data.service_charge > 0) lines.push({ type: 'keyvalue', key: 'Service', value: formatRupiah(data.service_charge) })

        lines.push({ type: 'separator', style: 'solid' })
        lines.push({ type: 'keyvalue', key: 'TOTAL', value: formatRupiah(data.total_amount), bold: true })
        
        if (ts.enabled === '0') {
          lines.push({ type: 'align', value: 'center' })
          lines.push({ type: 'text', value: 'Sudah termasuk PPN' })
          lines.push({ type: 'align', value: 'left' })
        }
        
        lines.push({ type: 'separator', style: 'dashed' })
        lines.push({ type: 'keyvalue', key: `Bayar (${data.payment_method})`, value: formatRupiah(data.cash_received ?? data.total_amount) })
        if (data.change_amount > 0) lines.push({ type: 'keyvalue', key: 'Kembalian', value: formatRupiah(data.change_amount) })
        lines.push({ type: 'separator', style: 'dashed' })
        break
    }
  }

  lines.push({ type: 'align', value: 'center' })
  lines.push({ type: 'text', value: 'Powered by Kasir Kopirex' })
  lines.push({ type: 'feed', lines: 3 })
  lines.push({ type: 'cut' })

  return { lines }
}

async function processImageToMonochrome(src, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Calculate aspect ratio keeping max width
      let w = img.width
      let h = img.height
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w)
        w = maxWidth
      }
      
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      
      // Fill white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      
      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data
      const pixels = new Uint8Array(w * h)
      
      // Simple threshold dithering
      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const luminance = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2])
        // if pixel is dark and not fully transparent, it's black (1)
        if (luminance < 128 && data[i+3] > 128) {
          pixels[i / 4] = 1
        } else {
          pixels[i / 4] = 0
        }
      }
      
      resolve({ pixels, width: w, height: h })
    }
    img.onerror = reject
    img.src = src
  })
}
