'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { CompanySettings, Profile, VacationBalance, VacationRequest } from '@/lib/types'
import { calculateVacationSummary } from '@/lib/vacation'
import { useRouter } from 'next/navigation'

const labels = {
  sv: {
    title: 'Inställningar',
    tabCompany: 'Företag',
    tabEmployees: 'Anställda',
    tabVacation: 'Semester',
    breakHandling: 'Rasthantering',
    auto: 'Automatiskt',
    manual: 'Manuell',
    autoBreakMinutes: 'Automatiskt rastavdrag (minuter)',
    reminders: 'Påminnelser',
    reminderClockIn: 'Påminnelse instämpling',
    reminderClockOut: 'Påminnelse utstämpling',
    vacationPolicy: 'Semesterpolicy',
    daysPerYear: 'Semesterdagar per år (heltid)',
    daysPerYearNote: (n: string) => `Ger ${n} dagar/månad i intjäning. Svensk standard är 25 dagar/år.`,
    vacationPayPercent: 'Semesterersättning timanställda (%)',
    vacationPayNote: 'Läggs på timlönen för timanställda. Svensk standard är 12%.',
    maxCarryover: 'Max sparade dagar till nästa år',
    save: 'Spara inställningar',
    saved: '✓ Sparad',
    addEmployee: '+ Lägg till anställd',
    newEmployee: 'Ny anställd',
    name: 'Namn',
    email: 'E-post',
    tempPassword: 'Tillfälligt lösenord',
    role: 'Roll',
    roleEmployee: 'Anställd',
    roleAdmin: 'Admin',
    employmentType: 'Anställningstyp',
    hourly: 'Timanst.',
    monthly: 'Månadsans.',
    hourlyRate: 'Timlön (kr)',
    monthlySalary: 'Månadslön (kr)',
    employmentDate: 'Anställningsdatum',
    cancel: 'Avbryt',
    create: 'Skapa konto',
    creating: 'Skapar...',
    genericError: 'Något gick fel',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    personnummer: 'Personnummer',
    fortnoxId: 'Fortnox anst.-nr',
    available: 'Tillgängliga',
    earnedThisYear: 'Intjänade i år',
    used: 'Använda',
    hourlyVacationNote: (pct: number) => `Får ${pct}% semesterersättning utbetald löpande på timlönen — ingen dagräkning.`,
    reminderClockInPersonal: 'Påminnelse instämpling (valfritt)',
    reminderClockOutPersonal: 'Påminnelse utstämpling (valfritt)',
    reminderNote: 'Lämna tomt för att använda företagets standardtid.',
  },
  uk: {
    title: 'Налаштування',
    tabCompany: 'Компанія',
    tabEmployees: 'Співробітники',
    tabVacation: 'Відпустка',
    breakHandling: 'Управління перервами',
    auto: 'Автоматично',
    manual: 'Вручну',
    autoBreakMinutes: 'Автоматичне вирахування перерви (хвилини)',
    reminders: 'Нагадування',
    reminderClockIn: 'Нагадування про прихід',
    reminderClockOut: 'Нагадування про відхід',
    vacationPolicy: 'Політика відпусток',
    daysPerYear: 'Днів відпустки на рік (повна ставка)',
    daysPerYearNote: (n: string) => `Дає ${n} днів/місяць накопичення. Шведський стандарт — 25 днів/рік.`,
    vacationPayPercent: 'Відпускні для погодинних (%)',
    vacationPayNote: 'Додається до погодинної ставки. Шведський стандарт — 12%.',
    maxCarryover: 'Максимум перенесених днів на наступний рік',
    save: 'Зберегти налаштування',
    saved: '✓ Збережено',
    addEmployee: '+ Додати співробітника',
    newEmployee: 'Новий співробітник',
    name: 'Ім\'я',
    email: 'Електронна пошта',
    tempPassword: 'Тимчасовий пароль',
    role: 'Роль',
    roleEmployee: 'Співробітник',
    roleAdmin: 'Адмін',
    employmentType: 'Тип зайнятості',
    hourly: 'Погодинно',
    monthly: 'Місячна',
    hourlyRate: 'Погодинна ставка (кр)',
    monthlySalary: 'Місячна зарплата (кр)',
    employmentDate: 'Дата прийняття на роботу',
    cancel: 'Скасувати',
    create: 'Створити акаунт',
    creating: 'Створення...',
    genericError: 'Щось пішло не так',
    active: 'Активний',
    inactive: 'Неактивний',
    personnummer: 'Особистий номер',
    fortnoxId: 'Номер співробітника Fortnox',
    available: 'Доступно',
    earnedThisYear: 'Накопичено цього року',
    used: 'Використано',
    hourlyVacationNote: (pct: number) => `Отримує ${pct}% відпускних, що нараховуються на погодинну ставку — облік днів не потрібен.`,
    reminderClockInPersonal: 'Нагадування про прихід (необов\'язково)',
    reminderClockOutPersonal: 'Нагадування про відхід (необов\'язково)',
    reminderNote: 'Залиште порожнім, щоб використовувати стандартний час компанії.',
  },
}

export default function SettingsPage() {
  const { profile } = useUser()
  const router = useRouter()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]

  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [employees, setEmployees] = useState<Profile[]>([])
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([])
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'company' | 'employees' | 'vacation'>('company')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'employee' | 'admin'>('employee')
  const [newEmploymentType, setNewEmploymentType] = useState<'hourly' | 'monthly'>('hourly')
  const [newRate, setNewRate] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newReminderIn, setNewReminderIn] = useState('')
  const [newReminderOut, setNewReminderOut] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/')
    if (profile) load()
  }, [profile])

  async function load() {
    const currentYear = new Date().getFullYear()
    const [{ data: s }, { data: e }, { data: b }, { data: v }] = await Promise.all([
      supabase.from('company_settings').select('*').single(),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('vacation_balances').select('*').eq('year', currentYear),
      supabase.from('vacation_requests').select('*').eq('status', 'approved'),
    ])
    setSettings(s)
    setEmployees(e ?? [])
    setBalances(b ?? [])
    setVacationRequests(v ?? [])
  }

  async function saveSettings() {
    if (!settings) return
    await supabase.from('company_settings').update({
      break_mode: settings.break_mode,
      auto_break_minutes: settings.auto_break_minutes,
      reminder_clock_in: settings.reminder_clock_in,
      reminder_clock_out: settings.reminder_clock_out,
      annual_vacation_days: settings.annual_vacation_days,
      vacation_pay_percent: settings.vacation_pay_percent,
      max_carryover_days: settings.max_carryover_days,
    }).eq('id', settings.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function updateEmployee(id: string, updates: Partial<Profile>) {
    await supabase.from('profiles').update(updates).eq('id', id)
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
        employment_type: newEmploymentType,
        hourly_rate: newEmploymentType === 'hourly' ? Number(newRate) || null : null,
        monthly_salary: newEmploymentType === 'monthly' ? Number(newRate) || null : null,
        employment_start_date: newStartDate || undefined,
        reminder_clock_in: newReminderIn || null,
        reminder_clock_out: newReminderOut || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setAddError(data.error ?? l.genericError)
      setAddLoading(false)
      return
    }

    setShowAddForm(false)
    setNewEmail('')
    setNewPassword('')
    setNewName('')
    setNewRole('employee')
    setNewEmploymentType('hourly')
    setNewRate('')
    setNewStartDate('')
    setNewReminderIn('')
    setNewReminderOut('')
    setAddLoading(false)
    await load()
  }

  if (!profile || profile.role !== 'admin' || !settings) return null

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">{l.title}</h1>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['company', 'employees', 'vacation'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t ? 'bg-white shadow text-blue-700' : 'text-gray-600'
            }`}>
            {t === 'company' ? l.tabCompany : t === 'employees' ? l.tabEmployees : l.tabVacation}
          </button>
        ))}
      </div>

      {tab === 'company' ? (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-900">{l.breakHandling}</h2>
            <div className="flex gap-3">
              {(['auto', 'manual'] as const).map(mode => (
                <button key={mode}
                  onClick={() => setSettings(s => s ? { ...s, break_mode: mode } : s)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    settings.break_mode === mode
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}>
                  {mode === 'auto' ? l.auto : l.manual}
                </button>
              ))}
            </div>
            {settings.break_mode === 'auto' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.autoBreakMinutes}</label>
                <input type="number" min={0} max={120}
                  value={settings.auto_break_minutes}
                  onChange={e => setSettings(s => s ? { ...s, auto_break_minutes: Number(e.target.value) } : s)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-900">{l.reminders}</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.reminderClockIn}</label>
              <input type="time"
                value={settings.reminder_clock_in ?? ''}
                onChange={e => setSettings(s => s ? { ...s, reminder_clock_in: e.target.value || null } : s)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.reminderClockOut}</label>
              <input type="time"
                value={settings.reminder_clock_out ?? ''}
                onChange={e => setSettings(s => s ? { ...s, reminder_clock_out: e.target.value || null } : s)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-900">{l.vacationPolicy}</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.daysPerYear}</label>
              <input type="number" step="0.01" min={0} max={50}
                value={settings.annual_vacation_days}
                onChange={e => setSettings(s => s ? { ...s, annual_vacation_days: Number(e.target.value) } : s)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {l.daysPerYearNote((settings.annual_vacation_days / 12).toFixed(2))}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.vacationPayPercent}</label>
              <input type="number" step="0.01" min={0} max={100}
                value={settings.vacation_pay_percent}
                onChange={e => setSettings(s => s ? { ...s, vacation_pay_percent: Number(e.target.value) } : s)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">{l.vacationPayNote}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.maxCarryover}</label>
              <input type="number" step="0.01" min={0} max={50}
                value={settings.max_carryover_days}
                onChange={e => setSettings(s => s ? { ...s, max_carryover_days: Number(e.target.value) } : s)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <button onClick={saveSettings}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors hover:bg-blue-800">
            {saved ? l.saved : l.save}
          </button>
        </div>
      ) : tab === 'employees' ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl"
          >
            {l.addEmployee}
          </button>

          {showAddForm && (
            <form onSubmit={handleAddEmployee} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-semibold text-gray-900">{l.newEmployee}</h2>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.name}</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.email}</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.tempPassword}</label>
                <input type="text" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.role}</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'employee' | 'admin')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="employee">{l.roleEmployee}</option>
                  <option value="admin">{l.roleAdmin}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.employmentType}</label>
                  <select value={newEmploymentType} onChange={e => setNewEmploymentType(e.target.value as 'hourly' | 'monthly')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="hourly">{l.hourly}</option>
                    <option value="monthly">{l.monthly}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {newEmploymentType === 'hourly' ? l.hourlyRate : l.monthlySalary}
                  </label>
                  <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.employmentDate}</label>
                <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.reminderClockInPersonal}</label>
                  <input type="time" value={newReminderIn} onChange={e => setNewReminderIn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.reminderClockOutPersonal}</label>
                  <input type="time" value={newReminderOut} onChange={e => setNewReminderOut(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              <p className="text-xs text-gray-500">{l.reminderNote}</p>

              {addError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600">
                  {l.cancel}
                </button>
                <button type="submit" disabled={addLoading}
                  className="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {addLoading ? l.creating : l.create}
                </button>
              </div>
            </form>
          )}

          {employees.map(emp => (
            <div key={emp.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{emp.full_name}</p>
                  <p className="text-xs text-gray-600">{emp.email}</p>
                </div>
                <button
                  onClick={() => updateEmployee(emp.id, { active: !emp.active })}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {emp.active ? l.active : l.inactive}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{l.employmentType}</label>
                  <select
                    value={emp.employment_type}
                    onChange={e => updateEmployee(emp.id, { employment_type: e.target.value as 'hourly' | 'monthly' })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="hourly">{l.hourly}</option>
                    <option value="monthly">{l.monthly}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {emp.employment_type === 'hourly' ? l.hourlyRate : l.monthlySalary}
                  </label>
                  <input
                    type="number"
                    value={emp.employment_type === 'hourly' ? (emp.hourly_rate ?? '') : (emp.monthly_salary ?? '')}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : null
                      updateEmployee(emp.id, emp.employment_type === 'hourly'
                        ? { hourly_rate: val }
                        : { monthly_salary: val })
                    }}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{l.personnummer}</label>
                  <input
                    type="text"
                    placeholder="ÅÅÅÅMMDD-XXXX"
                    value={emp.personnummer ?? ''}
                    onChange={e => updateEmployee(emp.id, { personnummer: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{l.fortnoxId}</label>
                  <input
                    type="text"
                    value={emp.fortnox_employee_number ?? ''}
                    onChange={e => updateEmployee(emp.id, { fortnox_employee_number: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{l.reminderClockInPersonal}</label>
                  <input
                    type="time"
                    value={emp.reminder_clock_in ?? ''}
                    onChange={e => updateEmployee(emp.id, { reminder_clock_in: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{l.reminderClockOutPersonal}</label>
                  <input
                    type="time"
                    value={emp.reminder_clock_out ?? ''}
                    onChange={e => updateEmployee(emp.id, { reminder_clock_out: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map(emp => {
            const balance = balances.find(b => b.user_id === emp.id) ?? null
            const requests = vacationRequests.filter(r => r.user_id === emp.id)
            const summary = calculateVacationSummary(emp, settings, balance, requests)

            return (
              <div key={emp.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-900">{emp.full_name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {emp.employment_type === 'hourly' ? l.hourly : l.monthly}
                  </span>
                </div>
                {emp.employment_type === 'hourly' ? (
                  <p className="text-sm text-gray-600">
                    {l.hourlyVacationNote(settings.vacation_pay_percent)}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{summary.available}</p>
                      <p className="text-xs text-gray-500">{l.available}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{summary.earnedThisYear}</p>
                      <p className="text-xs text-gray-500">{l.earnedThisYear}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{summary.usedThisYear}</p>
                      <p className="text-xs text-gray-500">{l.used}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
