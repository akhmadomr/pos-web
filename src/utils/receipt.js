import { formatRupiah } from '@/utils/currency'

/**
 * Generate HTML untuk cetak struk via browser print dialog.
 * Didesain untuk kertas thermal 80mm (72mm content area).
 */
export function generateReceiptHTML(data) {
  const itemsHtml = (data.items ?? [])
    .map(
      (item) => `
      <tr>
        <td colspan="2" style="padding-bottom:0;font-weight:600">${escapeHtml(item.name)}</td>
      </tr>
      <tr>
        <td style="padding-left:8px;color:#555">${item.qty}x ${formatRupiah(item.unit_price)}</td>
        <td style="text-align:right;font-weight:600">${formatRupiah(item.total)}</td>
      </tr>`,
    )
    .join('')

  const discountRow =
    data.discount_amount > 0
      ? `<tr><td>${escapeHtml(data.discount_label ?? 'Diskon')}</td><td style="text-align:right">-${formatRupiah(data.discount_amount)}</td></tr>`
      : ''

  const taxRow =
    data.tax_amount > 0
      ? `<tr><td>Pajak (11%)</td><td style="text-align:right">${formatRupiah(data.tax_amount)}</td></tr>`
      : ''

  const serviceRow =
    data.service_charge > 0
      ? `<tr><td>Service</td><td style="text-align:right">${formatRupiah(data.service_charge)}</td></tr>`
      : ''

  const changeRow =
    data.change_amount > 0
      ? `<tr><td>Kembalian</td><td style="text-align:right">${formatRupiah(data.change_amount)}</td></tr>`
      : ''

  const tableInfo = data.table_number ? ` · Meja ${escapeHtml(String(data.table_number))}` : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Struk ${escapeHtml(data.order_number ?? '')}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 72mm;
      margin: 0 auto;
      color: #000;
      line-height: 1.5;
    }
    .center { text-align: center; }
    .outlet-name {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
      margin: 0 0 2px;
    }
    .outlet-sub {
      font-size: 10px;
      text-align: center;
      color: #444;
      margin: 0;
    }
    .divider-solid {
      border: none;
      border-top: 1px solid #000;
      margin: 6px 0;
    }
    .divider-dash {
      border: none;
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 1px 0;
      vertical-align: top;
    }
    .label-row td {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
    }
    .total-row td {
      font-size: 13px;
      font-weight: 900;
      padding: 3px 0;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 4px;
      color: #444;
    }
    .footer-brand {
      text-align: center;
      font-size: 9px;
      color: #999;
      margin-top: 6px;
      letter-spacing: 0.1em;
    }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <p class="outlet-name">${escapeHtml(data.outlet_name ?? 'KOPIREX')}</p>
  ${data.outlet_address ? `<p class="outlet-sub">${escapeHtml(data.outlet_address)}</p>` : ''}
  ${data.outlet_phone ? `<p class="outlet-sub">Telp: ${escapeHtml(data.outlet_phone)}</p>` : ''}

  <hr class="divider-solid" />

  <table>
    <tr class="label-row"><td>No. Order</td><td style="text-align:right">${escapeHtml(data.order_number ?? '-')}</td></tr>
    <tr class="label-row"><td>Kasir</td><td style="text-align:right">${escapeHtml(data.cashier_name ?? '-')}</td></tr>
    <tr class="label-row"><td>Tipe</td><td style="text-align:right">${escapeHtml(data.order_type ?? '-')}${escapeHtml(tableInfo)}</td></tr>
    <tr class="label-row"><td>Waktu</td><td style="text-align:right">${escapeHtml(data.timestamp ?? '-')}</td></tr>
  </table>

  <hr class="divider-dash" />

  <table>
    ${itemsHtml}
  </table>

  <hr class="divider-dash" />

  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(data.subtotal)}</td></tr>
    ${discountRow}
    ${taxRow}
    ${serviceRow}
  </table>

  <hr class="divider-solid" />

  <table>
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatRupiah(data.total_amount)}</td></tr>
    <tr><td>Bayar (${escapeHtml(data.payment_method ?? '-')})</td><td style="text-align:right">${formatRupiah(data.cash_received ?? data.total_amount)}</td></tr>
    ${changeRow}
  </table>

  <hr class="divider-dash" />

  <p class="footer">${escapeHtml(data.footer_message ?? 'Terima kasih sudah berkunjung!')}</p>
  <p class="footer-brand">★ KOPIREX ★</p>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  <\/script>
</body>
</html>`
}

/**
 * Escape HTML special characters untuk mencegah XSS di struk.
 */
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
 * Digunakan oleh usePrinter.js saat POST ke print server.
 */
export function buildEscPosPayload(data) {
  const lines = []

  // Header
  lines.push({ type: 'align', value: 'center' })
  lines.push({ type: 'text', value: (data.outlet_name ?? 'KOPIREX').toUpperCase(), bold: true, size: 2 })
  if (data.outlet_address) lines.push({ type: 'text', value: data.outlet_address, size: 1 })
  if (data.outlet_phone) lines.push({ type: 'text', value: `Telp: ${data.outlet_phone}`, size: 1 })
  lines.push({ type: 'separator', style: 'solid' })

  // Meta
  lines.push({ type: 'align', value: 'left' })
  lines.push({ type: 'keyvalue', key: 'No. Order', value: data.order_number ?? '-' })
  lines.push({ type: 'keyvalue', key: 'Kasir', value: data.cashier_name ?? '-' })
  lines.push({ type: 'keyvalue', key: 'Tipe', value: (data.order_type ?? '-') + (data.table_number ? ` · Meja ${data.table_number}` : '') })
  lines.push({ type: 'keyvalue', key: 'Waktu', value: data.timestamp ?? '-' })
  lines.push({ type: 'separator', style: 'dashed' })

  // Items
  for (const item of data.items ?? []) {
    lines.push({ type: 'text', value: item.name, bold: true })
    lines.push({ type: 'keyvalue', key: `  ${item.qty}x ${formatRupiah(item.unit_price)}`, value: formatRupiah(item.total) })
  }
  lines.push({ type: 'separator', style: 'dashed' })

  // Totals
  lines.push({ type: 'keyvalue', key: 'Subtotal', value: formatRupiah(data.subtotal) })
  if (data.discount_amount > 0)
    lines.push({ type: 'keyvalue', key: data.discount_label ?? 'Diskon', value: `-${formatRupiah(data.discount_amount)}` })
  if (data.tax_amount > 0)
    lines.push({ type: 'keyvalue', key: 'Pajak (11%)', value: formatRupiah(data.tax_amount) })
  if (data.service_charge > 0)
    lines.push({ type: 'keyvalue', key: 'Service', value: formatRupiah(data.service_charge) })

  lines.push({ type: 'separator', style: 'solid' })
  lines.push({ type: 'keyvalue', key: 'TOTAL', value: formatRupiah(data.total_amount), bold: true, size: 2 })
  lines.push({ type: 'keyvalue', key: `Bayar (${data.payment_method})`, value: formatRupiah(data.cash_received ?? data.total_amount) })
  if (data.change_amount > 0)
    lines.push({ type: 'keyvalue', key: 'Kembalian', value: formatRupiah(data.change_amount) })

  lines.push({ type: 'separator', style: 'dashed' })
  lines.push({ type: 'align', value: 'center' })
  lines.push({ type: 'text', value: data.footer_message ?? 'Terima kasih sudah berkunjung!' })
  lines.push({ type: 'text', value: '★ KOPIREX ★' })
  lines.push({ type: 'feed', lines: 3 })
  lines.push({ type: 'cut' })

  return { lines }
}
