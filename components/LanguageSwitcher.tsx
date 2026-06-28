'use client'

import { createClient } from '@/lib/supabase/client'
import { useUser } from './UserProvider'

export function LanguageSwitcher() {
  const { profile, refresh } = useUser()
  const supabase = createClient()

  if (!profile) return null
  const currentLang = (profile.language ?? 'sv') as 'sv' | 'uk'

  async function switchLang(lang: 'sv' | 'uk') {
    if (lang === currentLang) return
    await supabase.from('profiles').update({ language: lang }).eq('id', profile!.id)
    refresh()
  }

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => switchLang('sv')}
        className={`px-2 py-1 rounded text-sm ${currentLang === 'sv' ? 'bg-white shadow' : 'opacity-50'}`}
      >
        🇸🇪
      </button>
      <button
        onClick={() => switchLang('uk')}
        className={`px-2 py-1 rounded text-sm ${currentLang === 'uk' ? 'bg-white shadow' : 'opacity-50'}`}
      >
        🇺🇦
      </button>
    </div>
  )
}
