'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import Sheet from './Sheet'
import type { Card } from '@/lib/supabase'

interface EbayItem {
  id: string
  title: string
  price: { value: string; currency: string } | null
  imageUrl: string | null
  itemWebUrl: string
  condition: string | null
}

interface EbayPriceModalProps {
  card: Card
  onClose: () => void
}

export default function EbayPriceModal({ card, onClose }: EbayPriceModalProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading')
  const [items, setItems] = useState<EbayItem[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  const runSearch = async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/ebay/search-by-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: card.main_image_url }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data?.error || "La recherche eBay a échoué.")
        setStatus('error')
        return
      }

      setItems(data.items || [])
      setStatus('done')
    } catch (error) {
      setErrorMessage("Impossible de contacter eBay. Vérifie ta connexion.")
      setStatus('error')
    }
  }

  useEffect(() => {
    if (card.main_image_url) {
      runSearch()
    } else {
      setStatus('error')
      setErrorMessage("Cette carte n'a pas de photo, impossible de faire une recherche eBay.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatPrice = (price: EbayItem['price']) => {
    if (!price) return '—'
    const value = Number(price.value)
    if (Number.isNaN(value)) return '—'
    try {
      return value.toLocaleString('fr-FR', {
        style: 'currency',
        currency: price.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    } catch {
      return `${value} ${price.currency}`
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title="Prix sur eBay"
      subtitle={card.name}
      z="z-[60]"
    >
      <div className="space-y-4 pt-1">
        <p className="rounded-2xl bg-ink-50 p-4 text-sm leading-relaxed text-ink-500">
          Annonces en vente en ce moment, proches de ta photo. Ce sont les prix demandés par les vendeurs, pas des ventes
          conclues.
        </p>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12 text-ink-500">
            <RefreshCw className="h-7 w-7 animate-spin" />
            <p>Recherche en cours…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-danger-600">{errorMessage}</p>
            {card.main_image_url && (
              <button onClick={runSearch} className="btn-primary">
                Réessayer
              </button>
            )}
          </div>
        )}

        {status === 'done' && items.length === 0 && (
          <p className="py-12 text-center text-ink-500">Aucune annonce similaire pour le moment.</p>
        )}

        {status === 'done' && items.length > 0 && (
          <ul className="divide-y divide-ink-100">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.itemWebUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[88px] items-center gap-4 py-3 transition active:opacity-70"
                >
                  <div className="card-frame w-14 shrink-0 shadow-sm">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">{item.title}</p>
                    {item.condition && <p className="mt-0.5 text-xs text-ink-500">{item.condition}</p>}
                    <p className="mt-1 font-display text-base font-bold tabular-nums text-ink-900">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <ExternalLink className="h-5 w-5 shrink-0 text-ink-400" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
