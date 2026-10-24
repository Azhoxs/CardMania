'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { LayoutGrid, Heart, Plus, BarChart3, CircleUser } from 'lucide-react'

interface NavbarMobileProps {
  /** Si absent (ex. page statistiques), le bouton central n'est pas affiché */
  onAdd?: () => void
  /** Texte accessible du bouton d'ajout, selon la page */
  addLabel?: string
}

export default function NavbarMobile({ onAdd, addLabel = 'Ajouter une carte' }: NavbarMobileProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    setHasUnread(Boolean((window as any).__cmUnread))
    const onUnread = (e: Event) => setHasUnread(Boolean((e as CustomEvent).detail))
    window.addEventListener('cardmania:unread', onUnread)
    return () => window.removeEventListener('cardmania:unread', onUnread)
  }, [])

  const activeFriendId = searchParams.get('friend')
  const activeFriendName = searchParams.get('friendName')

  const buildHref = (base: string) => {
    if (!activeFriendId) return base
    const params = new URLSearchParams()
    params.set('friend', activeFriendId)
    if (activeFriendName) params.set('friendName', activeFriendName)
    return `${base}?${params.toString()}`
  }

  const onDashboard = !!pathname?.startsWith('/dashboard')
  const onWishlist = pathname === '/souhaits'
  const onStats = !!pathname?.startsWith('/statistiques')
  const canAdd = !!onAdd && !activeFriendId

  const tab = (active: boolean) =>
    `flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
      active ? 'text-brand-600' : 'text-ink-500'
    }`

  const iconWrap = (active: boolean) =>
    `flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
      active ? 'bg-brand-100 scale-105' : ''
    }`

  return (
    <>
      {/* En-tête : logo et nom du site */}
      <header
        className="fixed inset-x-0 top-0 z-40 bg-brand-500 text-white shadow-[0_4px_0_rgba(24,47,179,0.35)] md:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/assets/Favicon.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]"
              priority
            />
            <span className="truncate font-display text-lg font-extrabold tracking-tight">CardMania</span>
          </div>

        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex max-w-lg items-end px-1">
          <button
            type="button"
            onClick={() => router.push(buildHref('/dashboard'))}
            className={tab(onDashboard)}
            aria-current={onDashboard ? 'page' : undefined}
          >
            <span className={iconWrap(onDashboard)}>
              <LayoutGrid className="h-6 w-6" strokeWidth={onDashboard ? 2.5 : 2} />
            </span>
            Collection
          </button>

          <button
            type="button"
            onClick={() => router.push(buildHref('/souhaits'))}
            className={tab(onWishlist)}
            aria-current={onWishlist ? 'page' : undefined}
          >
            <span className={iconWrap(onWishlist)}>
              <Heart className="h-6 w-6" strokeWidth={onWishlist ? 2.5 : 2} />
            </span>
            Souhaits
          </button>

          {canAdd && (
            <div className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={onAdd}
                aria-label={addLabel}
                className="-mt-7 flex h-[68px] w-[68px] items-center justify-center rounded-full border-b-[6px] border-sun-600 bg-sun-400 text-ink-900 ring-4 ring-white transition active:translate-y-[3px] active:border-b-[3px]"
              >
                <Plus className="h-9 w-9" strokeWidth={3} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/statistiques')}
            className={tab(onStats)}
            aria-current={onStats ? 'page' : undefined}
          >
            <span className={iconWrap(onStats)}>
              <BarChart3 className="h-6 w-6" strokeWidth={onStats ? 2.5 : 2} />
            </span>
            Stats
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cardmania:openAccount'))}
            className={tab(false)}
          >
            <span className={iconWrap(false)}>
              <span className="relative">
                <CircleUser className="h-6 w-6" strokeWidth={2} />
                {hasUnread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-danger-500 ring-2 ring-white" />
                )}
              </span>
            </span>
            Compte
          </button>
        </div>
      </nav>
    </>
  )
}
