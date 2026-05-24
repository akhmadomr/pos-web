import dayjs from 'dayjs'

export function formatShiftDuration(openedAt) {
  if (!openedAt) return '—'

  const start = dayjs(openedAt)
  const minutes = dayjs().diff(start, 'minute')

  if (minutes < 1) return '< 1 menit'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins} menit`
  if (mins === 0) return `${hours} jam`

  return `${hours} jam ${mins} menit`
}

export const PAYMENT_METHOD_LABELS = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  points: 'Poin',
  voucher: 'Voucher',
}
