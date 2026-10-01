import dayjs from 'dayjs'

export function formatShiftDuration(openedAt) {
  if (!openedAt) return '00:00'

  const start = dayjs(openedAt)
  const minutes = dayjs().diff(start, 'minute')

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export const PAYMENT_METHOD_LABELS = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  points: 'Poin',
  voucher: 'Voucher',
}
