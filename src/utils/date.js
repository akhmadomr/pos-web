import dayjs from 'dayjs'
import 'dayjs/locale/id'

dayjs.locale('id')

export function formatDateTime(value) {
  if (!value) return '—'
  return dayjs(value).format('DD MMM YYYY, HH:mm')
}

export function formatTime(value) {
  if (!value) return '—'
  return dayjs(value).format('HH:mm:ss')
}
