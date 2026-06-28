'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Något gick fel, försök igen')
      setLoading(false)
    } else {
      setDone(true)
      setLoading(false)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">TimeSave</h1>
          <p className="text-blue-200 mt-2">Nytt lösenord</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          {!ready ? (
            <p className="text-sm text-gray-600">Verifierar länk...</p>
          ) : done ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Lösenordet är uppdaterat! Loggar in...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nytt lösenord</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="new-password"
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
                {loading ? 'Sparar...' : 'Spara nytt lösenord'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
