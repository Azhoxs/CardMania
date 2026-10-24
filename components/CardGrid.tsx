'use client'

import Image from 'next/image'
import { Card } from '@/lib/supabase'
import { TypeDot } from './FormBits'

export type GridLayout = 'gallery' | 'binder'

interface CardGridProps {
  cards: Card[]
  layout: GridLayout
  onPreview: (card: Card) => void
  groupByClub?: boolean
}

const POCKETS_PER_PAGE = 9

export const formatPrice = (price: number | null) =>
  price == null
    ? '—'
    : price.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })

export function groupCards(cards: Card[], groupByClub?: boolean) {
  if (!groupByClub) return [{ label: '', cards }]
  const map = new Map<string, Card[]>()
  for (const card of cards) {
    const label = card.club?.trim() || 'Sans club'
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(card)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a === 'Sans club' ? 1 : b === 'Sans club' ? -1 : a.localeCompare(b)))
    .map(([label, groupCards]) => ({ label, cards: groupCards }))
}

function CardImage({ card }: { card: Card }) {
  return card.main_image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.main_image_url}
      alt={card.name}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-ink-100">
      <Image src="/assets/Favicon.png" alt="" width={72} height={72} className="h-[45%] w-[45%] object-contain opacity-40" />
    </div>
  )
}

export default function CardGrid({ cards, layout, onPreview, groupByClub }: CardGridProps) {
  const groups = groupCards(cards, groupByClub)

  return (
    <div className="space-y-10">
      {groups.map(({ label, cards: groupCardsList }) => (
        <section key={label || 'all'}>
          {groupByClub && (
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">
              {label}
              <span className="ml-2 font-sans text-sm font-semibold text-ink-500">{groupCardsList.length}</span>
            </h2>
          )}

          {layout === 'gallery' ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {groupCardsList.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onPreview(card)}
                    className="card-tile group block w-full rounded-card text-left transition duration-300 hover:-translate-y-2 active:scale-[0.97]"
                    aria-label={`${card.name}, ${card.series}. Voir le détail`}
                  >
                    <div className="card-frame card-shine ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-lift">
                      <CardImage card={card} />
                      {(card.quantity || 1) > 1 && (
                        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-ink-900/85 px-2 text-xs font-extrabold text-white">
                          ×{card.quantity}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            // Classeur : des pages de 3 × 3 pochettes, comme un vrai classeur
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: Math.ceil(groupCardsList.length / POCKETS_PER_PAGE) }).map((_, pageIndex) => {
                const pageCards = groupCardsList.slice(pageIndex * POCKETS_PER_PAGE, (pageIndex + 1) * POCKETS_PER_PAGE)
                return (
                  <div key={pageIndex}>
                    <p className="mb-2 px-1 text-sm font-semibold text-ink-500">Page {pageIndex + 1}</p>
                    <ul className="grid grid-cols-3 gap-2 rounded-[28px] bg-ink-200/70 p-2.5 sm:gap-3 sm:p-4">
                      {pageCards.map((card) => (
                        <li key={card.id}>
                          <button
                            type="button"
                            onClick={() => onPreview(card)}
                            className="card-tile block w-full rounded-2xl bg-white/70 p-1.5 ring-1 ring-inset ring-white transition active:scale-95 hover:bg-white sm:p-2"
                            aria-label={`Ouvrir ${card.name}`}
                          >
                            <div className="card-frame card-shine">
                              <CardImage card={card} />
                            </div>
                          </button>
                        </li>
                      ))}
                      {/* Pochettes vides pour garder la page entière */}
                      {Array.from({ length: POCKETS_PER_PAGE - pageCards.length }).map((__, i) => (
                        <li key={`empty-${i}`} aria-hidden>
                          <div className="rounded-2xl bg-white/30 p-1.5 sm:p-2">
                            <div className="aspect-[63/88] rounded-card" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
