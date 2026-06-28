'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { CompanySettings, OvertimeRule, Profile, TimeEntry, EntryType } from '@/lib/types'
import { calculateEntryCost } from '@/lib/overtime'
import { format, differenceInMinutes, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { sv as dateSv, uk as dateUk } from 'date-fns/locale'

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}t ${m}m`
}

const labels = {
  sv: {
    back: '← Tillbaka',
    currentMonth: 'Denna månad',
    previous: 'Föregående',
    total: 'Totalt',
    addEntry: '+ Lägg till stämpling',
    editEntry: 'Redigera stämpling',
    newEntry: 'Ny stämpling',
    date: 'Datum',
    clockIn: 'Instämpling',
    clockOut: 'Utstämpling (valfritt)',
    breakMinutes: 'Rast (minuter)',
    type: 'Typ',
    types: { work: 'Arbete', sick: 'Sjuk', vacation: 'Semester', overtime: 'Övertid' },
    cancel: 'Avbryt',
    save: 'Spara',
    saving: 'Sparar...',
    delete: 'Ta bort',
    deleteConfirm: 'Ta bort denna stämpling?',
    edit: 'Redigera',
    ongoing: 'Pågående',
    empty: 'Inga stämplingar',
    loading: 'Laddar...',
    payMultiplier: 'Lönemultiplikator (t.ex. 2 = dubbel lön)',
    payMultiplierNote: 'Används för OB/övertid du registrerar manuellt.',
    cost: 'Kostnad',
    totalCost: 'Beräknad kostnad',
  },
  uk: {
    back: '← Назад',
    currentMonth: 'Цього місяця',
    previous: 'Попередній',
    total: 'Загалом',
    addEntry: '+ Додати запис',
    editEntry: 'Редагувати запис',
    newEntry: 'Новий запис',
    date: 'Дата',
    clockIn: 'Прихід',
    clockOut: 'Відхід (необов\'язково)',
    breakMinutes: 'Перерва (хвилини)',
    type: 'Тип',
    types: { work: 'Робота', sick: 'Хворий', vacation: 'Відпустка', overtime: 'Понаднормово' },
    cancel: 'Скасувати',
    save: 'Зберегти',
    saving: 'Збереження...',
    delete: 'Видалити',
    deleteConfirm: 'Видалити цей запис?',
    edit: 'Редагувати',
    ongoing: 'Триває',
    empty: 'Немає записів',
    loading: 'Завантаження...',
    payMultiplier: 'Множник оплати (напр. 2 = подвійна оплата)',
    payMultiplierNote: 'Використовується для понаднормових, які ви реєструєте вручну.',
    cost: 'Вартість',
    totalCost: 'Орієнтовна вартість',
  },
}

interface EntryForm {
  id?: string
  date: string
  clockInTime: string
  clockOutTime: string
  breakMinutes: string
  entryType: EntryType
  payMultiplier: string
}

function emptyForm(): EntryForm {
  return { date: format(new Date(), 'yyyy-MM-dd'), clockInTime: '', clockOutTime: '', breakMinutes: '0', entryType: 'work', payMultiplier: '1.00' }
}

export default function AdminEmployeeDetailPage() {
  const params = useParams()
  const employeeId = params.id as string
  const router = useRouter()
  const { profile } = useUser()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const dateLocale = lang === 'uk' ? dateUk : dateSv

  const [employee, setEmployee] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([])
  const [month, setMonth] = useState<'current' | 'previous'>('current')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EntryForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/')
    if (profile) load()
  }, [profile, month])

  async function load() {
    setLoading(true)
    const base = month === 'current' ? new Date() : subMonths(new Date(), 1)
    const start = startOfMonth(base).toISOString()
    const end = endOfMonth(base).toISOString()

    const [{ data: emp }, { data: e }, { data: s }, { data: ot }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', employeeId).single(),
      supabase.from('time_entries').select('*').eq('user_id', employeeId)
        .gte('clock_in', start).lte('clock_in', end).order('clock_in', { ascending: false }),
      supabase.from('company_settings').select('*').single(),
      supabase.from('overtime_rules').select('*'),
    ])

    setEmployee(emp)
    setEntries(e ?? [])
    setSettings(s)
    setOvertimeRules(ot ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(entry: TimeEntry) {
    setForm({
      id: entry.id,
      date: format(new Date(entry.clock_in), 'yyyy-MM-dd'),
      clockInTime: format(new Date(entry.clock_in), 'HH:mm'),
      clockOutTime: entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '',
      breakMinutes: String(entry.break_minutes),
      entryType: entry.entry_type,
      payMultiplier: String(entry.pay_multiplier ?? 1),
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const clockIn = new Date(`${form.date}T${form.clockInTime}`).toISOString()
    const clockOut = form.clockOutTime ? new Date(`${form.date}T${form.clockOutTime}`).toISOString() : null

    const payload = {
      user_id: employeeId,
      clock_in: clockIn,
      clock_out: clockOut,
      break_minutes: Number(form.breakMinutes) || 0,
      entry_type: form.entryType,
      pay_multiplier: Number(form.payMultiplier) || 1,
    }

    if (form.id) {
      await supabase.from('time_entries').update(payload).eq('id', form.id)
    } else {
      await supabase.from('time_entries').insert(payload)
    }

    setShowForm(false)
    setSaving(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm(l.deleteConfirm)) return
    await supabase.from('time_entries').delete().eq('id', id)
    await load()
  }

  const totalMinutes = entries
    .filter(e => e.clock_out)
    .reduce((sum, e) => {
      const mins = differenceInMinutes(new Date(e.clock_out!), new Date(e.clock_in)) - (e.break_minutes ?? 0)
      return sum + Math.max(0, mins)
    }, 0)

  const totalCost = settings && employee?.hourly_rate
    ? entries.reduce((sum, e) => sum + calculateEntryCost(e, employee.hourly_rate!, settings.overtime_mode, overtimeRules), 0)
    : null

  if (!profile || profile.role !== 'admin') return null

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <button onClick={() => router.push('/admin')} className="text-sm text-blue-700 mb-3">{l.back}</button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{employee?.full_name ?? '...'}</h1>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 mt-4">
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

      <div className="bg-blue-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-700">{l.total}</p>
        <p className="text-2xl font-bold text-blue-900">{formatDuration(totalMinutes)}</p>
        {totalCost !== null && (
          <p className="text-sm text-blue-700 mt-1">{l.totalCost}: {Math.round(totalCost).toLocaleString('sv-SE')} kr</p>
        )}
      </div>

      <button onClick={openAdd} className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl mb-4">
        {l.addEntry}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4 mb-4">
          <h2 className="font-semibold text-gray-900">{form.id ? l.editEntry : l.newEntry}</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{l.date}</label>
            <input type="date" required value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.clockIn}</label>
              <input type="time" required value={form.clockInTime}
                onChange={e => setForm(f => ({ ...f, clockInTime: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.clockOut}</label>
              <input type="time" value={form.clockOutTime}
                onChange={e => setForm(f => ({ ...f, clockOutTime: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.breakMinutes}</label>
              <input type="number" min={0} max={480} value={form.breakMinutes}
                onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.type}</label>
              <select value={form.entryType}
                onChange={e => setForm(f => ({ ...f, entryType: e.target.value as EntryType }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {Object.entries(l.types).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {(form.entryType === 'overtime' || settings?.overtime_mode === 'manual') && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.payMultiplier}</label>
              <input type="number" step="0.1" min={1} max={5} value={form.payMultiplier}
                onChange={e => setForm(f => ({ ...f, payMultiplier: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">{l.payMultiplierNote}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600">
              {l.cancel}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? l.saving : l.save}
            </button>
          </div>
        </form>
      )}

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
                      {entry.clock_out ? ` – ${format(new Date(entry.clock_out), 'HH:mm')}` : ` – ${l.ongoing}`}
                      {entry.break_minutes > 0 && ` (${entry.break_minutes}m)`}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-block mt-1">
                      {l.types[entry.entry_type]}
                    </span>
                  </div>
                  <div className="text-right">
                    {mins !== null && <p className="font-bold text-gray-800">{formatDuration(mins)}</p>}
                    {settings && employee?.hourly_rate && entry.clock_out && (
                      <p className="text-xs text-gray-500 mb-2">
                        {Math.round(calculateEntryCost(entry, employee.hourly_rate, settings.overtime_mode, overtimeRules)).toLocaleString('sv-SE')} kr
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(entry)} className="text-xs text-blue-700 font-medium">{l.edit}</button>
                      <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-600 font-medium">{l.delete}</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
