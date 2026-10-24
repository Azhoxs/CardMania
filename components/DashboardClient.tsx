"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Card } from '@/lib/supabase'
import { Search, Edit, Trash2, List, Plus, ArrowUpDown, LayoutGrid, BookOpen, Trash2 as TrashIcon, Tag, Check } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import CardModal from './CardModal'
import CardGrid from './CardGrid'
import CardList from './CardList'
import NavbarDesktop from './NavbarDesktop'
import NavbarMobile from './NavbarMobile'
import ConfirmDialog from './ConfirmDialog'
import Sheet from './Sheet'
import Pagination from './Pagination'
import { useFavoriteCardType } from '@/lib/useFavoriteCardType'
import Link from 'next/link'
import Celebration, { type CelebrationEvent } from './Celebration'
import EbayPriceModal from './EbayPriceModal'

interface DashboardClientProps {
  user?: any
  initialCards: Card[]
}

type SortMode ='date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'numbering_asc' | 'numbering_desc' | 'club'
// Cartes par page. Le classeur affiche des pages de 9 pochettes : 18 = 2 pages de classeur.
const PAGE_SIZE = 20
const BINDER_PAGE_SIZE = 18
const CARD_LIST_SELECT = 'id,user_id,name,series,card_type,club,purchase_price,purchase_date,is_signed,is_numbered,numbering,is_special,quantity,main_image_url,created_at,updated_at'
const CARD_DETAILS_SELECT = `${CARD_LIST_SELECT},images`

export default function DashboardClient({ user, initialCards }: DashboardClientProps) {
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [filteredCards, setFilteredCards] = useState<Card[]>(initialCards)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [previewCard, setPreviewCard] = useState<Card | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'gallery' | 'binder' | 'list'>('gallery')
  const { favoriteCardType } = useFavoriteCardType()
  const [page, setPage] = useState(1)
  const listTopRef = useRef<HTMLDivElement | null>(null)
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('date_desc')
  const [loadingUser, setLoadingUser] = useState(true)
  const [currentUser, setCurrentUser] = useState<any | null>(user ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSortOverlayOpen, setIsSortOverlayOpen] = useState(false)
  const [cardIdToDelete, setCardIdToDelete] = useState<string | null>(null)
  const [ebayPriceCard, setEbayPriceCard] = useState<Card | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const friendIdParam = searchParams.get('friend')
  const friendNameParam = searchParams.get('friendName')

  const parseNumberingTotal = (numbering: string | null): number | null => {
    if (!numbering?.trim()) return null
    const match = numbering.trim().match(/\/\s*(\d+)\s*$/)
    return match ? parseInt(match[1], 10) : null
  }
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [openCameraOnNextModal, setOpenCameraOnNextModal] = useState(false)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)

      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timeoutId)
          resolve(value)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const loadCards = useCallback(async () => {
      // Evite l'impression de "page figée" sur mobile quand le reseau est lent.
      setLoadError(null)
      setLoadingUser(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        let supaUser = session?.user ?? null

        if (!supaUser) {
          const {
            data: { user },
          } = await withTimeout(
            supabase.auth.getUser(),
            8000,
            "La session met trop de temps a se verifier. Reessaye."
          )
          supaUser = user
        }

        if (!supaUser) {
          router.push('/auth/login')
          return
        }

        setCurrentUser(supaUser)

        const targetUserId =
          friendIdParam && friendIdParam !== supaUser.id ? friendIdParam : supaUser.id

        setViewingUserId(targetUserId)

        let cardsData: Card[] | null = null
        let cardsError: { message?: string; code?: string; details?: string; hint?: string } | null = null

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const { data, error } = await withTimeout(
            supabase
              .from('cards')
              .select(CARD_LIST_SELECT)
              .eq('user_id', targetUserId)
              .order('created_at', { ascending: false }),
            12000,
            "Le chargement des cartes est trop long. Verifie ta connexion puis reessaye."
          )

          cardsData = (data as Card[] | null) ?? null
          cardsError = error

          if (!cardsError) break

          // Apres un projet Supabase en pause, la 1ere requete peut rater/lentement repondre.
          if (attempt < 2) {
            await sleep(1200)
          }
        }

        if (cardsError) {
          console.error('[Dashboard] Error loading cards', {
            message: cardsError.message,
            code: cardsError.code,
            details: cardsError.details,
            hint: cardsError.hint,
            targetUserId,
          })
          setLoadError(cardsError.message ?? "Impossible de charger tes cartes.")
          return
        }

        if (cardsData) {
          const normalizedCards = cardsData.map((card) => ({
            ...card,
            images: card.images ?? null,
          }))
          setCards(normalizedCards)
          setFilteredCards(normalizedCards)
        }
      } catch (error: any) {
        console.error('[Dashboard] Unexpected loadCards error', error)
        setLoadError(error?.message ?? "Impossible de charger tes cartes.")
      } finally {
        setLoadingUser(false)
      }
    }, [friendIdParam, router])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768)
      }
    }

    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
    return () => window.removeEventListener('resize', updateIsMobile)
  }, [])

  const getPurchasePrice = (card: Card): number | null => {
    if (card.purchase_price == null) return null
    return Number(card.purchase_price)
  }

  const getPurchaseDate = (card: Card): Date | null => {
    if (!card.purchase_date) return null
    const d = new Date(card.purchase_date)
    if (isNaN(d.getTime())) return null
    return d
  }

  useEffect(() => {
    let filtered = [...cards]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(card =>
        card.name.toLowerCase().includes(term) ||
        card.series.toLowerCase().includes(term) ||
        (card.club && card.club.toLowerCase().includes(term)) ||
        (card.numbering && card.numbering.toLowerCase().includes(term))
      )
    }

    filtered.sort((a, b) => {
      if (sortMode === 'price_desc' || sortMode === 'price_asc') {
        const pa = getPurchasePrice(a) ?? 0
        const pb = getPurchasePrice(b) ?? 0
        return sortMode === 'price_desc' ? pb - pa : pa - pb
      }

      if (sortMode === 'numbering_asc' || sortMode === 'numbering_desc') {
        const na = parseNumberingTotal(a.numbering)
        const nb = parseNumberingTotal(b.numbering)
        const hasA = na != null
        const hasB = nb != null
        if (!hasA && !hasB) return 0
        if (!hasA) return 1
        if (!hasB) return -1
        return sortMode === 'numbering_asc' ? na - nb : nb - na
      }

      if (sortMode === 'club') {
        const clubA = (a.club?.trim() ?? '').toLowerCase()
        const clubB = (b.club?.trim() ?? '').toLowerCase()
        const hasA = clubA.length > 0
        const hasB = clubB.length > 0
        if (!hasA && !hasB) return 0
        if (!hasA) return 1
        if (!hasB) return -1
        return clubA.localeCompare(clubB)
      }

      const da = getPurchaseDate(a)?.getTime() ?? 0
      const db = getPurchaseDate(b)?.getTime() ?? 0
      return sortMode === 'date_desc' ? db - da : da - db
    })

    setFilteredCards(filtered)
  }, [searchTerm, sortMode, cards])

  // Retour à la page 1 quand la recherche, le tri ou l'affichage changent
  useEffect(() => {
    setPage(1)
  }, [searchTerm, sortMode, viewMode])

  const pageSize = viewMode === 'binder' ? BINDER_PAGE_SIZE : PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize))
  // Si on supprime les dernières cartes d'une page, on revient sur la dernière page qui existe
  const currentPage = Math.min(page, totalPages)
  const firstIndex = (currentPage - 1) * pageSize
  const visibleCards = filteredCards.slice(firstIndex, firstIndex + pageSize)

  const goToPage = (nextPage: number) => {
    setPage(nextPage)
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Mémorise l'affichage choisi (galerie / classeur / liste) sur cet appareil
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cardmania:view')
      if (saved === 'gallery' || saved === 'binder' || saved === 'list') setViewMode(saved)
    } catch {
      /* stockage indisponible : on garde la galerie */
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('cardmania:view', viewMode)
    } catch {
      /* ignoré */
    }
  }, [viewMode])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleAddCard = () => {
    if (isFriendView) return
    setSelectedCard(null)
    if (isMobile) {
      setOpenCameraOnNextModal(true)
    }
    setIsModalOpen(true)
  }

  const handleEditCard = async (card: Card) => {
    if (isFriendView) return
    const { data: fullCard, error } = await supabase
      .from('cards')
      .select(CARD_DETAILS_SELECT)
      .eq('id', card.id)
      .maybeSingle()

    if (error || !fullCard) {
      setSelectedCard(card)
    } else {
      setSelectedCard(fullCard as Card)
    }

    setIsModalOpen(true)
  }

  const requestDeleteCard = (cardId: string) => {
    if (isFriendView) return
    setCardIdToDelete(cardId)
  }

  const performDeleteCard = async (cardId: string) => {
    if (isFriendView) return
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId)

    if (!error) {
      setCards(cards.filter(c => c.id !== cardId))
    }
  }

  const handleSaveCard = async (cardData: Partial<Card>) => {
    if (!currentUser) {
      console.warn('[Dashboard] handleSaveCard called without user')
      return
    }

    if (isFriendView) return

      if (selectedCard) {
      const { data, error } = await supabase
        .from('cards')
        .update({ ...cardData, updated_at: new Date().toISOString() })
        .eq('id', selectedCard.id)
        .select()
        .single()

      if (!error && data) {
        setCards(cards.map(c => c.id === data.id ? data : c))
        }
    } else {
      // On vérifie d'abord si une carte identique existe déjà pour cet utilisateur (nom + série)
      const { data: existing, error: existingError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('name', cardData.name as string)
        .eq('series', cardData.series as string)
        .maybeSingle()

      if (!existingError && existing) {
        const { data: updated, error: updateError } = await supabase
          .from('cards')
          .update({
            ...cardData,
            quantity: (existing.quantity || 1) + (cardData.quantity || 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (!updateError && updated) {
          setCards(cards.map(c => c.id === updated.id ? updated : c))
            }
      } else {
        const { data, error } = await supabase
          .from('cards')
          .insert([{ ...cardData, user_id: currentUser.id }])
          .select()
          .single()

        if (!error && data) {
          setCards([data, ...cards])
          setCelebration({ id: Date.now() })
          try {
            navigator.vibrate?.(20)
          } catch {
            /* pas de vibration sur cet appareil */
          }
            }
      }
    }

    setOpenCameraOnNextModal(false)
    setIsModalOpen(false)
  }

  const computeCardTotalPrice = (card: Card) => {
    const price = card.purchase_price != null ? Number(card.purchase_price) : 0
    return price * (card.quantity || 1)
  }

  const totalCards = cards.reduce((sum, card) => sum + (card.quantity || 1), 0)
  const totalSpent = cards.reduce((sum, card) => sum + computeCardTotalPrice(card), 0)
  const averagePrice = totalCards > 0 ? totalSpent / totalCards : 0
  const username =
    (currentUser as any)?.user_metadata?.username ??
    (currentUser as any)?.email?.split?.('@')?.[0]
  const isFriendView =
    viewingUserId !== null && currentUser && viewingUserId !== currentUser.id

  const formatEuro = (value: number) =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'date_desc', label: "Date d'achat : récentes d'abord" },
    { value: 'date_asc', label: "Date d'achat : anciennes d'abord" },
    { value: 'price_desc', label: 'Prix : du plus cher au moins cher' },
    { value: 'price_asc', label: 'Prix : du moins cher au plus cher' },
    { value: 'numbering_asc', label: 'Numérotation : du plus petit au plus grand' },
    { value: 'numbering_desc', label: 'Numérotation : du plus grand au plus petit' },
    { value: 'club', label: 'Regrouper par club' },
  ]

  const viewOptions = [
    { mode: 'gallery', Icon: LayoutGrid, label: 'Galerie' },
    { mode: 'binder', Icon: BookOpen, label: 'Classeur' },
    { mode: 'list', Icon: List, label: 'Liste' },
  ] as const

  const friendLabel = friendNameParam || 'ton ami'
  const hasActiveFilter = searchTerm.trim() !== ''

  return (
    <div className="min-h-dvh md:pl-[264px]">
      <main className="mx-auto max-w-[1400px] px-5 pb-52 pt-[calc(5.5rem+env(safe-area-inset-top))] md:px-10 md:pb-16 md:pt-12">
        {isFriendView && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-brand-50 p-4 pl-5">
            <p className="text-ink-700">
              Tu regardes la collection de <span className="font-bold text-ink-900">{friendLabel}</span>
            </p>
            <button type="button" onClick={() => router.push('/dashboard')} className="btn-primary min-h-[44px] px-5 text-sm">
              Retour à ma collection
            </button>
          </div>
        )}

        {/* En-tête : titre + chiffres clés en une ligne */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
              {isFriendView ? `Collection de ${friendLabel}` : 'Ma collection'}
            </h1>
            {isFriendView && (loadingUser ? (
              <div className="mt-3 h-5 w-56 animate-pulse rounded-full bg-ink-200" />
            ) : (
              <p className="mt-2 text-base text-ink-500">
                <span className="font-bold text-ink-900">{totalCards}</span> carte{totalCards > 1 ? 's' : ''}
                <span aria-hidden className="mx-2">·</span>
                <span className="font-bold text-ink-900">{formatEuro(totalSpent)}</span> investis
                {totalCards > 1 && (
                  <span className="hidden sm:inline">
                    <span aria-hidden className="mx-2">·</span>
                    {formatEuro(averagePrice)} en moyenne
                  </span>
                )}
              </p>
            ))}
          </div>
          {!isFriendView && (
            <button onClick={handleAddCard} className="btn-primary hidden shrink-0 md:inline-flex">
              <Plus className="h-5 w-5" strokeWidth={2.6} />
              Ajouter une carte
            </button>
          )}
        </header>

        {!isFriendView && (
          <Link
            href="/statistiques"
            className="relative mt-5 block overflow-hidden rounded-[28px] border-b-[6px] border-brand-700 bg-brand-500 p-5 text-white transition active:translate-y-[3px] active:border-b-[3px] md:p-6"
            aria-label="Voir mes statistiques"
          >
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-600" />
            <span aria-hidden className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-sun-400/30" />

            <dl className="relative grid grid-cols-2 gap-2.5">
              {[
                { label: 'Cartes', value: loadingUser ? '…' : String(totalCards) },
                { label: 'Investis', value: loadingUser ? '…' : formatEuro(totalSpent) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/15 px-2 py-4 text-center">
                  <dd className="truncate font-display text-xl font-extrabold tabular-nums sm:text-3xl">{item.value}</dd>
                  <dt className="mt-0.5 text-xs font-bold text-white/85 sm:text-sm">{item.label}</dt>
                </div>
              ))}
            </dl>
            <p className="relative mt-3 text-center text-sm font-bold text-white/90">Voir mes statistiques</p>
          </Link>
        )}

        {loadError && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-danger-50 p-4 pl-5">
            <p className="text-danger-600">Impossible de charger les cartes : {loadError}</p>
            <button type="button" onClick={() => loadCards()} className="btn-danger min-h-[44px] px-5 text-sm">
              Réessayer
            </button>
          </div>
        )}

        {/* Recherche + filtres rapides */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              placeholder="Rechercher un nom, une série, un club…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              ref={searchInputRef}
              className="field !rounded-full pl-12"
              aria-label="Rechercher dans la collection"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-sm text-ink-500" aria-live="polite">
              {loadingUser ? '' : hasActiveFilter ? `${filteredCards.length} résultat${filteredCards.length > 1 ? 's' : ''}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsSortOverlayOpen(true)} className="pill">
                <ArrowUpDown className="h-4 w-4" />
                Trier
              </button>
              <div className="flex gap-1 rounded-full bg-ink-100 p-1" role="group" aria-label="Affichage">
                {viewOptions.map(({ mode, Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    aria-label={label}
                    title={label}
                    className={`flex h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                      viewMode === mode ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="hidden xl:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          key={`${viewMode}-${sortMode}-${searchTerm}-${filteredCards.length}-${currentPage}`}
          ref={listTopRef}
          className="fade-soft mt-6 scroll-mt-24"
        >
          {loadingUser ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="aspect-[63/88] rounded-card bg-ink-200" />
                  <div className="mt-3 h-4 w-3/4 rounded-full bg-ink-200" />
                  <div className="mt-2 h-3 w-1/2 rounded-full bg-ink-100" />
                </div>
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
              <Image src="/assets/Favicon.png" alt="" width={120} height={120} className="mb-6 h-28 w-28 object-contain" />
              <h2 className="font-display text-xl font-bold text-ink-900">
                {hasActiveFilter
                  ? 'Aucune carte ne correspond'
                  : isFriendView
                    ? 'Cette collection est vide'
                    : 'Ta collection est vide'}
              </h2>
              <p className="mt-2 text-ink-500">
                {hasActiveFilter
                  ? 'Essaie un autre nom, une autre série ou un autre club.'
                  : isFriendView
                    ? "Ton ami n'a pas encore ajouté de cartes."
                    : 'Prends ta première carte en photo : elle apparaîtra ici.'}
              </p>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="btn-secondary mt-6"
                >
                  Effacer la recherche
                </button>
              ) : (
                !isFriendView && (
                  <button onClick={handleAddCard} className="btn-primary mt-6">
                    <Plus className="h-5 w-5" strokeWidth={2.6} />
                    Ajouter ma première carte
                  </button>
                )
              )}
            </div>
          ) : viewMode === 'list' ? (
            <CardList cards={visibleCards} onPreview={(card) => setPreviewCard(card)} groupByClub={sortMode === 'club'} />
          ) : (
            <CardGrid
              cards={visibleCards}
              layout={viewMode}
              onPreview={(card) => setPreviewCard(card)}
              groupByClub={sortMode === 'club'}
            />
          )}

          {totalPages > 1 && !loadingUser && (
            <div className="mt-10 flex flex-col items-center gap-3">
              <Pagination page={currentPage} totalPages={totalPages} onChange={goToPage} />
              <p className="text-sm font-semibold text-ink-500" aria-live="polite">
                Cartes {firstIndex + 1} à {firstIndex + visibleCards.length} sur {filteredCards.length}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Tri */}
      {isSortOverlayOpen && (
        <Sheet onClose={() => setIsSortOverlayOpen(false)} title="Trier la collection" size="sm">
          <ul className="divide-y divide-ink-100">
            {sortOptions.map((option) => {
              const active = sortMode === option.value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setSortMode(option.value)
                      setIsSortOverlayOpen(false)
                    }}
                    aria-pressed={active}
                    className={`flex min-h-[60px] w-full items-center justify-between gap-3 text-left text-base ${
                      active ? 'font-bold text-brand-600' : 'font-medium text-ink-900'
                    }`}
                  >
                    {option.label}
                    {active && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}

      {isModalOpen && (
        <CardModal
          card={selectedCard}
          onClose={() => {
            setIsModalOpen(false)
            setOpenCameraOnNextModal(false)
          }}
          onSave={handleSaveCard}
          openCameraOnMount={openCameraOnNextModal}
          defaultCardType={favoriteCardType}
        />
      )}

      {/* Fiche d'une carte : tiroir à droite sur ordinateur, panneau du bas sur mobile */}
      {previewCard && (
        <Sheet
          variant="drawer"
          onClose={() => setPreviewCard(null)}
          title={previewCard.name}
          footer={
            <div className="space-y-3 pb-1">
              {!isFriendView && (
                <button
                  onClick={() => {
                    handleEditCard(previewCard)
                    setPreviewCard(null)
                  }}
                  className="btn-primary w-full"
                >
                  <Edit className="h-5 w-5" />
                  Modifier la carte
                </button>
              )}
              <div className="flex gap-3">
                {previewCard.main_image_url && (
                  <button onClick={() => setEbayPriceCard(previewCard)} className="btn-secondary flex-1">
                    <Tag className="h-5 w-5" />
                    Prix eBay
                  </button>
                )}
                {!isFriendView && (
                  <button
                    onClick={() => {
                      requestDeleteCard(previewCard.id)
                      setPreviewCard(null)
                    }}
                    className="btn-danger flex-1"
                  >
                    <Trash2 className="h-5 w-5" />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="flex flex-col items-center pb-2 pt-2">
            <div className="card-frame w-[62%] max-w-[300px] shadow-lift">
              {previewCard.main_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewCard.main_image_url} alt={previewCard.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Image src="/assets/Favicon.png" alt="" width={96} height={96} className="h-24 w-24 object-contain opacity-40" />
                </div>
              )}
            </div>
          </div>

          <dl className="mt-6 divide-y divide-ink-100">
            {(() => {
              const date = previewCard.purchase_date ? new Date(previewCard.purchase_date) : null
              const rows: { label: string; value: string }[] = [
                { label: 'Série', value: previewCard.series },
                { label: 'Type', value: previewCard.card_type === 'topps' ? 'Topps / Panini' : 'Pokémon' },
              ]
              if (previewCard.card_type === 'topps' && previewCard.club?.trim()) {
                rows.push({ label: 'Club', value: previewCard.club.trim() })
              }
              rows.push({
                label: "Prix d'achat",
                value: previewCard.purchase_price == null ? '—' : formatEuro(Number(previewCard.purchase_price)),
              })
              if (date && !isNaN(date.getTime())) {
                rows.push({
                  label: "Date d'achat",
                  value: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
                })
              }
              if (previewCard.is_numbered) rows.push({ label: 'Numérotation', value: previewCard.numbering || 'Oui' })
              if (previewCard.is_signed) rows.push({ label: 'Signature', value: 'Carte signée' })
              if (previewCard.is_special) rows.push({ label: 'Particularité', value: 'Carte spéciale' })
              return rows.map((row) => (
                <div key={row.label} className="flex min-h-[52px] items-center justify-between gap-4 py-2">
                  <dt className="text-ink-500">{row.label}</dt>
                  <dd className="text-right font-semibold text-ink-900">{row.value}</dd>
                </div>
              ))
            })()}
          </dl>
        </Sheet>
      )}

      {ebayPriceCard && (
        <EbayPriceModal
          card={ebayPriceCard}
          onClose={() => setEbayPriceCard(null)}
        />
      )}

      {cardIdToDelete && (
        <ConfirmDialog
          open
          title="Supprimer cette carte ?"
          description={
            (() => {
              const card = cards.find(c => c.id === cardIdToDelete)
              if (!card) return "Cette carte sera définitivement supprimée de ta collection."
              return `« ${card.name} » (${card.series}) sera définitivement supprimée de ta collection.`
            })()
          }
          tone="danger"
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          icon={<TrashIcon className="h-6 w-6" />}
          onCancel={() => setCardIdToDelete(null)}
          onConfirm={async () => {
            if (cardIdToDelete) {
              await performDeleteCard(cardIdToDelete)
            }
            setCardIdToDelete(null)
          }}
        />
      )}

      <NavbarDesktop
        userName={username}
        userId={currentUser?.id}
        onLogout={handleLogout}
      />
      <NavbarMobile onAdd={handleAddCard} addLabel="Ajouter une carte" />
      <Celebration event={celebration} onDone={() => setCelebration(null)} />
    </div>
  )
}
