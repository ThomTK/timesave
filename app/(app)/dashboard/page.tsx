'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { TimeEntry } from '@/lib/types'
import { format, differenceInMinutes, startOfMonth, endOfMonth } from 'date-fns'
import { sv as dateSv, uk as dateUk } from 'date-fns/locale'

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}t ${m}m`
}

const labels = {
  sv: {
    clockedIn: 'Instämplad',
    clockedOut: 'Utstämplad',
    since: 'Sedan',
    saving: 'Sparar...',
    clockOut: '🔴 Stämpla ut',
    clockIn: '🟢 Stämpla in',
    thisMonth: 'Denna månad',
    applyVacation: 'Ansök semester',
    requestCorrection: 'Begär rättelse',
    reportSick: 'Sjukanmälan',
    logout: 'Logga ut',
    loading: 'Laddar...',
    hej: 'Hej',
  },
  uk: {
    clockedIn: 'На роботі',
    clockedOut: 'Не на роботі',
    since: 'З',
    saving: 'Збереження...',
    clockOut: '🔴 Відмітити відхід',
    clockIn: '🟢 Відмітити прихід',
    thisMonth: 'Цього місяця',
    applyVacation: 'Подати на відпустку',
    requestCorrection: 'Запит на виправлення',
    reportSick: 'Лікарняний',
    logout: 'Вийти',
    loading: 'Завантаження...',
    hej: 'Привіт',
  },
}

export default function DashboardPage() {
  const { profile } = useUser()
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [monthMinutes, setMonthMinutes] = useState(0)
  const [now, setNow] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    if (!profile) return

    // Active entry (clocked in, no clock_out)
    const { data: active } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', profile.id)
      .is('clock_out', null)
      .maybeSingle()

    setActiveEntry(active)

    // This month's total
    const start = startOfMonth(new Date()).toISOString()
    const end = endOfMonth(new Date()).toISOString()
    const { data: entries } = await supabase
      .from('time_entries')
      .select('clock_in, clock_out, break_minutes')
      .eq('user_id', profile.id)
      .gte('clock_in', start)
      .lte('clock_in', end)
      .not('clock_out', 'is', null)

    const total = (entries ?? []).reduce((sum, e) => {
      const mins = differenceInMinutes(new Date(e.clock_out!), new Date(e.clock_in)) - (e.break_minutes ?? 0)
      return sum + Math.max(0, mins)
    }, 0)
    setMonthMinutes(total)
    setLoading(false)
  }, [profile, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  async function handleClockIn() {
    if (!profile || actionLoading) return
    setActionLoading(true)

    await supabase.from('time_entries').insert({
      user_id: profile.id,
      clock_in: new Date().toISOString(),
      entry_type: 'work',
    })

    await loadData()
    setActionLoading(false)
  }

  async function handleClockOut() {
    if (!activeEntry || actionLoading || !profile) return
    setActionLoading(true)

    // Load company settings for auto break (fallback if employee has no personal override)
    const { data: settings } = await supabase
      .from('company_settings')
      .select('break_mode, auto_break_minutes')
      .single()

    const breakMode = profile.break_mode ?? settings?.break_mode
    const autoBreakMinutes = profile.auto_break_minutes ?? settings?.auto_break_minutes ?? 30

    const workMinutes = differenceInMinutes(new Date(), new Date(activeEntry.clock_in))
    const breakMins =
      breakMode === 'auto' && workMinutes >= 60
        ? autoBreakMinutes
        : 0

    await supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString(), break_minutes: breakMins })
      .eq('id', activeEntry.id)

    await loadData()
    setActionLoading(false)
  }

  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const dateLocale = lang === 'uk' ? dateUk : dateSv

  if (loading || !profile) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">{l.loading}</div>
  }

  const workedToday = activeEntry
    ? differenceInMinutes(now, new Date(activeEntry.clock_in))
    : 0

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-gray-600 text-sm">{format(now, 'EEEE d MMMM', { locale: dateLocale })}</p>
        <h1 className="text-2xl font-bold text-gray-900">{l.hej}, {profile.full_name.split(' ')[0]}</h1>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl p-6 mb-6 text-center shadow-sm ${
        activeEntry ? 'bg-green-50 border-2 border-green-200' : 'bg-white border border-gray-200'
      }`}>
        <div className={`text-5xl mb-3 ${activeEntry ? 'animate-pulse' : ''}`}>
          {activeEntry ? '🟢' : '⚪'}
        </div>
        <p className={`text-lg font-semibold ${activeEntry ? 'text-green-800' : 'text-gray-700'}`}>
          {activeEntry ? l.clockedIn : l.clockedOut}
        </p>
        {activeEntry && (
          <p className="text-green-700 text-sm mt-1">
            {l.since} {format(new Date(activeEntry.clock_in), 'HH:mm')} — {formatDuration(workedToday)}
          </p>
        )}
      </div>

      {/* Main action button */}
      {activeEntry ? (
        <button
          onClick={handleClockOut}
          disabled={actionLoading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xl py-6 rounded-2xl shadow-lg transition-colors active:scale-95"
        >
          {actionLoading ? l.saving : l.clockOut}
        </button>
      ) : (
        <button
          onClick={handleClockIn}
          disabled={actionLoading}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xl py-6 rounded-2xl shadow-lg transition-colors active:scale-95"
        >
          {actionLoading ? l.saving : l.clockIn}
        </button>
      )}

      {/* Month summary */}
      <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-600 mb-1">{l.thisMonth}</p>
        <p className="text-3xl font-bold text-gray-900">{formatDuration(monthMinutes)}</p>
        <p className="text-xs text-gray-500 mt-1 capitalize">
          {format(new Date(), 'MMMM yyyy', { locale: dateLocale })}
        </p>
      </div>

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <a href="/vacation" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50">
          <span className="text-2xl">🌴</span>
          <span className="text-sm font-medium text-gray-700">{l.applyVacation}</span>
        </a>
        <a href="/sick" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50">
          <span className="text-2xl">🤒</span>
          <span className="text-sm font-medium text-gray-700">{l.reportSick}</span>
        </a>
        <a href="/corrections" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 col-span-2">
          <span className="text-2xl">✏️</span>
          <span className="text-sm font-medium text-gray-700">{l.requestCorrection}</span>
        </a>
      </div>

      {/* Logout */}
      <div className="mt-6 text-center">
        <LogoutButton label={l.logout} />
      </div>
    </div>
  )
}

function LogoutButton({ label }: { label: string }) {
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-600">
      {label}
    </button>
  )
}
