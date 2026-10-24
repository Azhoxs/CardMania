'use client'

import { useEffect } from 'react'
import { Check } from 'lucide-react'

export type CelebrationEvent = {
  id: number
}

const CONFETTI_COLORS = ['#ffcf33', '#2fd48a', '#ff6b9a', '#ffffff', '#7d98ff']

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 97) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confetti-fall ${1.8 + (i % 5) * 0.3}s ${(i % 7) * 0.08}s linear both`,
          }}
        />
      ))}
    </div>
  )
}

/** Petit moment de récompense à chaque carte ajoutée : confettis et message. */
export default function Celebration({
  event,
  onDone,
}: {
  event: CelebrationEvent | null
  onDone: () => void
}) {
  useEffect(() => {
    if (!event) return
    const timer = window.setTimeout(onDone, 2400)
    return () => window.clearTimeout(timer)
  }, [event, onDone])

  if (!event) return null

  return (
    <>
      <Confetti key={event.id} />
      <div
        className="pointer-events-none fixed left-1/2 z-[90] flex items-center gap-2 rounded-2xl border-b-4 border-mint-700 bg-mint-500 px-5 py-3 font-display text-base font-bold text-white shadow-lift"
        style={{
          bottom: 'calc(104px + env(safe-area-inset-bottom))',
          animation: 'toast-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
        role="status"
      >
        <Check className="h-5 w-5" strokeWidth={3} />
        Carte ajoutée à ta collection !
      </div>
    </>
  )
}
