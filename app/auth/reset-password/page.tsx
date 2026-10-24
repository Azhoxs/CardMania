'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const bootstrapRecoverySession = async () => {
      try {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type')

        if (type === 'recovery' && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (!session) {
            throw new Error('Lien de réinitialisation invalide ou expiré.')
          }
        }

        if (isMounted) {
          setReady(true)
        }
      } catch (bootstrapError: any) {
        if (isMounted) {
          setError(bootstrapError.message ?? 'Impossible de préparer la réinitialisation du mot de passe.')
        }
      }
    }

    bootstrapRecoverySession()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      setSuccess(null)
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setSuccess(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setSuccess('Mot de passe mis à jour. Redirection vers la connexion...')
      setTimeout(() => {
        router.push('/auth/login')
      }, 1200)
    } catch (submitError: any) {
      setError(submitError.message ?? 'Impossible de mettre à jour le mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10 pb-safe">
      <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-lift sm:p-8">
        <h1 className="font-display text-2xl font-bold text-ink-900">Nouveau mot de passe</h1>
        <p className="mt-1.5 text-ink-500">Choisis un nouveau mot de passe pour ton compte.</p>

        {error && (
          <div role="alert" className="mt-5 rounded-2xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="label" htmlFor="new-password">Nouveau mot de passe</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field disabled:opacity-60"
              placeholder="Au moins 6 caractères"
              disabled={!ready || loading}
            />
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">Confirmer le mot de passe</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field disabled:opacity-60"
              placeholder="Retape le mot de passe"
              disabled={!ready || loading}
            />
          </div>

          <button type="submit" disabled={!ready || loading} className="btn-primary w-full">
            {loading ? 'Mise à jour…' : 'Valider le mot de passe'}
          </button>
        </form>
      </section>
    </main>
  )
}
