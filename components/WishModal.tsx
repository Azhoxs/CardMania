'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { Wish } from '@/lib/supabase'
import Sheet from './Sheet'
import { Toggle, Segmented } from './FormBits'

interface WishModalProps {
  wish: Wish | null
  onClose: () => void
  onSave: (data: Partial<Wish>) => void
  /** Type présélectionné pour un nouveau souhait (type préféré du profil) */
  defaultCardType?: 'pokemon' | 'topps' | null
}

export default function WishModal({ wish, onClose, onSave, defaultCardType }: WishModalProps) {
  const [name, setName] = useState('')
  const [serie, setSerie] = useState('')
  const [cardType, setCardType] = useState<'pokemon' | 'topps'>(wish?.card_type ?? defaultCardType ?? 'pokemon')
  const [club, setClub] = useState('')
  const [isSigned, setIsSigned] = useState(false)
  const [isNumbered, setIsNumbered] = useState(false)
  const [numbering, setNumbering] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    if (!wish) return

    setName(wish.name)
    setSerie(wish.series)
    setCardType(wish.card_type)
    setClub(wish.club ?? '')
    setIsSigned(wish.is_signed)
    setIsNumbered(wish.is_numbered)
    setNumbering(wish.numbering ?? '')
    setIsSpecial(wish.is_special)
    setLinkUrl(wish.link_url)
  }, [wish])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: Partial<Wish> = {
      name,
      series: serie,
      card_type: cardType,
      club: cardType === 'topps' && club.trim() ? club.trim() : null,
      is_signed: isSigned,
      is_numbered: isNumbered,
      numbering: isNumbered ? numbering || null : null,
      is_special: isSpecial,
      link_url: linkUrl.trim(),
    }

    onSave(payload)
  }

  return (
    <Sheet
      onClose={onClose}
      title={wish ? 'Modifier le souhait' : 'Nouveau souhait'}
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button type="submit" form="wish-form" className="btn-primary flex-[1.4]">
            <Check className="h-5 w-5" />
            {wish ? 'Enregistrer' : 'Ajouter à mes souhaits'}
          </button>
        </div>
      }
    >
      <form id="wish-form" onSubmit={handleSubmit} className="space-y-5 pt-1">
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
          <label className="label" htmlFor="wish-name">Nom</label>
          <input
            id="wish-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            placeholder="Ex : Dracaufeu"
          />
        </div>

        <div>
          <label className="label" htmlFor="wish-series">Série</label>
          <input
            id="wish-series"
            type="text"
            required
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            className="field"
            placeholder="Ex : Évolutions"
          />
        </div>

        {cardType === 'topps' && (
          <>
            <div>
              <label className="label" htmlFor="wish-club">Club <span className="font-normal text-ink-500">(facultatif)</span></label>
              <input
                id="wish-club"
                type="text"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="field"
                placeholder="Ex : Marseille, PSG, Real Madrid…"
              />
            </div>
            <div className="divide-y divide-ink-100">
              <Toggle checked={isSigned} onChange={setIsSigned} label="Carte signée" />
              <Toggle checked={isNumbered} onChange={setIsNumbered} label="Carte numérotée" />
              {isNumbered && (
                <div className="py-3">
                  <label className="label" htmlFor="wish-numbering">Numérotation</label>
                  <input
                    id="wish-numbering"
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
          </>
        )}

        <div>
          <label className="label" htmlFor="wish-link">Lien de l&apos;annonce ou du visuel</label>
          <input
            id="wish-link"
            type="url"
            inputMode="url"
            required
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="field"
            placeholder="https://…"
          />
          <p className="hint">CardMarket, eBay, Google Images, YouTube… colle le lien que tu veux.</p>
        </div>
      </form>
    </Sheet>
  )
}
