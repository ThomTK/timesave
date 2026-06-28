'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { SickLeaveReport } from '@/lib/types'
import { t } from '@/lib/i18n'
import { format } from 'date-fns'

export default function SickLeavePage() {
  const { profile } = useUser()
  const lang = profile?.language ?? 'sv'
  const [reports, setReports] = useState<SickLeaveReport[]>([])
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const { data } = await supabase
      .from('sick_leave_reports')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
    setReports(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)

    await supabase.from('sick_leave_reports').insert({
      user_id: profile.id,
      start_date: startDate,
      end_date: endDate || null,
      note: note || null,
    })

    setShowForm(false)
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate('')
    setNote('')
    await load()
    setLoading(false)
  }

  const labels = {
    sv: {
      title: 'Sjukfrånvaro',
      report: '+ Anmäl',
      formTitle: 'Anmäl sjukfrånvaro',
      start: 'Första sjukdag',
      end: 'Sista sjukdag (om känd)',
      note: 'Anteckning (valfritt)',
      cancel: 'Avbryt',
      submit: 'Skicka',
      sending: 'Skickar...',
      empty: 'Inga sjukanmälningar',
      ongoing: 'Pågående',
    },
    uk: {
      title: 'Лікарняний',
      report: '+ Повідомити',
      formTitle: 'Повідомити про лікарняний',
      start: 'Перший день хвороби',
      end: 'Останній день хвороби (якщо відомо)',
      note: 'Примітка (необов\'язково)',
      cancel: 'Скасувати',
      submit: 'Надіслати',
      sending: 'Надсилання...',
      empty: 'Немає повідомлень про лікарняний',
      ongoing: 'Триває',
    },
  }
  const l = labels[lang as 'sv' | 'uk'] ?? labels.sv

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{l.title}</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {l.report}
        </button>
      </div>

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
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? l.sending : l.submit}
            </button>
          </div>
        </form>
      )}

      {reports.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{l.empty}</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="font-medium text-gray-900">
                {format(new Date(r.start_date), 'dd/MM/yyyy')}
                {r.end_date ? ` – ${format(new Date(r.end_date), 'dd/MM/yyyy')}` : ` – ${l.ongoing}`}
              </p>
              {r.note && <p className="text-sm text-gray-600 mt-0.5">{r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
