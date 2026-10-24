'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Wish } from '@/lib/supabase'
import { Plus, Search, Trash2, Edit, ExternalLink, ChevronRight } from 'lucide-react'
import Sheet from './Sheet'
import { useFavoriteCardType } from '@/lib/useFavoriteCardType'
import NavbarDesktop from './NavbarDesktop'
import NavbarMobile from './NavbarMobile'
import WishModal from './WishModal'
import ConfirmDialog from './ConfirmDialog'

export default function WishlistClient() {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [filteredWishes, setFilteredWishes] = useState<Wish[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingUser, setLoadingUser] = useState(true)
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null)
  const [wishIdToDelete, setWishIdToDelete] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const friendIdParam = searchParams.get('friend')
  const friendNameParam = searchParams.get('friendName')
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setCurrentUser(user)

      const targetUserId =
        friendIdParam && friendIdParam !== user.id ? friendIdParam : user.id

      setViewingUserId(targetUserId)

      const { data, error } = await supabase
        .from('wishes')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setWishes(data as Wish[])
        setFilteredWishes(data as Wish[])
      }

      setLoadingUser(false)
    }

    load()
  }, [friendIdParam, router])

  useEffect(() => {
    let result = [...wishes]
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter((wish) =>
        [wish.name, wish.series, wish.club ?? '']
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
    }
    setFilteredWishes(result)
  }, [searchTerm, wishes])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleAddWish = () => {
    if (isFriendView) return
    setSelectedWish(null)
    setIsModalOpen(true)
  }

  const handleEditWish = (wish: Wish) => {
    if (isFriendView) return
    setSelectedWish(wish)
    setIsModalOpen(true)
  }

  const handleSaveWish = async (data: Partial<Wish>) => {
    if (!currentUser) return

    if (isFriendView) return

    if (selectedWish) {
      const { data: updated, error } = await supabase
        .from('wishes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', selectedWish.id)
        .select()
        .single()

      if (!error && updated) {
        setWishes((prev) => prev.map((w) => (w.id === updated.id ? (updated as Wish) : w)))
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('wishes')
        .insert([{ ...data, user_id: currentUser.id }])
        .select()
        .single()

      if (!error && inserted) {
        setWishes((prev) => [inserted as Wish, ...prev])
      }
    }

    setIsModalOpen(false)
    setSelectedWish(null)
  }

  const performDeleteWish = async (id: string) => {
    if (isFriendView) return
    const { error } = await supabase.from('wishes').delete().eq('id', id)
    if (!error) {
      setWishes((prev) => prev.filter((w) => w.id !== id))
    }
  }

  const username =
    (currentUser as any)?.user_metadata?.username ??
    (currentUser as any)?.email?.split?.('@')?.[0]
  const isFriendView =
    viewingUserId !== null && currentUser && viewingUserId !== currentUser.id

  const [activeWish, setActiveWish] = useState<Wish | null>(null)
  const { favoriteCardType } = useFavoriteCardType()

  const visibleWishes = filteredWishes
  const friendLabel = friendNameParam || 'ton ami'
  const hasActiveFilter = searchTerm.trim() !== ''

  return (
    <div className="min-h-dvh md:pl-[264px]">
      <NavbarDesktop userName={username} userId={currentUser?.id} onLogout={handleLogout} />

      <main className="mx-auto max-w-[1100px] px-5 pb-52 pt-[calc(5.5rem+env(safe-area-inset-top))] md:px-10 md:pb-16 md:pt-12">
        {isFriendView && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-brand-50 p-4 pl-5">
            <p className="text-ink-700">
              Tu regardes les souhaits de <span className="font-bold text-ink-900">{friendLabel}</span>
            </p>
            <button type="button" onClick={() => router.push('/souhaits')} className="btn-primary min-h-[44px] px-5 text-sm">
              Retour à mes souhaits
            </button>
          </div>
        )}

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
              {isFriendView ? `Souhaits de ${friendLabel}` : 'Mes souhaits'}
            </h1>
            {loadingUser ? (
              <div className="mt-3 h-5 w-40 animate-pulse rounded-full bg-ink-200" />
            ) : (
              <p className="mt-2 text-base text-ink-500">
                <span className="font-bold text-ink-900">{wishes.length}</span> carte{wishes.length > 1 ? 's' : ''} à
                trouver
              </p>
            )}
          </div>
          {!isFriendView && (
            <button onClick={handleAddWish} className="btn-primary hidden shrink-0 md:inline-flex">
              <Plus className="h-5 w-5" strokeWidth={2.6} />
              Ajouter un souhait
            </button>
          )}
        </header>

        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              placeholder="Rechercher un souhait…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              ref={searchInputRef}
              className="field !rounded-full pl-12"
              aria-label="Rechercher dans les souhaits"
            />
          </div>
        </div>

        <section className="mt-6">
          {loadingUser ? (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-3xl bg-white">
              {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="flex animate-pulse items-center gap-4 p-4">
                  <div className="h-3 w-3 rounded-full bg-ink-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded-full bg-ink-200" />
                    <div className="h-3 w-1/3 rounded-full bg-ink-100" />
                  </div>
                </li>
              ))}
            </ul>
          ) : visibleWishes.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
              <Image src="/assets/Favicon.png" alt="" width={120} height={120} className="mb-6 h-28 w-28 object-contain" />
              <h2 className="font-display text-xl font-bold text-ink-900">
                {hasActiveFilter ? 'Aucun souhait ne correspond' : 'Aucun souhait pour le moment'}
              </h2>
              <p className="mt-2 text-ink-500">
                {hasActiveFilter
                  ? 'Essaie un autre nom ou une autre série.'
                  : isFriendView
                    ? "Ton ami n'a pas encore ajouté de souhait."
                    : 'Note ici les cartes que tu cherches, avec un lien vers l’annonce.'}
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
                  <button onClick={handleAddWish} className="btn-primary mt-6">
                    <Plus className="h-5 w-5" strokeWidth={2.6} />
                    Ajouter un souhait
                  </button>
                )
              )}
            </div>
          ) : (
            <ul className="fade-soft grid gap-px overflow-hidden rounded-3xl bg-ink-100 ring-1 ring-ink-100 lg:grid-cols-2">
              {visibleWishes.map((wish) => {
                const tags: string[] = []
                if (wish.is_signed) tags.push('Signée')
                if (wish.is_numbered) tags.push(wish.numbering || 'Numérotée')
                if (wish.is_special) tags.push('Spéciale')
                return (
                  <li key={wish.id} className="bg-white">
                    <button
                      type="button"
                      onClick={() => setActiveWish(wish)}
                      className="flex min-h-[76px] w-full items-center gap-4 p-4 text-left transition hover:bg-ink-50 active:bg-ink-100"
                    >
                      <span
                        aria-hidden
                        className={`h-3 w-3 shrink-0 rounded-full ${wish.card_type === 'topps' ? 'bg-brand-500' : 'bg-sun-400'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold text-ink-900">{wish.name}</span>
                        <span className="block truncate text-sm text-ink-500">
                          {[wish.series, wish.card_type === 'topps' ? wish.club?.trim() : null, ...tags]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      {/* Fiche d'un souhait */}
      {activeWish && (
        <Sheet
          variant="drawer"
          onClose={() => setActiveWish(null)}
          title={activeWish.name}
          subtitle={activeWish.series}
          footer={
            <div className="space-y-3 pb-1">
              <a href={activeWish.link_url} target="_blank" rel="noreferrer" className="btn-primary w-full">
                <ExternalLink className="h-5 w-5" />
                Ouvrir l&apos;annonce
              </a>
              {!isFriendView && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleEditWish(activeWish)
                      setActiveWish(null)
                    }}
                    className="btn-secondary flex-1"
                  >
                    <Edit className="h-5 w-5" />
                    Modifier
                  </button>
                  <button
                    onClick={() => {
                      setWishIdToDelete(activeWish.id)
                      setActiveWish(null)
                    }}
                    className="btn-danger flex-1"
                  >
                    <Trash2 className="h-5 w-5" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          }
        >
          <dl className="divide-y divide-ink-100">
            {(() => {
              const rows: { label: string; value: string }[] = [
                { label: 'Type', value: activeWish.card_type === 'topps' ? 'Topps / Panini' : 'Pokémon' },
              ]
              if (activeWish.card_type === 'topps' && activeWish.club?.trim()) {
                rows.push({ label: 'Club', value: activeWish.club.trim() })
              }
              if (activeWish.is_numbered) rows.push({ label: 'Numérotation', value: activeWish.numbering || 'Oui' })
              if (activeWish.is_signed) rows.push({ label: 'Signature', value: 'Carte signée' })
              if (activeWish.is_special) rows.push({ label: 'Particularité', value: 'Carte spéciale' })
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

      {isModalOpen && (
        <WishModal
          wish={selectedWish}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedWish(null)
          }}
          onSave={handleSaveWish}
          defaultCardType={favoriteCardType}
        />
      )}

      {wishIdToDelete && (
        <ConfirmDialog
          open
          title="Supprimer ce souhait ?"
          description={
            (() => {
              const wish = wishes.find((w) => w.id === wishIdToDelete)
              if (!wish) return 'Ce souhait sera définitivement supprimé.'
              return `« ${wish.name} » (${wish.series}) sera définitivement supprimé de ta liste.`
            })()
          }
          tone="danger"
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          icon={<Trash2 className="h-6 w-6" />}
          onCancel={() => setWishIdToDelete(null)}
          onConfirm={async () => {
            if (wishIdToDelete) {
              await performDeleteWish(wishIdToDelete)
            }
            setWishIdToDelete(null)
          }}
        />
      )}

      <NavbarMobile onAdd={handleAddWish} addLabel="Ajouter un souhait" />
    </div>
  )
}
