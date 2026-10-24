'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

const STORAGE_KEY = 'cardmania:monthlyBudget'

/**
 * Budget mensuel (en euros) choisi par l'utilisateur.
 * Stocké dans les métadonnées de son compte, avec une copie locale pour un affichage instantané.
 */
export function useMonthlyBudget() {
  const [budget, setBudget] = useState<number | null>(null)

  useEffect(() => {
    try {
      const cached = Number(window.localStorage.getItem(STORAGE_KEY))
      if (cached > 0) setBudget(cached)
    } catch {
      /* stockage indisponible */
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const value = Number(data.user.user_metadata?.monthly_budget)
      if (value > 0) {
        setBudget(value)
        try {
          window.localStorage.setItem(STORAGE_KEY, String(value))
        } catch {
          /* ignoré */
        }
      } else {
        // Ce compte n'a pas de budget : on n'hérite pas de celui d'un autre compte
        setBudget(null)
        try {
          window.localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignoré */
        }
      }
    })
  }, [])

  /** Passer null supprime le budget. Renvoie false si l'enregistrement a échoué. */
  const saveBudget = useCallback(async (value: number | null) => {
    setBudget(value)
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, String(value))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignoré */
    }
    const { error } = await supabase.auth.updateUser({ data: { monthly_budget: value } })
    return !error
  }, [])

  return { budget, saveBudget }
}
