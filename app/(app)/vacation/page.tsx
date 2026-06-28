'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { CompanySettings, VacationBalance, VacationRequest } from '@/lib/types'
import { calculateVacationSummary, VacationSummary } from '@/lib/vacation'
import { format } from 'date-fns'

const statusLabelByLang = {
  sv: { pending: 'Väntar', approved: 'Godkänd', rejected: 'Nekad' },
  uk: { pending: 'Очікує', approved: 'Схвалено', rejected: 'Відхилено' },
}

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const labels = {
  sv: {
    title: 'Semester',
    apply: '+ Ansök',
    hourlyNote: 'Semesterersättning läggs på din timlön varje löneperiod — ingen dagräkning behövs.',
    available: 'Tillgängliga',
    earned: 'Intjänade i år',
    used: 'Använda i år',
    perYear: 'dagar/år',
    perMonth: 'dagar/månad',
    carried: 'sparade från förra året',
    formTitle: 'Ny semesteransökan',
    start: 'Startdatum',
    end: 'Slutdatum',
    note: 'Anteckning (valfritt)',
    cancel: 'Avbryt',
    submit: 'Skicka',
    sending: 'Skickar...',
    empty: 'Inga ansökningar',
  },
  uk: {
    title: 'Відпустка',
    apply: '+ Подати',
    hourlyNote: 'Відпускні нараховуються на вашу погодинну ставку щоперіоду — облік днів не потрібен.',
    available: 'Доступно',
    earned: 'Накопичено цього року',
    used: 'Використано цього року',
    perYear: 'днів/рік',
    perMonth: 'днів/місяць',
    carried: 'перенесено з минулого року',
    formTitle: 'Нова заявка на відпустку',
    start: 'Дата початку',
    end: 'Дата закінчення',
    note: 'Примітка (необов\'язково)',
    cancel: 'Скасувати',
    submit: 'Надіслати',
    sending: 'Надсилання...',
    empty: 'Немає заявок',
  },
}

export default function VacationPage() {
  const { profile } = useUser()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const statusLabel = statusLabelByLang[lang]

  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [summary, setSummary] = useState<VacationSummary | null>(null)
  const [vacationPayPercent, setVacationPayPercent] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const currentYear = new Date().getFullYear()
    const [{ data: reqData }, { data: settingsData }, { data: balanceData }] = await Promise.all([
      supabase.from('vacation_requests').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').single(),
      supabase.from('vacation_balances').select('*').eq('user_id', profile!.id).eq('year', currentYear).maybeSingle(),
    ])
    setRequests(reqData ?? [])

    if (settingsData) {
      const approved = (reqData ?? []).filter(r => r.status === 'approved')
      setSummary(calculateVacationSummary(profile!, settingsData as CompanySettings, balanceData as VacationBalance | null, approved))
      setVacationPayPercent((settingsData as CompanySettings).vacation_pay_percent)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)

    await supabase.from('vacation_requests').insert({
      user_id: profile.id,
      start_date: startDate,
      end_date: endDate,
      note: note || null,
    })

    setShowForm(false)
    setStartDate('')
    setEndDate('')
    setNote('')
    await load()
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{l.title}</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {l.apply}
        </button>
      </div>

      {profile?.employment_type === 'hourly' && vacationPayPercent !== null && (
        <div className="bg-blue-50 rounded-2xl p-5 mb-5 text-center">
          <p className="text-2xl font-bold text-blue-900">{vacationPayPercent}%</p>
          <p className="text-sm text-blue-700 mt-1">{l.hourlyNote}</p>
        </div>
      )}

      {summary && profile?.employment_type === 'monthly' && (
        <div className="bg-blue-50 rounded-2xl p-5 mb-5">
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <p className="text-2xl font-bold text-blue-900">{summary.available}</p>
              <p className="text-xs text-blue-700">{l.available}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{summary.earnedThisYear}</p>
              <p className="text-xs text-blue-700">{l.earned}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{summary.usedThisYear}</p>
              <p className="text-xs text-blue-700">{l.used}</p>
            </div>
          </div>
          <p className="text-xs text-blue-700 text-center">
            {summary.annualDays} {l.perYear} · {summary.accrualPerMonth.toFixed(2)} {l.perMonth}
            {summary.carriedOver > 0 && ` · ${summary.carriedOver} ${l.carried}`}
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5 space-y-4">
          <h2 className="font-semibold text-gray-900">{l.formTitle}</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.start}</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.end}</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
              min={startDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.note}</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600">
              {l.cancel}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? l.sending : l.submit}
            </button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{l.empty}</p>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(r.start_date), 'dd/MM/yyyy')} – {format(new Date(r.end_date), 'dd/MM/yyyy')}
                  </p>
                  {r.note && <p className="text-sm text-gray-600 mt-0.5">{r.note}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
