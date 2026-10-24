'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  onClose: () => void
  title?: string
  /** Texte secondaire sous le titre */
  subtitle?: string
  children: ReactNode
  /** Zone collée en bas (boutons d'action) */
  footer?: ReactNode
  /**
   * modal : fenêtre centrée sur ordinateur
   * drawer : tiroir à droite sur ordinateur
   * Sur téléphone, les deux montent depuis le bas de l'écran.
   */
  variant?: 'modal' | 'drawer'
  size?: 'sm' | 'md' | 'lg'
  /** Classe de z-index, pour empiler un panneau au-dessus d'un autre */
  z?: string
  /** Désactivé pour les formulaires : un clic à côté ne doit pas faire perdre la saisie */
  dismissOnBackdrop?: boolean
}

// Plusieurs panneaux peuvent être empilés (formulaire + cadrage photo) :
// on compte les panneaux ouverts et on ne rend le défilement qu'à la fermeture du dernier.
let openSheets = 0

function lockScroll() {
  openSheets += 1
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  openSheets = Math.max(0, openSheets - 1)
  if (openSheets === 0) document.body.style.overflow = ''
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

export default function Sheet({
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = 'modal',
  size = 'md',
  z = 'z-50',
  dismissOnBackdrop = true,
}: SheetProps) {
  // onClose change à chaque rendu du parent : on le garde dans une ref pour ne pas
  // réinstaller le verrouillage du défilement à chaque fois
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [])

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={`sheet-backdrop fixed inset-0 ${z} flex items-end justify-center bg-ink-900/40 backdrop-blur-[2px] ${
        isDrawer ? 'md:items-stretch md:justify-end' : 'sm:items-center sm:p-6'
      }`}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`sheet-panel ${isDrawer ? 'drawer' : ''} flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-sheet ${
          isDrawer
            ? 'md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-[28px]'
            : `sm:rounded-[28px] ${SIZES[size]}`
        }`}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-ink-200" />
        </div>

        {title !== undefined && (
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold leading-tight text-ink-900">{title}</h2>
              {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="btn-icon -mr-1 -mt-1" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">{children}</div>

        {footer && (
          <div className="border-t border-ink-100 bg-white px-5 pb-safe pt-3 sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  )
}
