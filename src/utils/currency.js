// CATATAN ARSITEKTUR: formatRupiah di pos-web SENGAJA berbeda dari kopirex-admin.
// kopirex-admin pakai Intl style:'currency' → output "Rp\u00A0" (non-breaking space).
// pos-web pakai string manual "Rp " → wajib untuk printer thermal ESC/POS;
// non-breaking space menyebabkan karakter rusak ("Rpá") di driver printer.
// Jangan samakan keduanya tanpa mempertimbangkan kompatibilitas printer.
export function formatRupiah(value) {
  const amount = Number(value ?? 0)
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `Rp ${formatted}`
}

export function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0))
}

// Disamakan dengan kopirex-admin untuk konsistensi tampilan angka ringkas
export function formatShortNum(num) {
  if (num == null) return '0'
  if (num >= 1000000000) return Math.round(num / 1000000000) + ' M'
  if (num >= 1000000) return Math.round(num / 1000000) + ' jt'
  if (num >= 1000) return Math.round(num / 1000) + ' rb'
  return String(Math.round(num))
}
