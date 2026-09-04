export function parseImages(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [raw] }
}

export function firstImage(raw, fallback = '') {
  const imgs = parseImages(raw)
  return imgs[0] || fallback
}
