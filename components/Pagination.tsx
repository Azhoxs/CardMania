'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

/** 1 … 4 5 6 … 12 : toujours la première, la dernière et les voisines de la page courante */
function pageItems(page: number, totalPages: number): (number | 'gap-left' | 'gap-right')[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  const numbers = Array.from(wanted)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b)

  const items: (number | 'gap-left' | 'gap-right')[] = []
  numbers.forEach((n, index) => {
    if (index > 0 && n - numbers[index - 1] > 1) items.push(index === 1 ? 'gap-left' : 'gap-right')
    items.push(n)
  })
  return items
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn-icon disabled:pointer-events-none disabled:opacity-40"
        aria-label="Page précédente"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {pageItems(page, totalPages).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            className={`h-12 min-w-12 rounded-2xl border-2 border-b-4 px-2 font-display text-sm font-bold tabular-nums transition-[transform,background-color] duration-100 active:translate-y-[2px] active:border-b-2 ${
              item === page
                ? 'border-brand-700 bg-brand-500 text-white'
                : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
            }`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="flex h-12 w-6 items-end justify-center pb-3 font-bold text-ink-400" aria-hidden>
            …
          </span>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="btn-icon disabled:pointer-events-none disabled:opacity-40"
        aria-label="Page suivante"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  )
}
