'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, Check, Minus, Pencil, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useMonthlyBudget } from '@/lib/useMonthlyBudget'
import NavbarDesktop from './NavbarDesktop'
import NavbarMobile from './NavbarMobile'

type StatCard = {
  id: string
  name: string
  series: string
  card_type: 'pokemon' | 'topps'
  club: string | null
  purchase_price: number | null
  purchase_date: string | null
  quantity: number | null
  is_signed: boolean
  is_numbered: boolean
  is_special: boolean
}

type Period = 'month' | 'last_month' | '3m' | 'year' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: '3m', label: '3 mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Depuis le début' },
]

const PREVIOUS_LABEL: Record<Period, string> = {
  month: 'le mois dernier',
  last_month: 'le mois précédent',
  '3m': 'les 3 mois d’avant',
  year: 'la même période l’an dernier',
  all: '',
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const euro = (value: number) =>
  value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Numéro de mois absolu (année × 12 + mois), pour comparer sans se soucier des fuseaux horaires */
const monthKeyOf = (date: string | null): number | null => {
  if (!date) return null
  const [y, m] = date.split('-').map(Number)
  if (!y || !m) return null
  return y * 12 + (m - 1)
}

const spendOf = (card: StatCard) => (Number(card.purchase_price) || 0) * (card.quantity || 1)

export default function StatsClient() {
  const router = useRouter()
  const [cards, setCards] = useState<StatCard[] | null>(null)
  const [username, setUsername] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | undefined>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [topImages, setTopImages] = useState<Record<string, string>>({})
  const { budget, saveBudget } = useMonthlyBudget()
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)
      setUsername((user.user_metadata as any)?.username ?? user.email?.split('@')[0])

      const { data, error } = await supabase
        .from('cards')
        .select(
          'id,name,series,card_type,club,purchase_price,purchase_date,quantity,is_signed,is_numbered,is_special',
        )
        .eq('user_id', user.id)

      if (error) {
        setLoadError(error.message)
        setCards([])
        return
      }
      setCards((data as StatCard[]) ?? [])
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const stats = useMemo(() => {
    const list = cards ?? []
    const now = new Date()
    const current = now.getFullYear() * 12 + now.getMonth()

    // Plage de mois [début, fin] de la période choisie et de la période précédente
    const ranges: Record<Period, { range: [number, number] | null; previous: [number, number] | null }> = {
      month: { range: [current, current], previous: [current - 1, current - 1] },
      last_month: { range: [current - 1, current - 1], previous: [current - 2, current - 2] },
      '3m': { range: [current - 2, current], previous: [current - 5, current - 3] },
      year: {
        range: [now.getFullYear() * 12, current],
        previous: [now.getFullYear() * 12 - 12, current - 12],
      },
      all: { range: null, previous: null },
    }

    const inRange = (card: StatCard, range: [number, number] | null) => {
      if (!range) return true
      const key = monthKeyOf(card.purchase_date)
      return key !== null && key >= range[0] && key <= range[1]
    }

    const summarize = (range: [number, number] | null) => {
      const subset = list.filter((card) => inRange(card, range))
      const count = subset.reduce((sum, card) => sum + (card.quantity || 1), 0)
      const spent = subset.reduce((sum, card) => sum + spendOf(card), 0)
      return { count, spent, average: count > 0 ? spent / count : 0 }
    }

    const { range, previous } = ranges[period]
    const selected = summarize(range)
    const before = previous ? summarize(previous) : null

    // Histogramme : les 6 derniers mois, ou 12 pour les longues périodes
    const monthCount = period === 'year' || period === 'all' ? 12 : 6
    const bars = Array.from({ length: monthCount }).map((_, i) => {
      const key = current - (monthCount - 1 - i)
      const spent = list.reduce((sum, card) => (monthKeyOf(card.purchase_date) === key ? sum + spendOf(card) : sum), 0)
      const highlighted = range ? key >= range[0] && key <= range[1] : true
      return { key, label: MONTHS_SHORT[((key % 12) + 12) % 12], spent, highlighted, isCurrent: key === current }
    })

    const thisMonthSpent = list.reduce(
      (sum, card) => (monthKeyOf(card.purchase_date) === current ? sum + spendOf(card) : sum),
      0,
    )

    // Cartes de la période pour les classements
    const periodCards = list.filter((card) => inRange(card, range))
    const bySeries = new Map<string, number>()
    for (const card of periodCards) bySeries.set(card.series, (bySeries.get(card.series) ?? 0) + spendOf(card))
    const topSeries = Array.from(bySeries.entries())
      .filter(([, spent]) => spent > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const topCards = [...periodCards]
      .filter((card) => (Number(card.purchase_price) || 0) > 0)
      .sort((a, b) => (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0))
      .slice(0, 5)

    const pokemonCount = periodCards.filter((c) => c.card_type === 'pokemon').reduce((s, c) => s + (c.quantity || 1), 0)
    const toppsCount = periodCards.filter((c) => c.card_type === 'topps').reduce((s, c) => s + (c.quantity || 1), 0)

    const totalCount = list.reduce((sum, card) => sum + (card.quantity || 1), 0)
    const totalSpent = list.reduce((sum, card) => sum + spendOf(card), 0)
    const undated = list.filter((card) => !card.purchase_date).length

    return {
      selected,
      before,
      bars,
      thisMonthSpent,
      topSeries,
      topCards,
      pokemonCount,
      toppsCount,
      totalCount,
      totalSpent,
      undated,
    }
  }, [cards, period])

  // Photos des 5 cartes les plus chères, chargées à part pour ne pas alourdir la page
  useEffect(() => {
    const ids = stats.topCards.map((card) => card.id).filter((id) => !(id in topImages))
    if (ids.length === 0) return
    supabase
      .from('cards')
      .select('id,main_image_url')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        setTopImages((prev) => {
          const next = { ...prev }
          for (const row of data as { id: string; main_image_url: string | null }[]) {
            if (row.main_image_url) next[row.id] = row.main_image_url
          }
          return next
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.topCards])

  const list = cards ?? []
  const loading = cards === null
  const delta = stats.before ? stats.selected.spent - stats.before.spent : null
  const maxBar = Math.max(1, ...stats.bars.map((bar) => bar.spent))

  const insight = (() => {
    if (loading || period === 'all' || !stats.before) return null
    const label = PREVIOUS_LABEL[period]
    if (stats.selected.spent === 0 && stats.before.spent === 0) {
      return { tone: 'neutral' as const, text: 'Aucune dépense sur cette période. Ton porte-monnaie respire !' }
    }
    if (stats.before.spent === 0) {
      return {
        tone: 'up' as const,
        text: `Tu as dépensé ${euro(stats.selected.spent)}, alors que tu n’avais rien dépensé ${label}.`,
      }
    }
    const pct = Math.round((Math.abs(delta!) / stats.before.spent) * 100)
    if (delta! > 0) {
      return { tone: 'up' as const, text: `Tu as dépensé ${euro(delta!)} de plus que ${label} (+${pct} %).` }
    }
    if (delta! < 0) {
      return { tone: 'down' as const, text: `Bien joué : ${euro(Math.abs(delta!))} de moins que ${label} (−${pct} %).` }
    }
    return { tone: 'neutral' as const, text: `Tu as dépensé exactement autant que ${label}.` }
  })()

  const budgetRatio = budget ? stats.thisMonthSpent / budget : 0
  const budgetTone = budgetRatio > 1 ? 'bg-pink-400' : budgetRatio >= 0.8 ? 'bg-sun-400' : 'bg-mint-400'

  const submitBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(budgetInput.replace(',', '.'))
    await saveBudget(value > 0 ? Math.round(value * 100) / 100 : null)
    setEditingBudget(false)
  }

  const pokemonShare =
    stats.pokemonCount + stats.toppsCount > 0
      ? Math.round((stats.pokemonCount / (stats.pokemonCount + stats.toppsCount)) * 100)
      : 0

  return (
    <div className="min-h-dvh md:pl-[264px]">
      <NavbarDesktop userName={username} userId={userId} onLogout={handleLogout} />

      <main className="mx-auto max-w-[1100px] px-5 pb-32 pt-[calc(5.5rem+env(safe-area-inset-top))] md:px-10 md:pb-16 md:pt-12">
        <header>
          <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
            Statistiques
          </h1>
          <p className="mt-2 text-base text-ink-500">Ta collection en chiffres et tes dépenses.</p>
        </header>

        {loadError && (
          <div role="alert" className="mt-6 rounded-3xl bg-danger-50 p-4 text-danger-600">
            Impossible de charger les statistiques : {loadError}
          </div>
        )}

        {/* Ma collection en chiffres */}
        <section
          className="relative mt-5 overflow-hidden rounded-[28px] border-b-[6px] border-brand-700 bg-brand-500 p-5 text-white md:p-6"
          aria-label="Ma collection en chiffres"
        >
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-600" />
          <div className="relative grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold text-white/80">Cartes</p>
              <p className="pop font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
                {loading ? '…' : stats.totalCount}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-white/80">Total investi</p>
              <p className="pop font-display text-4xl font-extrabold tabular-nums sm:text-5xl" style={{ animationDelay: '80ms' }}>
                {loading ? '…' : euro(stats.totalSpent)}
              </p>
            </div>
          </div>
        </section>

        {/* Dépenses */}
        <section className="mt-8" aria-labelledby="depenses">
          <h2 id="depenses" className="font-display text-lg font-extrabold text-ink-900">
            Mes dépenses
          </h2>

          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0" role="group" aria-label="Période">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="pill"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {insight && (
            <p
              className={`mt-4 rounded-2xl border-b-4 p-4 text-base font-bold ${
                insight.tone === 'up'
                  ? 'border-pink-400/50 bg-pink-100 text-pink-600'
                  : insight.tone === 'down'
                    ? 'border-mint-400/50 bg-mint-100 text-mint-700'
                    : 'border-ink-200 bg-white text-ink-700'
              }`}
              aria-live="polite"
            >
              {insight.text}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="tile p-4">
              <dt className="text-sm font-bold text-ink-500">Dépensé</dt>
              <dd className="mt-1 truncate font-display text-2xl font-extrabold tabular-nums text-ink-900">
                {loading ? '…' : euro(stats.selected.spent)}
              </dd>
              {delta !== null && !loading && (
                <dd
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    delta > 0
                      ? 'bg-pink-100 text-pink-600'
                      : delta < 0
                        ? 'bg-mint-100 text-mint-700'
                        : 'bg-ink-100 text-ink-500'
                  }`}
                >
                  {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {delta === 0 ? 'Stable' : `${delta > 0 ? '+' : '−'}${euro(Math.abs(delta))}`}
                </dd>
              )}
            </div>
            <div className="tile p-4">
              <dt className="text-sm font-bold text-ink-500">Cartes ajoutées</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-900">
                {loading ? '…' : stats.selected.count}
              </dd>
              {stats.before && !loading && (
                <dd className="mt-1.5 text-xs font-semibold text-ink-500">avant : {stats.before.count}</dd>
              )}
            </div>
            <div className="tile col-span-2 p-4 sm:col-span-1">
              <dt className="text-sm font-bold text-ink-500">Prix moyen par carte</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-900">
                {loading ? '…' : euro(stats.selected.average)}
              </dd>
            </div>
            <div className="tile col-span-2 p-4 sm:col-span-1">
              <dt className="text-sm font-bold text-ink-500">Cartes sans date d’achat</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-900">
                {loading ? '…' : stats.undated}
              </dd>
              <dd className="mt-1.5 text-xs font-semibold text-ink-500">Non comptées dans les mois</dd>
            </div>
          </dl>

          {/* Histogramme */}
          <div className="tile mt-4 p-4 sm:p-5">
            <h3 className="font-display text-base font-extrabold text-ink-900">Dépenses par mois</h3>
            <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-3" role="img" aria-label="Histogramme des dépenses par mois">
              {stats.bars.map((bar) => {
                const heightPct = bar.spent > 0 ? Math.max(4, (bar.spent / maxBar) * 100) : 0
                const showValue = stats.bars.length <= 6 || bar.spent === maxBar
                return (
                  <div key={bar.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="h-4 truncate text-[11px] font-bold tabular-nums text-ink-700">
                      {bar.spent > 0 && showValue ? euro(Math.round(bar.spent)) : ''}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`bar-grow w-full rounded-t-xl ${
                          bar.spent === 0
                            ? 'h-1 rounded-full bg-ink-100'
                            : bar.highlighted
                              ? 'border-b-4 border-brand-700 bg-brand-500'
                              : 'bg-ink-200'
                        }`}
                        style={bar.spent > 0 ? { height: `${heightPct}%` } : undefined}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${bar.isCurrent ? 'text-brand-600' : 'text-ink-500'}`}>
                      {bar.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Budget du mois */}
          <div className="tile mt-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-ink-900">Budget du mois</h3>
                <p className="mt-0.5 text-sm text-ink-500">Fixe-toi une limite pour ne pas trop dépenser.</p>
              </div>
              {budget && !editingBudget && (
                <button
                  type="button"
                  onClick={() => {
                    setBudgetInput(String(budget))
                    setEditingBudget(true)
                  }}
                  className="btn-icon"
                  aria-label="Modifier mon budget"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              )}
            </div>

            {editingBudget || !budget ? (
              editingBudget ? (
                <form onSubmit={submitBudget} className="mt-4 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="field"
                    placeholder="Ex : 50"
                    aria-label="Budget mensuel en euros"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary shrink-0 px-4" aria-label="Enregistrer le budget">
                    <Check className="h-5 w-5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBudgetInput('')
                    setEditingBudget(true)
                  }}
                  className="btn-sun mt-4 w-full"
                >
                  Fixer mon budget
                </button>
              )
            ) : (
              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-xl font-extrabold tabular-nums text-ink-900">
                    {euro(stats.thisMonthSpent)}
                    <span className="text-sm font-bold text-ink-500"> / {euro(budget)}</span>
                  </p>
                  <p className="text-sm font-bold text-ink-700">
                    {budgetRatio > 1
                      ? `Dépassé de ${euro(stats.thisMonthSpent - budget)}`
                      : `Il te reste ${euro(budget - stats.thisMonthSpent)}`}
                  </p>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`fill-grow h-full rounded-full ${budgetTone}`}
                    style={{ width: `${Math.min(100, Math.round(budgetRatio * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Répartition */}
        {!loading && stats.pokemonCount + stats.toppsCount > 0 && (
          <section className="mt-8" aria-labelledby="repartition">
            <h2 id="repartition" className="font-display text-lg font-extrabold text-ink-900">
              Ce que tu collectionnes
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="tile flex items-center gap-5 p-5">
                <div
                  className="relative h-28 w-28 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(#ffcf33 0 ${pokemonShare}%, #2b4eff ${pokemonShare}% 100%)`,
                  }}
                  role="img"
                  aria-label={`${pokemonShare} % de cartes Pokémon`}
                >
                  <div className="absolute inset-3.5 flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="font-display text-xl font-extrabold tabular-nums text-ink-900">
                      {stats.pokemonCount + stats.toppsCount}
                    </span>
                    <span className="text-[10px] font-bold text-ink-500">cartes</span>
                  </div>
                </div>
                <ul className="space-y-2.5 text-sm font-bold text-ink-900">
                  <li className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-sun-400" />
                    Pokémon · {stats.pokemonCount}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-brand-500" />
                    Topps / Panini · {stats.toppsCount}
                  </li>
                </ul>
              </div>

              {stats.topSeries.length > 0 && (
                <div className="tile p-5">
                  <h3 className="font-display text-base font-extrabold text-ink-900">Où tu investis le plus</h3>
                  <ul className="mt-3 space-y-3">
                    {stats.topSeries.map(([series, spent], index) => (
                      <li key={series}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-bold text-ink-900">
                            {['🥇', '🥈', '🥉'][index]} {series}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-ink-700">{euro(spent)}</span>
                        </div>
                        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className="fill-grow h-full rounded-full bg-brand-500"
                            style={{ width: `${(spent / stats.topSeries[0][1]) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Cartes les plus chères */}
        {!loading && stats.topCards.length > 0 && (
          <section className="mt-8" aria-labelledby="podium">
            <h2 id="podium" className="font-display text-lg font-extrabold text-ink-900">
              Tes cartes les plus chères
            </h2>
            <ol className="tile mt-3 divide-y-2 divide-ink-100 overflow-hidden">
              {stats.topCards.map((card, index) => (
                <li key={card.id} className="flex items-center gap-4 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-100 font-display text-sm font-extrabold text-sun-600">
                    {index + 1}
                  </span>
                  <div className="card-frame w-11 shrink-0 shadow-sm">
                    {topImages[card.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={topImages[card.id]} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink-900">{card.name}</p>
                    <p className="truncate text-sm text-ink-500">{card.series}</p>
                  </div>
                  <p className="shrink-0 font-display font-extrabold tabular-nums text-ink-900">
                    {euro(Number(card.purchase_price) || 0)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!loading && list.length === 0 && (
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center">
            <Image src="/assets/Favicon.png" alt="" width={112} height={112} className="mb-4 h-24 w-24 object-contain" />
            <p className="font-bold text-ink-900">Tes statistiques se remplissent avec tes cartes.</p>
            <Link href="/dashboard" className="btn-primary mt-5">
              Ajouter ma première carte
            </Link>
          </div>
        )}
      </main>

      <NavbarMobile />
    </div>
  )
}
