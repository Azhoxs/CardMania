'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/lib/supabase'
import { Camera, ImagePlus, Check } from 'lucide-react'
import CardCropperModal from './CardCropperModal'
import Sheet from './Sheet'
import { Toggle, Segmented } from './FormBits'

interface CardModalProps {
  card: Card | null
  onClose: () => void
  onSave: (card: Partial<Card>) => void
  openCameraOnMount?: boolean
  /** Type présélectionné pour une nouvelle carte (type préféré du profil) */
  defaultCardType?: 'pokemon' | 'topps' | null
}

// Photos supplémentaires (hors cadrage) : on garde la résolution, on ne fait que borner la taille
const EXTRA_MAX_SIZE = 2400
const EXTRA_QUALITY = 0.92

export default function CardModal({
  card,
  onClose,
  onSave,
  openCameraOnMount,
  defaultCardType,
}: CardModalProps) {
  const [name, setName] = useState('')
  const [serie, setSerie] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [cardType, setCardType] = useState<'pokemon' | 'topps'>(card?.card_type ?? defaultCardType ?? 'pokemon')
  const [club, setClub] = useState('')
  const [isSigned, setIsSigned] = useState(false)
  const [isNumbered, setIsNumbered] = useState(false)
  const [numbering, setNumbering] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [imagePreview, setImagePreview] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [cropSource, setCropSource] = useState<{ url: string; file: File } | null>(null)
  const [pendingExtras, setPendingExtras] = useState<string[]>([])
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (card) {
      setName(card.name)
      setSerie(card.series)
      setPurchasePrice(card.purchase_price != null ? String(card.purchase_price) : '')
      setCardType(card.card_type)
      setClub(card.club ?? '')
      setIsSigned(card.is_signed)
      setIsNumbered(card.is_numbered)
      setNumbering(card.numbering || '')
      setIsSpecial(card.is_special)
      if (card.purchase_date) setPurchaseDate(card.purchase_date)
      if (card.images && card.images.length > 0) {
        setImages(card.images)
        setImagePreview(card.images[0] || '')
      } else if (card.main_image_url) {
        setImages([card.main_image_url])
        setImagePreview(card.main_image_url)
      }
    }
  }, [card])

  useEffect(() => {
    if (openCameraOnMount && cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }, [openCameraOnMount])

  // Libère l'object URL de la photo d'origine quand on a fini de la cadrer
  useEffect(() => {
    if (!cropSource) return
    const url = cropSource.url
    return () => URL.revokeObjectURL(url)
  }, [cropSource])

  /** Encode un fichier en JPEG de haute qualité, sans jamais le réduire plus que nécessaire. */
  const encodeFile = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { naturalWidth: width, naturalHeight: height } = img
        const longest = Math.max(width, height)
        if (longest > maxSize) {
          const ratio = maxSize / longest
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context unavailable'))
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', EXTRA_QUALITY))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Image load failed'))
      }
      img.src = url
    })
  }

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (files.length === 0) return

    const [first, ...others] = files

    // La première photo part telle quelle (fichier d'origine) vers le cadrage :
    // aucune recompression avant le recadrage final.
    setCropSource({ url: URL.createObjectURL(first), file: first })

    Promise.all(others.map((file) => encodeFile(file, EXTRA_MAX_SIZE)))
      .then(setPendingExtras)
      .catch(() => setPendingExtras([]))
  }

  const closeCropper = () => {
    setCropSource(null)
    setPendingExtras([])
  }

  const handleCropCancel = async () => {
    // Annuler le cadrage garde la photo entière plutôt que de la perdre
    const source = cropSource
    const extras = pendingExtras
    closeCropper()
    if (!source) return
    try {
      const full = await encodeFile(source.file, EXTRA_MAX_SIZE)
      setImages([full, ...extras])
      setImagePreview(full)
    } catch {
      /* photo illisible : on ne change rien */
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: Partial<Card> = {
      name,
      series: serie,
      card_type: cardType,
      club: cardType === 'topps' && club.trim() ? club.trim() : null,
      purchase_price: purchasePrice ? parseFloat(purchasePrice.replace(',', '.')) : 0,
      purchase_date: purchaseDate || null,
      is_signed: isSigned,
      is_numbered: isNumbered,
      numbering: isNumbered ? numbering : null,
      is_special: isSpecial,
      quantity: 1,
      main_image_url: imagePreview || null,
      images,
    }

    onSave(payload)
  }

  return (
    <>
      <Sheet
        onClose={() => {
          // Échap pendant le cadrage ne doit fermer que le cadrage
          if (!cropSource) onClose()
        }}
        title={card ? 'Modifier la carte' : 'Nouvelle carte'}
        size="lg"
        dismissOnBackdrop={false}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" form="card-form" className="btn-primary flex-[1.4]">
              <Check className="h-5 w-5" />
              {card ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        }
      >
        <form id="card-form" onSubmit={handleSubmit} className="space-y-8 pt-1">
          {/* Photo */}
          <section className="flex items-center gap-5">
            <div className="card-frame w-[38%] max-w-[170px] shrink-0">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Aperçu de la carte" className="h-full w-full object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => (cameraInputRef.current ?? galleryInputRef.current)?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-300 text-ink-500 transition hover:border-brand-500 hover:text-brand-600"
                  aria-label="Ajouter une photo"
                >
                  <Camera className="h-8 w-8" />
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImagesChange}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
                className="hidden"
              />
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn-primary w-full sm:hidden">
                <Camera className="h-5 w-5" />
                {imagePreview ? 'Reprendre' : 'Prendre une photo'}
              </button>
              <button type="button" onClick={() => galleryInputRef.current?.click()} className="btn-secondary w-full">
                <ImagePlus className="h-5 w-5" />
                {imagePreview ? 'Changer la photo' : 'Choisir une photo'}
              </button>
              <p className="hint">
                {images.length > 1
                  ? 'La première photo est le visuel principal, les autres restent dans la fiche.'
                  : 'À plat, bien éclairée, sans reflet : elle sera cadrée puis gardée en haute définition.'}
              </p>
            </div>
          </section>

          <section className="space-y-5">
            <h3 className="font-display text-sm font-bold text-ink-900">La carte</h3>
            <Segmented
              label="Type de carte"
              value={cardType}
              onChange={setCardType}
              options={[
                { value: 'pokemon', label: 'Pokémon' },
                { value: 'topps', label: 'Topps / Panini' },
              ]}
            />
            <div>
              <label className="label" htmlFor="card-name">Nom</label>
              <input
                id="card-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
                placeholder="Ex : Dracaufeu"
              />
            </div>
            <div>
              <label className="label" htmlFor="card-series">Série</label>
              <input
                id="card-series"
                type="text"
                required
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                className="field"
                placeholder="Ex : Évolutions"
              />
            </div>
            {cardType === 'topps' && (
              <div>
                <label className="label" htmlFor="card-club">Club <span className="font-normal text-ink-500">(facultatif)</span></label>
                <input
                  id="card-club"
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  className="field"
                  placeholder="Ex : Marseille, PSG, Real Madrid…"
                />
              </div>
            )}
          </section>

          <section className="space-y-5">
            <h3 className="font-display text-sm font-bold text-ink-900">L&apos;achat</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="card-price">Prix (€)</label>
                <input
                  id="card-price"
                  type="number"
                  inputMode="decimal"
                  required
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="field"
                  placeholder="25"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label" htmlFor="card-date">Date</label>
                <input
                  id="card-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="field"
                />
              </div>
            </div>
          </section>

          {cardType === 'topps' && (
            <section>
              <h3 className="mb-1 font-display text-sm font-bold text-ink-900">Particularités</h3>
              <div className="divide-y divide-ink-100">
                <Toggle checked={isSigned} onChange={setIsSigned} label="Carte signée" />
                <Toggle checked={isNumbered} onChange={setIsNumbered} label="Carte numérotée" />
                {isNumbered && (
                  <div className="py-3">
                    <label className="label" htmlFor="card-numbering">Numérotation</label>
                    <input
                      id="card-numbering"
                      type="text"
                      value={numbering}
                      onChange={(e) => setNumbering(e.target.value)}
                      className="field"
                      placeholder="Ex : 12/99"
                    />
                  </div>
                )}
                <Toggle
                  checked={isSpecial}
                  onChange={setIsSpecial}
                  label="Carte spéciale"
                  description="Refractor, patch, etc."
                />
              </div>
            </section>
          )}
        </form>
      </Sheet>

      {cropSource && (
        <CardCropperModal
          image={cropSource.url}
          onCancel={handleCropCancel}
          onConfirm={(cropped) => {
            setImages([cropped, ...pendingExtras])
            setImagePreview(cropped)
            closeCropper()
          }}
        />
      )}
    </>
  )
}
