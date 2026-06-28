'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { Profile, TimeEntry, CorrectionRequest, VacationRequest, SickLeaveReport } from '@/lib/types'
import { format, differenceInMinutes, startOfMonth, endOfMonth } from 'date-fns'
import { sv as dateSv, uk as dateUk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}t ${m}m`
}

interface EmployeeSummary {
  profile: Profile
  totalMinutes: number
  activeEntry: TimeEntry | null
}

const statusLabelByLang = {
  sv: { pending: 'Väntar', approved: 'Godkänd', rejected: 'Nekad' },
  uk: { pending: 'Очікує', approved: 'Схвалено', rejected: 'Відхилено' },
}

const labels = {
  sv: {
    title: 'Admin',
    exportFortnox: 'Exportera till Fortnox',
    exportFailed: 'Export misslyckades',
    exportWarning: 'Obs: dessa anställda saknar personnummer/Fortnox-ID och exkluderades:',
    overview: 'Översikt',
    corrections: 'Rättelser',
    vacations: 'Semester',
    sick: 'Sjuk',
    loading: 'Laddar...',
    clockedSince: 'Instämplad sedan',
    earned: 'intjänat',
    noPendingCorrections: 'Inga väntande rättelser',
    newIn: 'Ny in',
    out: 'Ut',
    approve: 'Godkänn',
    reject: 'Neka',
    noPendingVacations: 'Inga väntande semesteransökningar',
    noSickLeave: 'Inga sjukanmälningar',
    ongoing: 'Pågående',
    clockedInNow: 'Instämplade nu',
    nobodyClockedIn: 'Ingen är instämplad just nu',
    totalThisMonth: 'Totalt denna månad',
    totalHours: 'timmar',
    totalCost: 'beräknad kostnad (timanställda)',
    allEmployees: 'Alla anställda',
    exportExcel: 'Excel',
    exportPdf: 'PDF',
    reportTitle: 'Månadsrapport',
    colName: 'Namn',
    colHours: 'Timmar',
    colCost: 'Kostnad (kr)',
  },
  uk: {
    title: 'Адмін',
    exportFortnox: 'Експорт у Fortnox',
    exportFailed: 'Помилка експорту',
    exportWarning: 'Увага: ці співробітники не мають особистого номера/Fortnox-ID і були виключені:',
    overview: 'Огляд',
    corrections: 'Виправлення',
    vacations: 'Відпустка',
    sick: 'Лікарняний',
    loading: 'Завантаження...',
    clockedSince: 'На роботі з',
    earned: 'нараховано',
    noPendingCorrections: 'Немає запитів на виправлення',
    newIn: 'Новий прихід',
    out: 'Відхід',
    approve: 'Схвалити',
    reject: 'Відхилити',
    noPendingVacations: 'Немає заявок на відпустку',
    noSickLeave: 'Немає повідомлень про лікарняний',
    ongoing: 'Триває',
    clockedInNow: 'На роботі зараз',
    nobodyClockedIn: 'Зараз ніхто не на роботі',
    totalThisMonth: 'Всього цього місяця',
    totalHours: 'годин',
    totalCost: 'орієнтовна вартість (погодинні)',
    allEmployees: 'Всі співробітники',
    exportExcel: 'Excel',
    exportPdf: 'PDF',
    reportTitle: 'Місячний звіт',
    colName: 'Ім\'я',
    colHours: 'Години',
    colCost: 'Вартість (кр)',
  },
}

export default function AdminPage() {
  const { profile } = useUser()
  const router = useRouter()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]
  const statusLabel = statusLabelByLang[lang]
  const dateLocale = lang === 'uk' ? dateUk : dateSv

  const [summaries, setSummaries] = useState<EmployeeSummary[]>([])
  const [pendingCorrections, setPendingCorrections] = useState<CorrectionRequest[]>([])
  const [pendingVacations, setPendingVacations] = useState<VacationRequest[]>([])
  const [recentSickLeave, setRecentSickLeave] = useState<SickLeaveReport[]>([])
  const [tab, setTab] = useState<'overview' | 'corrections' | 'vacations' | 'sick'>('overview')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/')
    if (profile) load()
  }, [profile])

  async function load() {
    setLoading(true)
    const start = startOfMonth(new Date()).toISOString()
    const end = endOfMonth(new Date()).toISOString()

    const [{ data: profiles }, { data: entries }, { data: corrections }, { data: vacations }, { data: sickLeave }] = await Promise.all([
      supabase.from('profiles').select('*').eq('active', true).order('full_name'),
      supabase.from('time_entries').select('*').gte('clock_in', start).lte('clock_in', end),
      supabase.from('correction_requests').select('*, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('vacation_requests').select('*, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('sick_leave_reports').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(20),
    ])

    const sums: EmployeeSummary[] = (profiles ?? []).map(p => {
      const userEntries = (entries ?? []).filter(e => e.user_id === p.id)
      const totalMinutes = userEntries
        .filter(e => e.clock_out)
        .reduce((sum, e) => {
          const mins = differenceInMinutes(new Date(e.clock_out!), new Date(e.clock_in)) - (e.break_minutes ?? 0)
          return sum + Math.max(0, mins)
        }, 0)
      const activeEntry = userEntries.find(e => !e.clock_out) ?? null
      return { profile: p, totalMinutes, activeEntry }
    })

    setSummaries(sums)
    setPendingCorrections((corrections as CorrectionRequest[]) ?? [])
    setPendingVacations((vacations as VacationRequest[]) ?? [])
    setRecentSickLeave((sickLeave as SickLeaveReport[]) ?? [])
    setLoading(false)
  }

  async function reviewCorrection(id: string, status: 'approved' | 'rejected') {
    await supabase.from('correction_requests')
      .update({ status, reviewed_by: profile!.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    if (status === 'approved') {
      const req = pendingCorrections.find(c => c.id === id)
      if (req?.entry_id && (req.requested_clock_in || req.requested_clock_out)) {
        const update: Record<string, string | null> = {}
        if (req.requested_clock_in) update.clock_in = req.requested_clock_in
        if (req.requested_clock_out) update.clock_out = req.requested_clock_out
        await supabase.from('time_entries').update(update).eq('id', req.entry_id)
      }
    }

    await load()
  }

  async function reviewVacation(id: string, status: 'approved' | 'rejected') {
    await supabase.from('vacation_requests')
      .update({ status, reviewed_by: profile!.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    await load()
  }

  async function exportPaxml() {
    const now = new Date()
    const res = await fetch(`/api/export/paxml?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)

    if (!res.ok) {
      alert(l.exportFailed)
      return
    }

    const warnings = decodeURIComponent(res.headers.get('X-Warnings') ?? '')
    if (warnings) {
      alert(`${l.exportWarning}\n${warnings}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesave-loneunderlag-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  function buildReportRows() {
    return summaries.map(({ profile: p, totalMinutes }) => ({
      [l.colName]: p.full_name,
      [l.colHours]: (totalMinutes / 60).toFixed(2),
      [l.colCost]: p.employment_type === 'hourly' && p.hourly_rate
        ? Math.round((totalMinutes / 60) * p.hourly_rate)
        : '',
    }))
  }

  function exportExcel() {
    const now = new Date()
    const ws = XLSX.utils.json_to_sheet(buildReportRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, l.reportTitle)
    XLSX.writeFile(wb, `timesave-rapport-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`)
  }

  function exportPdf() {
    const now = new Date()
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`${l.reportTitle} — ${format(now, 'MMMM yyyy', { locale: dateLocale })}`, 14, 18)
    doc.setFontSize(11)

    let y = 30
    doc.text(l.colName, 14, y)
    doc.text(l.colHours, 110, y)
    doc.text(l.colCost, 150, y)
    y += 6
    doc.line(14, y - 4, 196, y - 4)

    for (const { profile: p, totalMinutes } of summaries) {
      const cost = p.employment_type === 'hourly' && p.hourly_rate
        ? Math.round((totalMinutes / 60) * p.hourly_rate)
        : null
      doc.text(p.full_name, 14, y)
      doc.text((totalMinutes / 60).toFixed(2), 110, y)
      if (cost !== null) doc.text(String(cost), 150, y)
      y += 7
    }

    doc.line(14, y, 196, y)
    y += 8
    doc.setFontSize(12)
    doc.text(`${l.totalThisMonth}: ${(totalMinutesAll / 60).toFixed(2)} ${l.totalHours}`, 14, y)

    doc.save(`timesave-rapport-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`)
  }

  if (!profile || profile.role !== 'admin') return null

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: dateLocale })
  const activeNow = summaries.filter(s => s.activeEntry)
  const totalMinutesAll = summaries.reduce((sum, s) => sum + s.totalMinutes, 0)
  const totalCost = summaries.reduce((sum, s) => {
    if (s.profile.employment_type === 'hourly' && s.profile.hourly_rate) {
      return sum + (s.totalMinutes / 60) * s.profile.hourly_rate
    }
    return sum
  }, 0)

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">{l.title}</h1>
        <div className="flex gap-1.5">
          <button onClick={exportExcel} className="text-xs bg-green-700 text-white px-2.5 py-1.5 rounded-lg font-medium">
            {l.exportExcel}
          </button>
          <button onClick={exportPdf} className="text-xs bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-medium">
            {l.exportPdf}
          </button>
          <button onClick={exportPaxml} className="text-xs bg-gray-900 text-white px-2.5 py-1.5 rounded-lg font-medium">
            {l.exportFortnox}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-5 capitalize">{currentMonth}</p>

      {/* Pending badges */}
      {(pendingCorrections.length > 0 || pendingVacations.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex gap-4">
          {pendingCorrections.length > 0 && (
            <button onClick={() => setTab('corrections')} className="text-sm text-amber-800">
              ✏️ {pendingCorrections.length} {l.corrections.toLowerCase()}
            </button>
          )}
          {pendingVacations.length > 0 && (
            <button onClick={() => setTab('vacations')} className="text-sm text-amber-800">
              🌴 {pendingVacations.length} {l.vacations.toLowerCase()}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {(['overview', 'corrections', 'vacations', 'sick'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap px-2 ${
              tab === t ? 'bg-white shadow text-blue-700' : 'text-gray-600'
            }`}>
            {t === 'overview' ? l.overview : t === 'corrections' ? `${l.corrections}${pendingCorrections.length > 0 ? ` (${pendingCorrections.length})` : ''}` : t === 'vacations' ? `${l.vacations}${pendingVacations.length > 0 ? ` (${pendingVacations.length})` : ''}` : l.sick}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">{l.loading}</p>
      ) : tab === 'overview' ? (
        <div className="space-y-5">
          {/* Currently clocked in */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{l.clockedInNow}</h2>
            {activeNow.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-xl p-4">{l.nobodyClockedIn}</p>
            ) : (
              <div className="space-y-2">
                {activeNow.map(({ profile: p, activeEntry }) => (
                  <div key={p.id} className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{p.full_name}</p>
                      <p className="text-xs text-green-700">
                        {l.clockedSince} {format(new Date(activeEntry!.clock_in), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly total */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-700 mb-1">{l.totalThisMonth}</p>
            <p className="text-2xl font-bold text-blue-900">{formatDuration(totalMinutesAll)} <span className="text-sm font-normal">{l.totalHours}</span></p>
            {totalCost > 0 && (
              <p className="text-xs text-blue-700 mt-1">
                ≈ {Math.round(totalCost).toLocaleString('sv-SE')} kr — {l.totalCost}
              </p>
            )}
          </div>

          {/* Per-employee list */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{l.allEmployees}</h2>
            <div className="space-y-2">
              {summaries.map(({ profile: p, totalMinutes, activeEntry }) => {
                const salary = p.employment_type === 'hourly' && p.hourly_rate
                  ? ((totalMinutes / 60) * p.hourly_rate).toFixed(0)
                  : null

                return (
                  <div key={p.id} className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 ${activeEntry ? 'border-l-4 border-green-400' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{p.full_name}</p>
                        <p className="text-sm text-gray-600">{formatDuration(totalMinutes)}</p>
                        {activeEntry && (
                          <p className="text-xs text-green-600 font-medium">
                            {l.clockedSince} {format(new Date(activeEntry.clock_in), 'HH:mm')}
                          </p>
                        )}
                      </div>
                      {salary && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-800">{Number(salary).toLocaleString('sv-SE')} kr</p>
                          <p className="text-xs text-gray-500">{l.earned}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : tab === 'corrections' ? (
        <div className="space-y-3">
          {pendingCorrections.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{l.noPendingCorrections}</p>
          ) : pendingCorrections.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="font-medium text-gray-900">{(c.profiles as Profile)?.full_name}</p>
              <p className="text-sm text-gray-600 mt-1">{c.reason}</p>
              {c.requested_clock_in && (
                <p className="text-xs text-gray-600 mt-1">
                  {l.newIn}: {format(new Date(c.requested_clock_in), 'dd/MM HH:mm')}
                  {c.requested_clock_out && ` → ${l.out}: ${format(new Date(c.requested_clock_out), 'HH:mm')}`}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => reviewCorrection(c.id, 'approved')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {l.approve}
                </button>
                <button
                  onClick={() => reviewCorrection(c.id, 'rejected')}
                  className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg text-sm font-medium"
                >
                  {l.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'vacations' ? (
        <div className="space-y-3">
          {pendingVacations.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{l.noPendingVacations}</p>
          ) : pendingVacations.map(v => (
            <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="font-medium text-gray-900">{(v.profiles as Profile)?.full_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {format(new Date(v.start_date), 'dd/MM/yyyy')} – {format(new Date(v.end_date), 'dd/MM/yyyy')}
              </p>
              {v.note && <p className="text-xs text-gray-600 mt-0.5">{v.note}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => reviewVacation(v.id, 'approved')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {l.approve}
                </button>
                <button
                  onClick={() => reviewVacation(v.id, 'rejected')}
                  className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg text-sm font-medium"
                >
                  {l.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {recentSickLeave.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{l.noSickLeave}</p>
          ) : recentSickLeave.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="font-medium text-gray-900">{(s.profiles as Profile)?.full_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {format(new Date(s.start_date), 'dd/MM/yyyy')}
                {s.end_date ? ` – ${format(new Date(s.end_date), 'dd/MM/yyyy')}` : ` – ${l.ongoing}`}
              </p>
              {s.note && <p className="text-xs text-gray-600 mt-0.5">{s.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
