'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Check, RotateCw, ZoomIn } from 'lucide-react'
import { detectCardRect } from '@/lib/detectCard'
import Sheet from './Sheet'

interface CardCropperModalProps {
  /** URL de la photo ORIGINALE (object URL), jamais une version déjà compressée. */
  image: string
  onCancel: () => void
  onConfirm: (croppedDataUrl: string) => void
}

interface Point {
  x: number
  y: number
}

interface GestureState {
  mode: 'none' | 'pan' | 'pinch'
  startOffset: Point
  startScale: number
  startRotation: number
  startPoint?: Point
  startDistance?: number
  startAngle?: number
}

// Une carte fait 63 × 88 mm. On exporte à 20 px/mm : plus net que n'importe quel écran de téléphone.
const CARD_RATIO = 63 / 88
const EXPORT_WIDTH = 1260
const EXPORT_HEIGHT = 1760
const EXPORT_QUALITY = 0.92
const MAX_ZOOM = 8
const MAX_ROTATION = 45

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Ramène un angle en degrés dans [-180, 180]. */
const normalizeDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

/**
 * Dessine la zone cadrée (zoom, déplacement, rotation) dans un canvas de sortie.
 * L'image est d'abord réduite par paliers (÷2 à chaque passe) : un seul drawImage depuis
 * une photo de 4000 px vers 1260 px donne un résultat crénelé, surtout sur Safari.
 */
function renderCrop(
  img: HTMLImageElement,
  displayScale: number,
  offset: Point,
  rotation: number,
  frameWidth: number,
): HTMLCanvasElement {
  const factor = EXPORT_WIDTH / frameWidth
  let source: CanvasImageSource = img
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  let shrink = 1

  while (displayScale * factor * shrink < 0.5) {
    const nw = Math.max(1, Math.round(sw / 2))
    const nh = Math.max(1, Math.round(sh / 2))
    const step = document.createElement('canvas')
    step.width = nw
    step.height = nh
    const stepCtx = step.getContext('2d')
    if (!stepCtx) break
    stepCtx.imageSmoothingEnabled = true
    stepCtx.imageSmoothingQuality = 'high'
    stepCtx.drawImage(source, 0, 0, sw, sh, 0, 0, nw, nh)
    source = step
    shrink *= 2
    sw = nw
    sh = nh
  }

  const out = document.createElement('canvas')
  out.width = EXPORT_WIDTH
  out.height = EXPORT_HEIGHT
  const ctx = out.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(EXPORT_WIDTH / 2, EXPORT_HEIGHT / 2)
    ctx.scale(factor, factor)
    ctx.translate(offset.x, offset.y)
    ctx.rotate(toRad(rotation))
    ctx.scale(displayScale * shrink, displayScale * shrink)
    ctx.translate(-sw / 2, -sh / 2)
    ctx.drawImage(source, 0, 0)
  }
  return out
}

export default function CardCropperModal({ image, onCancel, onConfirm }: CardCropperModalProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)

  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureRef = useRef<GestureState>({
    mode: 'none',
    startOffset: { x: 0, y: 0 },
    startScale: 1,
    startRotation: 0,
  })

  // Échelle qui fait « couvrir » exactement le cadre par la photo, sans rotation
  const baseScale =
    naturalSize && frameSize
      ? Math.max(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height)
      : 1
  const displayScale = baseScale * scale

  /** Demi-dimensions du cadre vu depuis le repère de l'image tournée. */
  const frameExtent = (rot: number) => {
    const c = Math.abs(Math.cos(toRad(rot)))
    const s = Math.abs(Math.sin(toRad(rot)))
    const fw = frameSize?.width ?? 0
    const fh = frameSize?.height ?? 0
    return { ex: (fw / 2) * c + (fh / 2) * s, ey: (fw / 2) * s + (fh / 2) * c }
  }

  /** Zoom minimal pour que la photo, une fois tournée, couvre tout le cadre. */
  const minScaleFor = (rot: number) => {
    if (!naturalSize || !frameSize) return 1
    const { ex, ey } = frameExtent(rot)
    return Math.max(1, ((2 * ex) / naturalSize.width / baseScale), ((2 * ey) / naturalSize.height / baseScale))
  }

  /** Garde la photo (tournée) alignée sur tout le cadre : aucun bord vide n'apparaît. */
  const clampOffset = (point: Point, nextScale: number, rot: number): Point => {
    if (!naturalSize || !frameSize) return point
    const ds = baseScale * nextScale
    const { ex, ey } = frameExtent(rot)
    const maxX = Math.max(0, (naturalSize.width * ds) / 2 - ex)
    const maxY = Math.max(0, (naturalSize.height * ds) / 2 - ey)
    // L'offset est exprimé à l'écran : on le passe dans le repère de l'image, on borne, puis on revient
    const a = toRad(rot)
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const ox = point.x * cos + point.y * sin
    const oy = -point.x * sin + point.y * cos
    const cx = Math.min(maxX, Math.max(-maxX, ox))
    const cy = Math.min(maxY, Math.max(-maxY, oy))
    return { x: cx * cos - cy * sin, y: cx * sin + cy * cos }
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setScale(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setDetected(detectCardRect(img))
    }
    img.src = image
  }, [image])

  useEffect(() => {
    const measure = () => {
      if (!frameRef.current) return
      setFrameSize({
        width: frameRef.current.clientWidth,
        height: frameRef.current.clientHeight,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Placement de départ : la carte détectée remplit le cadre, ensuite tout reste ajustable à la main
  const [detected, setDetected] = useState<ReturnType<typeof detectCardRect> | undefined>(undefined)
  const placedRef = useRef(false)
  useEffect(() => {
    if (placedRef.current || !detected || !naturalSize || !frameSize) return
    placedRef.current = true
    const next = Math.min(MAX_ZOOM, Math.max(1, frameSize.width / detected.width / baseScale))
    const ds = baseScale * next
    setScale(next)
    setOffset(
      clampOffset(
        { x: (naturalSize.width / 2 - detected.cx) * ds, y: (naturalSize.height / 2 - detected.cy) * ds },
        next,
        0,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected, naturalSize, frameSize])

  const updatePointer = (id: number, point: Point) => {
    const next = new Map(pointersRef.current)
    next.set(id, point)
    pointersRef.current = next
  }

  const removePointer = (id: number) => {
    const next = new Map(pointersRef.current)
    next.delete(id)
    pointersRef.current = next
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return
    frameRef.current.setPointerCapture(e.pointerId)
    const p = { x: e.clientX, y: e.clientY }
    updatePointer(e.pointerId, p)

    const pointers = Array.from(pointersRef.current.values())

    if (pointers.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startOffset: { ...offset },
        startScale: scale,
        startRotation: rotation,
        startPoint: p,
      }
    } else if (pointers.length === 2) {
      const [p1, p2] = pointers
      gestureRef.current = {
        mode: 'pinch',
        startOffset: { ...offset },
        startScale: scale,
        startRotation: rotation,
        startDistance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        startAngle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      }
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return
    if (pointersRef.current.size === 0) return

    const p = { x: e.clientX, y: e.clientY }
    updatePointer(e.pointerId, p)

    const gesture = gestureRef.current
    const pointers = Array.from(pointersRef.current.values())

    if (gesture.mode === 'pan' && gesture.startPoint && pointers.length === 1) {
      setOffset(
        clampOffset(
          {
            x: gesture.startOffset.x + (p.x - gesture.startPoint.x),
            y: gesture.startOffset.y + (p.y - gesture.startPoint.y),
          },
          scale,
          rotation,
        ),
      )
    } else if (gesture.mode === 'pinch' && pointers.length >= 2 && gesture.startDistance) {
      const [p1, p2] = pointers
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const deltaDeg = ((angle - (gesture.startAngle ?? angle)) * 180) / Math.PI
      const nextRotation = Math.min(
        MAX_ROTATION,
        Math.max(-MAX_ROTATION, normalizeDeg(gesture.startRotation + deltaDeg)),
      )
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(minScaleFor(nextRotation), gesture.startScale * (distance / gesture.startDistance)),
      )
      setRotation(nextRotation)
      setScale(nextScale)
      setOffset((prev) => clampOffset(prev, nextScale, nextRotation))
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return
    if (frameRef.current.hasPointerCapture(e.pointerId)) {
      frameRef.current.releasePointerCapture(e.pointerId)
    }
    removePointer(e.pointerId)

    const pointers = Array.from(pointersRef.current.values())
    if (pointers.length === 0) {
      gestureRef.current = { mode: 'none', startOffset: { ...offset }, startScale: scale, startRotation: rotation }
    } else if (pointers.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startOffset: { ...offset },
        startScale: scale,
        startRotation: rotation,
        startPoint: pointers[0],
      }
    }
  }

  const applyZoom = (next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(minScaleFor(rotation), next))
    setScale(clamped)
    setOffset((prev) => clampOffset(prev, clamped, rotation))
  }

  const applyRotation = (next: number) => {
    const clamped = Math.min(MAX_ROTATION, Math.max(-MAX_ROTATION, next))
    const nextScale = Math.min(MAX_ZOOM, Math.max(minScaleFor(clamped), scale))
    setRotation(clamped)
    setScale(nextScale)
    setOffset((prev) => clampOffset(prev, nextScale, clamped))
  }

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || !naturalSize || !frameSize) return
    setExporting(true)

    // Laisse le temps d'afficher l'état « en cours » avant le calcul lourd
    setTimeout(() => {
      const canvas = renderCrop(img, displayScale, offset, rotation, frameSize.width)
      onConfirm(canvas.toDataURL('image/jpeg', EXPORT_QUALITY))
    }, 30)
  }

  return (
    <Sheet
      onClose={onCancel}
      title="Cadre ta carte"
      subtitle="Glisse pour déplacer, pince pour zoomer, tourne avec deux doigts pour redresser."
      z="z-[80]"
      size="sm"
      dismissOnBackdrop={false}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exporting || !naturalSize}
            className="btn-primary flex-[1.4]"
          >
            <Check className="h-5 w-5" />
            {exporting ? 'Traitement…' : 'Valider le cadrage'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-5 pt-2">
        <div
          ref={frameRef}
          className="card-frame w-full max-w-[min(300px,calc(46dvh*0.716))] cursor-grab touch-none active:cursor-grabbing"
          style={{ aspectRatio: String(CARD_RATIO) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(e: ReactWheelEvent<HTMLDivElement>) => {
            const factor = 1 + -e.deltaY * 0.0015
            if (!Number.isFinite(factor) || factor <= 0) return
            applyZoom(scale * factor)
          }}
        >
          {naturalSize && frameSize && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt="Photo à cadrer"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
              style={{
                width: naturalSize.width * displayScale,
                height: naturalSize.height * displayScale,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
              }}
            />
          )}
          {/* Repères en tiers pour bien aligner la carte */}
          <div className="pointer-events-none absolute inset-0 rounded-card ring-2 ring-inset ring-white/90">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
          </div>
        </div>

        <label className="flex w-full max-w-[300px] items-center gap-3 text-ink-500">
          <ZoomIn className="h-5 w-5 shrink-0" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={scale}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="h-11 w-full accent-[#2b4eff]"
            aria-label="Zoom"
          />
        </label>

        <label className="flex w-full max-w-[300px] items-center gap-3 text-ink-500">
          <RotateCw className="h-5 w-5 shrink-0" />
          <input
            type="range"
            min={-MAX_ROTATION}
            max={MAX_ROTATION}
            step={0.1}
            value={rotation}
            onChange={(e) => applyRotation(Number(e.target.value))}
            onDoubleClick={() => applyRotation(0)}
            className="h-11 w-full accent-[#2b4eff]"
            aria-label="Rotation"
          />
          <span className="w-10 shrink-0 text-right text-sm tabular-nums">{Math.round(rotation)}°</span>
        </label>
      </div>
    </Sheet>
  )
}
