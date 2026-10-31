/** Rectangle de la carte dans les pixels de la photo d'origine. */
export interface CardRect {
  cx: number
  cy: number
  width: number
  height: number
}

const CARD_RATIO = 63 / 88
const ANALYSIS_SIZE = 256
// Marge retirée sur chaque bord pour ne garder aucune bande de fond (coins arrondis, ombre)
const INSET = 0.012

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/**
 * Repère la carte sur la photo : on estime la couleur du fond sur le pourtour,
 * on isole tout ce qui s'en distingue, puis on garde la plus grande forme pleine.
 * Renvoie null si rien de fiable n'est trouvé (l'appelant bascule alors en cadrage manuel).
 */
export function detectCardRect(img: HTMLImageElement): CardRect | null {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) return null

  const k = ANALYSIS_SIZE / Math.max(nw, nh)
  const w = Math.max(8, Math.round(nw * k))
  const h = Math.max(8, Math.round(nh * k))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return null
  }

  // Couleur du fond = médiane du pourtour
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.03))
  const ringIdx: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) ringIdx.push(y * w + x)
    }
  }
  const bg = [0, 1, 2].map((c) => median(ringIdx.map((i) => data[i * 4 + c])))
  const distAt = (i: number) =>
    Math.hypot(data[i * 4] - bg[0], data[i * 4 + 1] - bg[1], data[i * 4 + 2] - bg[2])

  // Seuil adapté à la régularité du fond (table unie ou texturée)
  const ringDist = ringIdx.map(distAt).sort((a, b) => a - b)
  const p90 = ringDist[Math.floor(ringDist.length * 0.9)] ?? 0
  const threshold = Math.min(110, Math.max(35, p90 * 1.4 + 10))

  const raw = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) raw[i] = distAt(i) > threshold ? 1 : 0

  // Dilatation 3×3 : comble les petits trous (reflets, zones proches de la couleur du fond)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let dy = -1; dy <= 1 && !on; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && raw[ny * w + nx]) {
            on = 1
            break
          }
        }
      }
      mask[y * w + x] = on
    }
  }

  // Tout ce qui n'est pas relié au bord par du « fond » appartient à la carte (intérieur comblé)
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seed(y * w)
    seed(y * w + w - 1)
  }
  while (stack.length) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i - x) / w
    if (x > 0) seed(i - 1)
    if (x < w - 1) seed(i + 1)
    if (y > 0) seed(i - w)
    if (y < h - 1) seed(i + w)
  }

  // Plus grande forme pleine
  const label = new Int32Array(w * h)
  let best = { id: 0, size: 0 }
  let nextId = 0
  for (let start = 0; start < w * h; start++) {
    if (outside[start] || label[start]) continue
    nextId++
    let size = 0
    label[start] = nextId
    stack.push(start)
    while (stack.length) {
      const i = stack.pop() as number
      size++
      const x = i % w
      const y = (i - x) / w
      const visit = (j: number) => {
        if (!outside[j] && !label[j]) {
          label[j] = nextId
          stack.push(j)
        }
      }
      if (x > 0) visit(i - 1)
      if (x < w - 1) visit(i + 1)
      if (y > 0) visit(i - w)
      if (y < h - 1) visit(i + w)
    }
    if (size > best.size) best = { id: nextId, size }
  }
  if (!best.id || best.size < w * h * 0.08 || best.size > w * h * 0.97) return null

  // Boîte englobante robuste : on ignore les lignes/colonnes presque vides (ombres, bavures)
  const rows = new Int32Array(h)
  const cols = new Int32Array(w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] === best.id) {
        rows[y]++
        cols[x]++
      }
    }
  }
  const maxRow = Math.max(...rows)
  const maxCol = Math.max(...cols)
  const first = (arr: Int32Array, min: number) => arr.findIndex((v) => v >= min)
  const last = (arr: Int32Array, min: number) => {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= min) return i
    return -1
  }
  const top = first(rows, maxRow * 0.2)
  const bottom = last(rows, maxRow * 0.2)
  const left = first(cols, maxCol * 0.2)
  const right = last(cols, maxCol * 0.2)
  if (top < 0 || left < 0 || bottom <= top || right <= left) return null

  let boxW = (right - left + 1) / k
  let boxH = (bottom - top + 1) / k
  const cx = ((left + right + 1) / 2) / k
  const cy = ((top + bottom + 1) / 2) / k

  // Une carte est en portrait : une forme très éloignée de ce format n'est pas fiable
  const aspect = boxW / boxH
  if (aspect < 0.45 || aspect > 1.15) return null
  if ((boxW * boxH) / (nw * nh) < 0.1) return null

  // Ramène la boîte au format exact d'une carte puis rentre légèrement à l'intérieur
  if (aspect > CARD_RATIO) boxH = boxW / CARD_RATIO
  else boxW = boxH * CARD_RATIO
  boxW *= 1 - INSET * 2
  boxH *= 1 - INSET * 2

  return { cx, cy, width: Math.min(boxW, nw), height: Math.min(boxH, nh) }
}
