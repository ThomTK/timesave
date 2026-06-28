'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Fel e-post eller lösenord')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError('Något gick fel, försök igen')
      setLoading(false)
    } else {
      setResetSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">TimeSave</h1>
          <p className="text-blue-200 mt-2">TK Fönster AB</p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="namn@tkfonster.se"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-base transition-colors"
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('reset'); setError(''); setResetSent(false) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Glömt lösenord?
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetRequest} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Återställ lösenord</h2>

            {resetSent ? (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Om kontot finns har vi skickat ett mejl med instruktioner till {email}.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="namn@tkfonster.se"
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-base transition-colors"
                >
                  {loading ? 'Skickar...' : 'Skicka återställningslänk'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setResetSent(false) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Tillbaka till inloggning
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
