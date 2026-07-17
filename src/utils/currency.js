export function formatRupiah(value) {
  const amount = Number(value ?? 0)
  // Gunakan format angka standar lalu gabung manual dengan 'Rp '
  // untuk mencegah non-breaking space (\u00A0) yang menyebabkan masalah encoding di ESC/POS (Rpá)
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  
  return `Rp ${formatted}`
}

export function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0))
}
