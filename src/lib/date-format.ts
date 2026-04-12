const APP_TIME_ZONE = 'Asia/Shanghai'
const APP_LOCALE = 'zh-CN'

function getFormatterParts(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions
) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).formatToParts(date)

  const partMap = new Map(parts.map((part) => [part.type, part.value] as const))

  return {
    year: partMap.get('year') || '0000',
    month: partMap.get('month') || '00',
    day: partMap.get('day') || '00',
    hour: partMap.get('hour') || '00',
    minute: partMap.get('minute') || '00',
    second: partMap.get('second') || '00',
  }
}

export function formatAppDate(value: string | number | Date) {
  const parts = getFormatterParts(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return `${parts.year}/${parts.month}/${parts.day}`
}

export function formatAppDateTime(value: string | number | Date) {
  const parts = getFormatterParts(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
