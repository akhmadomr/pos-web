import { formatRupiah } from '@/utils/currency'

export function generateReceiptHTML(data) {
  const itemsHtml = (data.items ?? [])
    .map(
      (item) => `
      <tr>
        <td>${item.name} x${item.qty}</td>
        <td style="text-align:right">${formatRupiah(item.total)}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Struk ${data.order_number}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
    p { margin: 2px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    td { padding: 2px 0; vertical-align: top; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .total { font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${data.outlet_name ?? 'Kopirex'}</h1>
  <p>${data.outlet_address ?? ''}</p>
  <p>${data.outlet_phone ?? ''}</p>
  <div class="divider"></div>
  <p><strong>${data.order_number}</strong></p>
  <p>${data.timestamp}</p>
  <p>Kasir: ${data.cashier_name ?? '-'}</p>
  <p>${data.order_type ?? ''}${data.table_number ? ` · Meja ${data.table_number}` : ''}</p>
  <table>${itemsHtml}</table>
  <div class="divider"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(data.subtotal)}</td></tr>
    ${
      data.discount_amount > 0
        ? `<tr><td>${data.discount_label ?? 'Diskon'}</td><td style="text-align:right">-${formatRupiah(data.discount_amount)}</td></tr>`
        : ''
    }
    <tr><td>Pajak</td><td style="text-align:right">${formatRupiah(data.tax_amount)}</td></tr>
    ${
      data.service_charge > 0
        ? `<tr><td>Service</td><td style="text-align:right">${formatRupiah(data.service_charge)}</td></tr>`
        : ''
    }
    <tr class="total"><td>Total</td><td style="text-align:right">${formatRupiah(data.total_amount)}</td></tr>
    <tr><td>Bayar (${data.payment_method})</td><td style="text-align:right">${formatRupiah(data.cash_received ?? data.total_amount)}</td></tr>
    ${
      data.change_amount > 0
        ? `<tr><td>Kembali</td><td style="text-align:right">${formatRupiah(data.change_amount)}</td></tr>`
        : ''
    }
  </table>
  <div class="divider"></div>
  <p>${data.footer_message ?? 'Terima kasih!'}</p>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`
}
