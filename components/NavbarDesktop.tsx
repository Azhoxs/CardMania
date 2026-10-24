'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { supabase, type Friend, type Notification } from '@/lib/supabase'
import { LogOut, Users, Bell, Search, X, Trash2, LayoutGrid, Heart, ChevronRight, Check, BarChart3 } from 'lucide-react'
import Sheet from './Sheet'
import { Segmented } from './FormBits'
import { useFavoriteCardType, type FavoriteCardType } from '@/lib/useFavoriteCardType'

interface NavbarDesktopProps {
  userName?: string
  userId?: string
  onLogout: () => void
}

type FriendSearchResult = {
  id: string
  username: string
}

export default function NavbarDesktop({ userName, userId, onLogout }: NavbarDesktopProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeFriendId = searchParams.get('friend')
  const activeFriendName = searchParams.get('friendName')

  const isOnDashboard = pathname?.startsWith('/dashboard')
  const isOnWishlist = pathname === '/souhaits'

  const buildHref = (base: string) => {
    if (!activeFriendId) return base
    const params = new URLSearchParams()
    params.set('friend', activeFriendId)
    if (activeFriendName) params.set('friendName', activeFriendName)
    return `${base}?${params.toString()}`
  }

  const dashboardHref = buildHref('/dashboard')
  const wishlistHref = buildHref('/souhaits')

  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([])
  const [friendError, setFriendError] = useState<string | null>(null)
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null)
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null)
  const [isFriendsOpen, setIsFriendsOpen] = useState(false)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [loadingFriendAction, setLoadingFriendAction] = useState(false)

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      // Charger la liste d'amis
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', userId)
        .order('friend_username', { ascending: true })

      if (friendsData) {
        setFriends(friendsData as Friend[])
      }

      // Charger les notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (notifData) {
        setNotifications(notifData as Notification[])
        setHasUnreadNotifications(notifData.some((n) => !n.is_read))
      }
    }
    load()
  }, [userId])

  // Écouteur global pour ouvrir la liste d'amis depuis la nav mobile
  useEffect(() => {
    const openFriendsFromEvent = () => setIsFriendsOpen(true)
    if (typeof window !== 'undefined') {
      window.addEventListener('cardmania:openFriends', openFriendsFromEvent)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cardmania:openFriends', openFriendsFromEvent)
      }
    }
  }, [])

  // Recherche d'amis en "live" (auto au fil de la saisie)
  useEffect(() => {
    if (!userId) return

    const query = friendSearch.trim()
    if (!query) {
      setFriendResults([])
      setFriendError(null)
      return
    }

    const handler = setTimeout(async () => {
      setFriendError(null)

      const { data, error } = await supabase.rpc('search_profiles_by_username', {
        p_query: query,
      })

      if (error) {
        setFriendError("Impossible de rechercher pour le moment.")
        setFriendResults([])
        return
      }

      const results = (data || []) as FriendSearchResult[]
      const filtered = results.filter(
        (r) =>
          r.id !== userId &&
          !friends.some((f) => f.friend_id === r.id),
      )

      if (filtered.length === 0) {
        setFriendError('Aucun profil trouvé ou déjà dans ta liste.')
      } else {
        setFriendError(null)
      }

      setFriendResults(filtered)
    }, 250)

    return () => {
      clearTimeout(handler)
    }
  }, [friendSearch, userId, friends])

  const handleOpenNotifications = async () => {
    if (!userId) return
    setIsNotificationsOpen(true)

    if (hasUnreadNotifications) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      setHasUnreadNotifications(false)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  const handleRemoveNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleRespondFriendRequest = async (notif: Notification, accept: boolean) => {
    if (!userId) return

    const payload = (notif.payload || {}) as any
    const requestId = payload.friend_request_id as string | undefined
    if (!requestId) return

    setLoadingFriendAction(true)
    try {
      const { data: request, error } = await supabase
        .from('friend_requests')
        .update({
          status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .select()
        .single()

      if (!error && request) {
        if (accept) {
          const requesterId = request.requester_id as string
          const requesterUsername = payload.requester_username as string | undefined
          const currentUsername = userName ?? ''

          await supabase.from('friends').insert([
            {
              user_id: userId,
              friend_id: requesterId,
              friend_username: requesterUsername || 'Ami',
            },
            {
              user_id: requesterId,
              friend_id: userId,
              friend_username: currentUsername || 'Ami',
            },
          ])

          // Recharger les amis
          const { data: friendsData } = await supabase
            .from('friends')
            .select('*')
            .eq('user_id', userId)
            .order('friend_username', { ascending: true })

          if (friendsData) {
            setFriends(friendsData as Friend[])
          }
        }

        await supabase.from('notifications').delete().eq('id', notif.id)
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
      }
    } finally {
      setLoadingFriendAction(false)
    }
  }

  const handleAddFriend = async (profile: FriendSearchResult) => {
    if (!userId) return

    setLoadingFriendAction(true)
    setFriendError(null)
    setFriendSuccess(null)

    try {
      // Vérifier s'il n'y a pas déjà une demande en cours dans un sens ou dans l'autre
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('*')
        .or(
          `and(requester_id.eq.${userId},receiver_id.eq.${profile.id},status.eq.pending),and(requester_id.eq.${profile.id},receiver_id.eq.${userId},status.eq.pending)`,
        )
        .maybeSingle()

      if (existing) {
        setFriendError('Une demande est déjà en cours avec cet ami.')
        return
      }

      // Créer la demande d'ami
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .insert([
          {
            requester_id: userId,
            receiver_id: profile.id,
          },
        ])
        .select()
        .single()

      if (requestError || !request) {
        setFriendError("Impossible d'envoyer la demande d'ami.")
        return
      }

      // Créer la notification pour le destinataire
      const { error: notifError } = await supabase.from('notifications').insert([
        {
          user_id: profile.id,
          type: 'friend_request',
          payload: {
            friend_request_id: request.id,
            requester_id: userId,
            requester_username: userName ?? '',
          },
        },
      ])

      if (notifError) {
        setFriendError("La demande a été créée, mais la notification n'a pas pu être envoyée.")
      } else {
        setFriendSuccess("Demande d'ami envoyée.")
      }
    } finally {
      setLoadingFriendAction(false)
    }
  }

  const handleRemoveFriend = async () => {
    if (!userId || !friendToRemove) return

    setLoadingFriendAction(true)
    try {
      const { error } = await supabase.rpc('delete_friendship', {
        p_user_id: userId,
        p_friend_id: friendToRemove.friend_id,
      })

      if (!error) {
        setFriends((prev) =>
          prev.filter((f) => f.friend_id !== friendToRemove.friend_id),
        )
      }
    } finally {
      setLoadingFriendAction(false)
      setFriendToRemove(null)
    }
  }

  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const { favoriteCardType, saveFavoriteCardType } = useFavoriteCardType()
  const [favoriteSaved, setFavoriteSaved] = useState<'ok' | 'error' | null>(null)

  // La barre d'onglets mobile ouvre le compte via un évènement et reçoit l'état « non lu »
  useEffect(() => {
    const openAccount = () => setIsAccountOpen(true)
    window.addEventListener('cardmania:openAccount', openAccount)
    return () => window.removeEventListener('cardmania:openAccount', openAccount)
  }, [])

  useEffect(() => {
    ;(window as any).__cmUnread = hasUnreadNotifications
    window.dispatchEvent(new CustomEvent('cardmania:unread', { detail: hasUnreadNotifications }))
  }, [hasUnreadNotifications])

  const initial = (userName || '?').charAt(0).toUpperCase()

  const isOnStats = !!pathname?.startsWith('/statistiques')

  const sideItem = (active: boolean) =>
    `flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-[15px] font-bold transition-all ${
      active
        ? 'bg-brand-500 text-white shadow-[0_4px_0_#182fb3]'
        : 'text-ink-700 hover:bg-ink-100'
    }`

  const openFriendsPanel = () => {
    setIsAccountOpen(false)
    setIsFriendsOpen(true)
  }

  const openNotificationsPanel = () => {
    setIsAccountOpen(false)
    handleOpenNotifications()
  }

  const askLogout = () => {
    setIsAccountOpen(false)
    setIsLogoutConfirmOpen(true)
  }

  return (
    <>
      {/* Barre latérale — ordinateur */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-ink-100 bg-white px-4 pb-5 pt-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Image
            src="/assets/Favicon.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink-900">CardMania</span>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          <Link
            href={dashboardHref}
            className={sideItem(!!isOnDashboard)}
            aria-current={isOnDashboard ? 'page' : undefined}
          >
            <LayoutGrid className="h-5 w-5" />
            Ma collection
          </Link>
          <Link
            href={wishlistHref}
            className={sideItem(!!isOnWishlist)}
            aria-current={isOnWishlist ? 'page' : undefined}
          >
            <Heart className="h-5 w-5" />
            Souhaits
          </Link>
          <Link
            href="/statistiques"
            className={sideItem(isOnStats)}
            aria-current={isOnStats ? 'page' : undefined}
          >
            <BarChart3 className="h-5 w-5" />
            Statistiques
          </Link>
          <button type="button" onClick={() => setIsFriendsOpen(true)} className={sideItem(false)}>
            <Users className="h-5 w-5" />
            Amis
          </button>
          <button type="button" onClick={handleOpenNotifications} className={sideItem(false)}>
            <Bell className="h-5 w-5" />
            Notifications
            {hasUnreadNotifications && (
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-danger-500" aria-label="Nouvelles notifications" />
            )}
          </button>
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
          <button
            type="button"
            onClick={() => setIsAccountOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:opacity-80"
            aria-label="Ouvrir mon compte"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-base font-bold text-brand-700">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{userName}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition hover:bg-white hover:text-ink-900"
            aria-label="Se déconnecter"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Compte — mobile */}
      {isAccountOpen && (
        <Sheet onClose={() => setIsAccountOpen(false)} title="Mon compte" size="sm">
          <div className="mb-4 flex items-center gap-4 rounded-3xl bg-ink-50 p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-xl font-bold text-brand-700">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink-900">{userName}</p>
              <p className="text-sm text-ink-500">
                {friends.length === 0 ? 'Aucun ami pour le moment' : `${friends.length} ami${friends.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-3xl bg-ink-50 p-4">
            <p className="text-base font-bold text-ink-900">Type de carte préféré</p>
            <p className="mb-3 mt-0.5 text-sm text-ink-500">
              Il sera présélectionné quand tu ajoutes une carte ou un souhait.
            </p>
            <Segmented
              label="Type de carte préféré"
              value={favoriteCardType ?? ('' as FavoriteCardType)}
              onChange={async (value) => {
                setFavoriteSaved(null)
                const ok = await saveFavoriteCardType(value)
                setFavoriteSaved(ok ? 'ok' : 'error')
              }}
              options={[
                { value: 'pokemon', label: 'Pokémon' },
                { value: 'topps', label: 'Topps / Panini' },
              ]}
            />
            {favoriteSaved === 'ok' && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                <Check className="h-4 w-4" />
                Enregistré
              </p>
            )}
            {favoriteSaved === 'error' && (
              <p className="mt-2 text-sm text-danger-600">
                Impossible d&apos;enregistrer sur ton compte. Réessaie dans un instant.
              </p>
            )}
          </div>

          <div className="divide-y divide-ink-100">
            <button type="button" onClick={openNotificationsPanel} className="flex min-h-[60px] w-full items-center gap-4 text-left">
              <Bell className="h-6 w-6 text-ink-500" />
              <span className="flex-1 text-base font-semibold text-ink-900">Notifications</span>
              {hasUnreadNotifications && <span className="tag bg-danger-50 text-danger-600">Nouveau</span>}
              <ChevronRight className="h-5 w-5 text-ink-300" />
            </button>
            <button type="button" onClick={openFriendsPanel} className="flex min-h-[60px] w-full items-center gap-4 text-left">
              <Users className="h-6 w-6 text-ink-500" />
              <span className="flex-1 text-base font-semibold text-ink-900">Mes amis</span>
              <ChevronRight className="h-5 w-5 text-ink-300" />
            </button>
            <button type="button" onClick={askLogout} className="flex min-h-[60px] w-full items-center gap-4 text-left text-danger-600">
              <LogOut className="h-6 w-6" />
              <span className="flex-1 text-base font-semibold">Se déconnecter</span>
            </button>
          </div>
        </Sheet>
      )}

      {/* Amis */}
      {isFriendsOpen && (
        <Sheet onClose={() => setIsFriendsOpen(false)} title="Mes amis" subtitle="Consulte leur collection et leurs souhaits.">
          <div className="space-y-6 pt-1">
            <div>
              <label className="label" htmlFor="friend-search">Ajouter un ami</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                <input
                  id="friend-search"
                  type="text"
                  value={friendSearch}
                  onChange={(e) => {
                    setFriendSearch(e.target.value)
                    setFriendError(null)
                    setFriendSuccess(null)
                  }}
                  placeholder="Pseudo de ton ami"
                  className="field pl-12"
                  autoCapitalize="none"
                />
              </div>
              {friendError && <p className="mt-2 text-sm text-danger-600">{friendError}</p>}
              {friendSuccess && !friendError && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  <Check className="h-4 w-4" />
                  {friendSuccess}
                </p>
              )}
            </div>

            {friendResults.length > 0 && (
              <ul className="space-y-2">
                {friendResults.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5 pl-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-bold text-ink-700 ring-1 ring-inset ring-ink-200">
                      {r.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{r.username}</span>
                    <button
                      type="button"
                      onClick={() => handleAddFriend(r)}
                      disabled={loadingFriendAction}
                      className="btn-primary min-h-[44px] px-4 text-sm"
                    >
                      Ajouter
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <p className="label">Amis actuels</p>
              {friends.length === 0 ? (
                <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">
                  Tu n&apos;as pas encore d&apos;amis. Cherche un pseudo ci-dessus pour envoyer une demande.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {friends.map((f) => (
                    <li key={f.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => {
                          const base = pathname?.startsWith('/souhaits') ? '/souhaits' : '/dashboard'
                          const params = new URLSearchParams()
                          params.set('friend', f.friend_id)
                          params.set('friendName', f.friend_username)
                          router.push(`${base}?${params.toString()}`)
                          setIsFriendsOpen(false)
                        }}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                          {f.friend_username.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink-900">{f.friend_username}</span>
                          <span className="block text-sm text-ink-500">Voir sa collection</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFriendToRemove(f)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
                        aria-label={`Retirer ${f.friend_username} de mes amis`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Sheet>
      )}

      {/* Notifications */}
      {isNotificationsOpen && (
        <Sheet onClose={() => setIsNotificationsOpen(false)} title="Notifications" size="sm">
          <div className="space-y-3 pt-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="h-8 w-8 text-ink-300" />
                <p className="font-semibold text-ink-900">Tout est à jour</p>
                <p className="text-sm text-ink-500">Les demandes d&apos;amis apparaîtront ici.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const payload = (notif.payload || {}) as any
                const isFriendRequest = notif.type === 'friend_request'
                const requesterUsername = payload.requester_username || 'Un utilisateur'
                return (
                  <div key={notif.id} className="space-y-3 rounded-3xl bg-ink-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ink-700">
                        {isFriendRequest ? (
                          <>
                            <span className="font-bold text-ink-900">{requesterUsername}</span> souhaite t&apos;ajouter
                            comme ami.
                          </>
                        ) : (
                          'Nouvelle notification.'
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveNotification(notif.id)}
                        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                        aria-label="Supprimer la notification"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {isFriendRequest && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={loadingFriendAction}
                          onClick={() => handleRespondFriendRequest(notif, true)}
                          className="btn-primary flex-1"
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          disabled={loadingFriendAction}
                          onClick={() => handleRespondFriendRequest(notif, false)}
                          className="btn-secondary flex-1"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </Sheet>
      )}

      {/* Déconnexion */}
      {isLogoutConfirmOpen && (
        <Sheet onClose={() => setIsLogoutConfirmOpen(false)} title="Se déconnecter ?" size="sm" z="z-[60]">
          <p className="text-ink-500">Tu pourras te reconnecter à tout moment avec ton pseudo.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setIsLogoutConfirmOpen(false)} className="btn-secondary flex-1">
              Rester connecté
            </button>
            <button type="button" onClick={onLogout} className="btn-danger flex-1">
              Se déconnecter
            </button>
          </div>
        </Sheet>
      )}

      {/* Suppression d'ami */}
      {friendToRemove && (
        <Sheet onClose={() => setFriendToRemove(null)} title="Retirer cet ami ?" size="sm" z="z-[60]">
          <p className="text-ink-500">
            {friendToRemove.friend_username
              ? `${friendToRemove.friend_username} disparaîtra de ta liste d'amis. Vous pourrez vous ajouter de nouveau plus tard.`
              : 'Cet ami disparaîtra de ta liste.'}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setFriendToRemove(null)} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="button" disabled={loadingFriendAction} onClick={handleRemoveFriend} className="btn-danger flex-1">
              Retirer
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}
