'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { CorrectionRequest, TimeEntry } from '@/lib/types'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

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
    title: 'Rättelser',
    request: '+ Begär',
    formTitle: 'Begär rättelse',
    selectEntry: 'Stämpling att rätta (valfritt)',
    choose: 'Välj stämpling...',
    correctIn: 'Korrekt instämpling',
    correctOut: 'Korrekt utstämpling',
    reason: 'Orsak *',
    reasonPlaceholder: 'Beskriv vad som ska rättas...',
    cancel: 'Avbryt',
    submit: 'Skicka',
    sending: 'Skickar...',
    empty: 'Inga rättelseförfrågningar',
    inLabel: 'In',
    outLabel: 'Ut',
  },
  uk: {
    title: 'Виправлення',
    request: '+ Запит',
    formTitle: 'Запит на виправлення',
    selectEntry: 'Запис для виправлення (необов\'язково)',
    choose: 'Виберіть запис...',
    correctIn: 'Правильний час приходу',
    correctOut: 'Правильний час відходу',
    reason: 'Причина *',
    reasonPlaceholder: 'Опишіть, що потрібно виправити...',
    cancel: 'Скасувати',
    submit: 'Надіслати',
    sending: 'Надсилання...',
    empty: 'Немає запитів на виправлення',
    inLabel: 'Прихід',
    outLabel: 'Відхід',
  },
}

export default function CorrectionsPage() {
  const { profile } = useUser()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const statusLabel = statusLabelByLang[lang]

  const [corrections, setCorrections] = useState<CorrectionRequest[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState('')
  const [newClockIn, setNewClockIn] = useState('')
  const [newClockOut, setNewClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    const [{ data: corrData }, { data: entryData }] = await Promise.all([
      supabase
        .from('correction_requests')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', profile!.id)
        .gte('clock_in', startOfMonth(subMonths(new Date(), 1)).toISOString())
        .lte('clock_in', endOfMonth(new Date()).toISOString())
        .order('clock_in', { ascending: false }),
    ])
    setCorrections(corrData ?? [])
    setEntries(entryData ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)

    await supabase.from('correction_requests').insert({
      user_id: profile.id,
      entry_id: selectedEntry || null,
      requested_clock_in: newClockIn ? new Date(newClockIn).toISOString() : null,
      requested_clock_out: newClockOut ? new Date(newClockOut).toISOString() : null,
      reason,
    })

    setShowForm(false)
    setSelectedEntry('')
    setNewClockIn('')
    setNewClockOut('')
    setReason('')
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
          {l.request}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5 space-y-4">
          <h2 className="font-semibold text-gray-900">{l.formTitle}</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.selectEntry}</label>
            <select
              value={selectedEntry}
              onChange={e => setSelectedEntry(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">{l.choose}</option>
              {entries.map(e => (
                <option key={e.id} value={e.id}>
                  {format(new Date(e.clock_in), 'dd/MM HH:mm')}
                  {e.clock_out && ` – ${format(new Date(e.clock_out), 'HH:mm')}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.correctIn}</label>
            <input
              type="datetime-local"
              value={newClockIn}
              onChange={e => setNewClockIn(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.correctOut}</label>
            <input
              type="datetime-local"
              value={newClockOut}
              onChange={e => setNewClockOut(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.reason}</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
              placeholder={l.reasonPlaceholder}
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

      {corrections.length === 0 ? (
        <p className="text-center text-gray-500 py-8">{l.empty}</p>
      ) : (
        <div className="space-y-3">
          {corrections.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.reason}</p>
                  {c.requested_clock_in && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {l.inLabel}: {format(new Date(c.requested_clock_in), 'dd/MM HH:mm')}
                      {c.requested_clock_out && ` → ${l.outLabel}: ${format(new Date(c.requested_clock_out), 'HH:mm')}`}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(c.created_at), 'dd/MM/yyyy')}
                  </p>
                </div>
                <span className={`ml-3 shrink-0 text-xs px-2 py-1 rounded-full font-medium ${statusStyle[c.status]}`}>
                  {statusLabel[c.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
