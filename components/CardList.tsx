'use client'

import { Card } from '@/lib/supabase'
import { ChevronRight } from 'lucide-react'
import { TypeDot } from './FormBits'
import { formatPrice, groupCards } from './CardGrid'

interface CardListProps {
  cards: Card[]
  onPreview: (card: Card) => void
  groupByClub?: boolean
}

const formatDate = (value: string | null) => {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CardList({ cards, onPreview, groupByClub }: CardListProps) {
  const groups = groupCards(cards, groupByClub)

  return (
    <div className="space-y-8">
      {groups.map(({ label, cards: list }) => (
        <section key={label || 'all'}>
          {groupByClub && (
            <h2 className="mb-3 font-display text-base font-bold text-ink-900">
              {label}
              <span className="ml-2 font-sans text-sm font-semibold text-ink-500">{list.length}</span>
            </h2>
          )}
          <ul className="grid gap-px overflow-hidden rounded-3xl bg-ink-100 ring-1 ring-ink-100 lg:grid-cols-2">
            {list.map((card) => {
              const price = card.purchase_price == null ? null : Number(card.purchase_price)
              const date = formatDate(card.purchase_date)
              const extras: string[] = []
              if (card.is_signed) extras.push('Signée')
              if (card.is_numbered) extras.push(card.numbering || 'Numérotée')
              if (card.is_special) extras.push('Spéciale')
              return (
                <li key={card.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => onPreview(card)}
                    className="flex min-h-[88px] w-full items-center gap-4 p-3 text-left transition hover:bg-ink-50 active:bg-ink-100"
                  >
                    <div className="card-frame w-14 shrink-0 shadow-sm">
                      {card.main_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.main_image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-ink-900">{card.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-500">
                        <TypeDot type={card.card_type} />
                        <span className="truncate">
                          {card.series}
                          {card.card_type === 'topps' && card.club?.trim() ? ` · ${card.club.trim()}` : ''}
                        </span>
                      </p>
                      {(extras.length > 0 || date) && (
                        <p className="mt-0.5 truncate text-sm text-ink-500">
                          {[...extras, date].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-ink-900">{formatPrice(price)}</p>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
