export function getDateBoundary(value, isEndOfDay) {
  const time = isEndOfDay ? '23:59:59.999' : '00:00:00'
  const date = new Date(`${value}T${time}`)

  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}
