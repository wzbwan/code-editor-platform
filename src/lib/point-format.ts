export function roundToOneDecimal(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

export function formatOneDecimal(value: number | null | undefined) {
  return roundToOneDecimal(value ?? 0).toFixed(1)
}

export function formatSignedOneDecimal(value: number) {
  const normalized = roundToOneDecimal(value)
  const formatted = normalized.toFixed(1)
  return normalized > 0 ? `+${formatted}` : formatted
}
