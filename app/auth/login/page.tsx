'use client'

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      console.log('[Auth][Username] Start', { mode: isSignUp ? 'signup' : 'login', username })
      setLoading(true)
      setError(null)
      setInfo(null)

      if (isSignUp) {
        // On génère un email interne basé sur le username, uniquement pour Supabase Auth
        const internalEmail = `${username}@cardmania.local`

        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              username,
            },
          },
        })
        console.log('[Auth][Username][Signup] Result', { data, error })
        if (error) {
          // Si la contrainte d'unicité sur username renvoie une erreur SQL,
          // on affiche un message plus clair.
          if (String(error.message).toLowerCase().includes('duplicate') || String(error.message).toLowerCase().includes('unique')) {
            setError("Ce nom d'utilisateur est déjà pris. Choisissez-en un autre.")
            return
          }
          throw error
        }

        if (data.session) {
          console.log('[Auth][Username][Signup] Session active, redirect to /dashboard')
          window.location.href = '/dashboard'
        } else {
          // Si les emails de confirmation sont encore activés côté Supabase
          setError("Compte créé. Si nécessaire, vérifiez l'email associé à votre compte.")
        }
      } else {
        // Connexion : on récupère d'abord l'email associé à ce username via une fonction SQL
        const { data: emailResult, error: emailError } = await supabase.rpc('get_email_for_username', {
          p_username: username,
        })

        if (emailError) {
          console.error('[Auth][Username][Login] Lookup error', emailError)
          throw emailError
        }

        const resolvedEmail = typeof emailResult === 'string' ? emailResult : (emailResult as any)?.email

        if (!resolvedEmail) {
          setError("Nom d'utilisateur ou mot de passe incorrect.")
          return
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        })
        console.log('[Auth][Username][Login] Result', { data, error })
        if (error) throw error
        console.log('[Auth][Username][Login] Redirect to /dashboard')
        window.location.href = '/dashboard'
      }
    } catch (error: any) {
      console.error('[Auth][Username] Error', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const normalizedUsername = username.trim().toLowerCase()
    if (!normalizedUsername) {
      setError("Entre d'abord ton nom d'utilisateur pour réinitialiser ton mot de passe.")
      setInfo(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setInfo(null)

      const { data: emailResult, error: emailError } = await supabase.rpc('get_email_for_username', {
        p_username: normalizedUsername,
      })

      if (emailError) throw emailError

      const resolvedEmail = typeof emailResult === 'string' ? emailResult : (emailResult as any)?.email

      if (!resolvedEmail) {
        setError("Nom d'utilisateur introuvable.")
        return
      }

      const origin = window.location.origin
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
        redirectTo: `${origin}/auth/reset-password`,
      })

      if (resetError) throw resetError

      setInfo("Email de réinitialisation envoyé. Vérifie ta boîte mail.")
    } catch (forgotError: any) {
      setError(forgotError.message ?? "Impossible d'envoyer l'email de réinitialisation.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[1.05fr_1fr]">
      {/* Bandeau de marque */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-b-[40px] bg-brand-500 px-6 pb-14 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center text-white md:rounded-none md:px-14 md:py-16 md:text-left">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/60" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sun-400/90 max-md:hidden" aria-hidden />

        <div className="relative flex flex-col items-center md:items-start">
          <Image
            src="/assets/Favicon.png"
            alt="CardMania"
            width={200}
            height={200}
            className="h-28 w-28 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)] md:h-36 md:w-36"
            priority
          />
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight md:text-5xl">CardMania</h1>
          <p className="mt-3 max-w-sm text-lg text-white/90">Ta collection de cartes, toujours dans ta poche.</p>

          <ul className="mt-10 hidden max-w-sm space-y-4 md:block">
            {[
              'Photographie tes cartes en haute définition',
              'Suis ce que tu as dépensé, carte par carte',
              'Montre ta collection à tes amis',
            ].map((text) => (
              <li key={text} className="flex items-start gap-3 text-base font-medium">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center px-5 py-8 pb-safe md:px-12">
        <div className="-mt-6 w-full max-w-md rounded-[28px] bg-white p-6 shadow-lift sm:p-8 md:mt-0 md:bg-transparent md:p-0 md:shadow-none">
          <h2 className="font-display text-2xl font-bold text-ink-900">
            {isSignUp ? 'Créer un compte' : 'Content de te revoir'}
          </h2>
          <p className="mt-1.5 text-ink-500">
            {isSignUp ? 'Choisis un pseudo et un mot de passe.' : 'Connecte-toi pour retrouver ta collection.'}
          </p>

          {error && (
            <div
              role="alert"
              className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${
                error.startsWith('Compte créé') ? 'bg-brand-50 text-brand-700' : 'bg-danger-50 text-danger-600'
              }`}
            >
              {error}
            </div>
          )}
          {info && (
            <div className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">{info}</div>
          )}

          <form onSubmit={handleAuth} className="mt-6 space-y-5">
            <div>
              <label className="label" htmlFor="username">Nom d&apos;utilisateur</label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field"
                placeholder="Ton pseudo"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="Au moins 6 caractères"
                minLength={6}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Chargement…' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>

          {!isSignUp && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center text-sm font-semibold text-brand-600 hover:underline disabled:opacity-50"
            >
              Mot de passe oublié ?
            </button>
          )}

          <div className="mt-4 border-t border-ink-100 pt-5 text-center">
            <p className="text-sm text-ink-500">{isSignUp ? 'Tu as déjà un compte ?' : "Tu n'as pas encore de compte ?"}</p>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setInfo(null)
              }}
              className="btn-secondary mt-3 w-full"
            >
              {isSignUp ? 'Me connecter' : 'Créer un compte'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
