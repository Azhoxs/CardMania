'use client'

/** Interrupteur : toute la ligne est cliquable, l'état est lisible sans couleur (texte Oui / Non). */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[60px] w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold text-ink-900">{label}</span>
        {description && <span className="block text-sm text-ink-500">{description}</span>}
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </span>
    </button>
  )
}

/** Choix entre 2 à 3 options, visibles en permanence. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-ink-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-[44px] flex-1 rounded-full px-3 text-sm font-semibold transition ${
            value === option.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Petit repère de type : jaune = Pokémon, bleu = Topps / Panini. */
export function TypeDot({ type }: { type: 'pokemon' | 'topps' }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full ${type === 'topps' ? 'bg-brand-500' : 'bg-sun-400'}`}
    />
  )
}

export const typeLabel = (type: 'pokemon' | 'topps') => (type === 'topps' ? 'Topps / Panini' : 'Pokémon')
