'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { TimeEntry } from '@/lib/types'
import { format, differenceInMinutes, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { sv as dateSv, uk as dateUk } from 'date-fns/locale'

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}t ${m}m`
}

const entryTypeLabelsByLang = {
  sv: { work: 'Arbete', sick: 'Sjuk', vacation: 'Semester', overtime: 'Övertid' },
  uk: { work: 'Робота', sick: 'Хворий', vacation: 'Відпустка', overtime: 'Понаднормово' },
}

const labels = {
  sv: {
    title: 'Historik',
    currentMonth: 'Denna månad',
    previous: 'Föregående',
    total: 'Totalt',
    loading: 'Laddar...',
    empty: 'Inga stämplingar',
    break: 'rast',
    clockedNow: 'Instämplad just nu',
  },
  uk: {
    title: 'Історія',
    currentMonth: 'Цього місяця',
    previous: 'Попередній',
    total: 'Загалом',
    loading: 'Завантаження...',
    empty: 'Немає записів',
    break: 'перерва',
    clockedNow: 'Зараз на роботі',
  },
}

export default function HistoryPage() {
  const { profile } = useUser()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const entryTypeLabels = entryTypeLabelsByLang[lang]
  const dateLocale = lang === 'uk' ? dateUk : dateSv

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [month, setMonth] = useState<'current' | 'previous'>('current')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return
    load()
  }, [profile, month])

  async function load() {
    setLoading(true)
    const base = month === 'current' ? new Date() : subMonths(new Date(), 1)
    const start = startOfMonth(base).toISOString()
    const end = endOfMonth(base).toISOString()

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', profile!.id)
      .gte('clock_in', start)
      .lte('clock_in', end)
      .order('clock_in', { ascending: false })

    setEntries(data ?? [])
    setLoading(false)
  }

  const totalMinutes = entries
    .filter(e => e.clock_out)
    .reduce((sum, e) => {
      const mins = differenceInMinutes(new Date(e.clock_out!), new Date(e.clock_in)) - (e.break_minutes ?? 0)
      return sum + Math.max(0, mins)
    }, 0)

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{l.title}</h1>

      {/* Month toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['current', 'previous'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              month === m ? 'bg-white shadow text-blue-700' : 'text-gray-600'
            }`}
          >
            {m === 'current' ? l.currentMonth : l.previous}
          </button>
        ))}
      </div>

      {/* Total */}
      <div className="bg-blue-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-700">{l.total}</p>
        <p className="text-2xl font-bold text-blue-900">{formatDuration(totalMinutes)}</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">{l.loading}</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{l.empty}</p>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const mins = entry.clock_out
              ? Math.max(0, differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) - entry.break_minutes)
              : null

            return (
              <div key={entry.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(entry.clock_in), 'EEEE d MMM', { locale: dateLocale })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(entry.clock_in), 'HH:mm')}
                      {entry.clock_out && ` – ${format(new Date(entry.clock_out), 'HH:mm')}`}
                      {entry.break_minutes > 0 && ` (${entry.break_minutes}m ${l.break})`}
                    </p>
                  </div>
                  <div className="text-right">
                    {mins !== null && (
                      <p className="font-bold text-gray-800">{formatDuration(mins)}</p>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.entry_type === 'work' ? 'bg-blue-100 text-blue-700' :
                      entry.entry_type === 'sick' ? 'bg-red-100 text-red-700' :
                      entry.entry_type === 'vacation' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {entryTypeLabels[entry.entry_type as keyof typeof entryTypeLabels] ?? entry.entry_type}
                    </span>
                  </div>
                </div>
                {!entry.clock_out && (
                  <p className="text-xs text-green-600 mt-1 font-medium">{l.clockedNow}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
