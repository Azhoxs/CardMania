'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Check, Crop, Wand2, ZoomIn } from 'lucide-react'
import { detectCardRect, type CardRect } from '@/lib/detectCard'
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
  startPoint?: Point
  startDistance?: number
}

// Une carte fait 63 × 88 mm. On exporte à 20 px/mm : plus net que n'importe quel écran de téléphone.
const CARD_RATIO = 63 / 88
const EXPORT_WIDTH = 1260
const EXPORT_HEIGHT = 1760
const EXPORT_QUALITY = 0.92
const MAX_ZOOM = 8

/**
 * Réduit l'image par paliers (÷2 à chaque passe) avant le rendu final.
 * Un seul drawImage depuis une photo de 4000 px vers 1260 px donne un résultat
 * crénelé, surtout sur Safari. Les paliers gardent les fins détails (texte, hologrammes).
 */
function drawDownscaled(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
): HTMLCanvasElement {
  let source: CanvasImageSource = img
  let cx = sx
  let cy = sy
  let cw = sw
  let ch = sh

  while (cw > outW * 2) {
    const nw = Math.max(outW, Math.round(cw / 2))
    const nh = Math.max(outH, Math.round(ch / 2))
    const step = document.createElement('canvas')
    step.width = nw
    step.height = nh
    const stepCtx = step.getContext('2d')
    if (!stepCtx) break
    stepCtx.imageSmoothingEnabled = true
    stepCtx.imageSmoothingQuality = 'high'
    stepCtx.drawImage(source, cx, cy, cw, ch, 0, 0, nw, nh)
    source = step
    cx = 0
    cy = 0
    cw = nw
    ch = nh
  }

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, cx, cy, cw, ch, 0, 0, outW, outH)
  }
  return out
}

export default function CardCropperModal({ image, onCancel, onConfirm }: CardCropperModalProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)
  // undefined = analyse en cours, null = carte non détectée
  const [detected, setDetected] = useState<CardRect | null | undefined>(undefined)
  const [autoMode, setAutoMode] = useState(true)
  const isAuto = autoMode && !!detected

  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureRef = useRef<GestureState>({
    mode: 'none',
    startOffset: { x: 0, y: 0 },
    startScale: 1,
  })

  // Échelle qui fait « couvrir » exactement le cadre par la photo
  const baseScale =
    naturalSize && frameSize
      ? Math.max(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height)
      : 1
  const displayScale = baseScale * scale

  const clampOffset = (point: Point, nextScale: number): Point => {
    if (!naturalSize || !frameSize) return point
    const ds = baseScale * nextScale
    const maxX = Math.max(0, (naturalSize.width * ds - frameSize.width) / 2)
    const maxY = Math.max(0, (naturalSize.height * ds - frameSize.height) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, point.x)),
      y: Math.min(maxY, Math.max(-maxY, point.y)),
    }
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setAutoMode(true)
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

  // Rognage automatique : place la carte détectée pile dans le cadre
  useEffect(() => {
    if (!autoMode || !detected || !naturalSize || !frameSize) return
    const next = Math.min(MAX_ZOOM, Math.max(1, frameSize.width / detected.width / baseScale))
    const ds = baseScale * next
    setScale(next)
    setOffset(
      clampOffset(
        { x: (naturalSize.width / 2 - detected.cx) * ds, y: (naturalSize.height / 2 - detected.cy) * ds },
        next,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, detected, naturalSize, frameSize])

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
    if (!frameRef.current || isAuto) return
    frameRef.current.setPointerCapture(e.pointerId)
    const p = { x: e.clientX, y: e.clientY }
    updatePointer(e.pointerId, p)

    const pointers = Array.from(pointersRef.current.values())

    if (pointers.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startOffset: { ...offset },
        startScale: scale,
        startPoint: p,
      }
    } else if (pointers.length === 2) {
      const [p1, p2] = pointers
      gestureRef.current = {
        mode: 'pinch',
        startOffset: { ...offset },
        startScale: scale,
        startDistance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
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
        ),
      )
    } else if (gesture.mode === 'pinch' && pointers.length >= 2 && gesture.startDistance) {
      const [p1, p2] = pointers
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const nextScale = Math.min(MAX_ZOOM, Math.max(1, gesture.startScale * (distance / gesture.startDistance)))
      setScale(nextScale)
      setOffset((prev) => clampOffset(prev, nextScale))
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
      gestureRef.current = { mode: 'none', startOffset: { ...offset }, startScale: scale }
    } else if (pointers.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startOffset: { ...offset },
        startScale: scale,
        startPoint: pointers[0],
      }
    }
  }

  const applyZoom = (next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next))
    setScale(clamped)
    setOffset((prev) => clampOffset(prev, clamped))
  }

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || !naturalSize || !frameSize) return
    setExporting(true)

    // Laisse le temps d'afficher l'état « en cours » avant le calcul lourd
    setTimeout(() => {
      // Zone du cadre exprimée dans les pixels de la photo d'origine
      const sourceW = frameSize.width / displayScale
      const sourceH = frameSize.height / displayScale
      const sourceX = Math.min(
        naturalSize.width - sourceW,
        Math.max(0, naturalSize.width / 2 - offset.x / displayScale - sourceW / 2),
      )
      const sourceY = Math.min(
        naturalSize.height - sourceH,
        Math.max(0, naturalSize.height / 2 - offset.y / displayScale - sourceH / 2),
      )

      const canvas = drawDownscaled(img, sourceX, sourceY, sourceW, sourceH, EXPORT_WIDTH, EXPORT_HEIGHT)
      onConfirm(canvas.toDataURL('image/jpeg', EXPORT_QUALITY))
    }, 30)
  }

  return (
    <Sheet
      onClose={onCancel}
      title="Cadre ta carte"
      subtitle={
        isAuto
          ? 'Ta carte a été rognée automatiquement.'
          : 'Glisse pour déplacer, pince ou utilise le curseur pour zoomer.'
      }
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
          className={`card-frame w-full max-w-[min(300px,calc(46dvh*0.716))] touch-none ${isAuto ? '' : 'cursor-grab active:cursor-grabbing'}`}
          style={{ aspectRatio: String(CARD_RATIO) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(e: ReactWheelEvent<HTMLDivElement>) => {
            if (isAuto) return
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
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* Repères en tiers pour bien aligner la carte (manuel uniquement) */}
          <div className="pointer-events-none absolute inset-0 rounded-card ring-2 ring-inset ring-white/90">
            {!isAuto && (
              <>
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
              </>
            )}
          </div>
        </div>

        {isAuto ? (
          <button type="button" onClick={() => setAutoMode(false)} className="btn-secondary w-full max-w-[300px]">
            <Crop className="h-5 w-5" />
            Recadrer manuellement
          </button>
        ) : (
          <>
            {detected === null && (
              <p className="w-full max-w-[300px] text-center text-sm text-ink-500">
                La carte n&apos;a pas pu être détectée automatiquement : cadre-la à la main.
              </p>
            )}
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
            {detected && (
              <button type="button" onClick={() => setAutoMode(true)} className="btn-secondary w-full max-w-[300px]">
                <Wand2 className="h-5 w-5" />
                Rognage automatique
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
