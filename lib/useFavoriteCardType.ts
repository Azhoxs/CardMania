'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type FavoriteCardType = 'pokemon' | 'topps'

const STORAGE_KEY = 'cardmania:favoriteCardType'
const EVENT_NAME = 'cardmania:favoriteCardType'

const isCardType = (value: unknown): value is FavoriteCardType =>
  value === 'pokemon' || value === 'topps'

/**
 * Type de carte préféré de l'utilisateur, stocké dans les métadonnées de son compte
 * Supabase (aucune migration SQL nécessaire). Une copie locale évite le temps
 * d'attente au chargement. Tous les composants qui utilisent ce hook restent synchronisés.
 */
export function useFavoriteCardType() {
  const [favoriteCardType, setFavoriteCardType] = useState<FavoriteCardType | null>(null)

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(STORAGE_KEY)
      if (isCardType(cached)) setFavoriteCardType(cached)
    } catch {
      /* stockage indisponible */
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const value = data.user.user_metadata?.favorite_card_type
      if (isCardType(value)) {
        setFavoriteCardType(value)
        try {
          window.localStorage.setItem(STORAGE_KEY, value)
        } catch {
          /* ignoré */
        }
      } else {
        // Ce compte n'a rien choisi : on n'hérite pas du choix d'un autre compte
        setFavoriteCardType(null)
        try {
          window.localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignoré */
        }
      }
    })

    const onChange = (e: Event) => {
      const value = (e as CustomEvent).detail
      if (isCardType(value)) setFavoriteCardType(value)
    }
    window.addEventListener(EVENT_NAME, onChange)
    return () => window.removeEventListener(EVENT_NAME, onChange)
  }, [])

  /** Renvoie false si l'enregistrement sur le compte a échoué. */
  const saveFavoriteCardType = useCallback(async (value: FavoriteCardType) => {
    setFavoriteCardType(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignoré */
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }))

    const { error } = await supabase.auth.updateUser({ data: { favorite_card_type: value } })
    return !error
  }, [])

  return { favoriteCardType, saveFavoriteCardType }
}
