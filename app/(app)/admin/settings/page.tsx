'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/UserProvider'
import { CompanySettings, Organization, OvertimeRule, Profile, VacationBalance, VacationRequest } from '@/lib/types'
import { calculateVacationSummary } from '@/lib/vacation'
import { useRouter } from 'next/navigation'

const labels = {
  sv: {
    title: 'Inställningar',
    tabCompany: 'Företag',
    tabOvertime: 'Övertid',
    tabEmployees: 'Anställda',
    companyInfo: 'Företagsuppgifter',
    companyName: 'Företagsnamn',
    orgNumber: 'Organisationsnummer',
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
    hourlyVacationNote: (pct: number) => `+ ${pct}% semesterersättning på timlönen (ingen dagräkning)`,
    reminderClockInPersonal: 'Påminnelse instämpling (valfritt)',
    reminderClockOutPersonal: 'Påminnelse utstämpling (valfritt)',
    reminderNote: 'Lämna tomt för att använda företagets standardtid.',
    breakModePersonal: 'Rasthantering (valfritt)',
    breakModeDefault: 'Företagets standard',
    breakModeNote: 'Lämna på "Företagets standard" om inget individuellt behövs.',
    autoBreakMinutesPersonal: 'Rastavdrag (minuter)',
    overtimeTitle: 'Övertidsregler',
    overtimeIntro: 'Definiera vilka tider/dagar som räknas som övertid.',
    addRule: '+ Lägg till regel',
    ruleLabel: 'Namn (t.ex. "Helg" eller "Midsommarafton")',
    ruleDay: 'Veckodag',
    ruleAllDays: 'Specifikt datum istället',
    ruleDate: 'Datum',
    ruleStart: 'Starttid',
    ruleEnd: 'Sluttid',
    rulePayMultiplier: 'Lönemultiplikator (t.ex. 2 = dubbel lön)',
    weekdays: ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'],
    noRules: 'Inga övertidsregler ännu',
    delete: 'Ta bort',
    obMode: 'OB-hantering',
    obModeManual: 'Manuell',
    obModeAutomatic: 'Automatisk',
    obModeManualNote: 'Du registrerar OB-timmar själv per anställd och tillfälle (rekommenderas om du beslutar OB från fall till fall).',
    obModeAutomaticNote: 'Systemet räknar automatiskt ut OB baserat på övertidsreglerna nedan, för alla stämplingar som överlappar dem.',
  },
  uk: {
    title: 'Налаштування',
    tabCompany: 'Компанія',
    tabOvertime: 'Понаднормові',
    tabEmployees: 'Співробітники',
    companyInfo: 'Дані компанії',
    companyName: 'Назва компанії',
    orgNumber: 'Реєстраційний номер',
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
    hourlyVacationNote: (pct: number) => `+ ${pct}% відпускних на погодинну ставку (без обліку днів)`,
    reminderClockInPersonal: 'Нагадування про прихід (необов\'язково)',
    reminderClockOutPersonal: 'Нагадування про відхід (необов\'язково)',
    reminderNote: 'Залиште порожнім, щоб використовувати стандартний час компанії.',
    breakModePersonal: 'Управління перервами (необов\'язково)',
    breakModeDefault: 'Стандарт компанії',
    breakModeNote: 'Залиште "Стандарт компанії", якщо немає індивідуальних потреб.',
    autoBreakMinutesPersonal: 'Вирахування перерви (хвилини)',
    overtimeTitle: 'Правила понаднормової роботи',
    overtimeIntro: 'Визначте, які часи/дні рахуються як понаднормові.',
    addRule: '+ Додати правило',
    ruleLabel: 'Назва (напр. "Вихідні" або "Святковий день")',
    ruleDay: 'День тижня',
    ruleAllDays: 'Конкретна дата замість цього',
    ruleDate: 'Дата',
    ruleStart: 'Час початку',
    ruleEnd: 'Час закінчення',
    rulePayMultiplier: 'Множник оплати (напр. 2 = подвійна оплата)',
    weekdays: ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'],
    noRules: 'Ще немає правил понаднормової роботи',
    delete: 'Видалити',
    obMode: 'Управління понаднормовими',
    obModeManual: 'Вручну',
    obModeAutomatic: 'Автоматично',
    obModeManualNote: 'Ви самостійно реєструєте понаднормові години для кожного співробітника окремо (рекомендовано, якщо рішення приймається індивідуально).',
    obModeAutomaticNote: 'Система автоматично розраховує понаднормові на основі правил нижче, для всіх записів, що перетинаються з ними.',
  },
}

export default function SettingsPage() {
  const { profile } = useUser()
  const router = useRouter()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'
  const l = labels[lang]

  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([])
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'company' | 'overtime' | 'employees'>('company')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'employee' | 'admin'>('employee')
  const [newEmploymentType, setNewEmploymentType] = useState<'hourly' | 'monthly'>('hourly')
  const [newRate, setNewRate] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newReminderIn, setNewReminderIn] = useState('')
  const [newReminderOut, setNewReminderOut] = useState('')
  const [newBreakMode, setNewBreakMode] = useState<'' | 'auto' | 'manual'>('')
  const [newAutoBreakMinutes, setNewAutoBreakMinutes] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [ruleLabel, setRuleLabel] = useState('')
  const [ruleUseDate, setRuleUseDate] = useState(false)
  const [ruleDay, setRuleDay] = useState('1')
  const [ruleDate, setRuleDate] = useState('')
  const [ruleStart, setRuleStart] = useState('')
  const [ruleEnd, setRuleEnd] = useState('')
  const [rulePayMultiplier, setRulePayMultiplier] = useState('2.00')

  const supabase = createClient()

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/')
    if (profile) load()
  }, [profile])

  async function load() {
    const currentYear = new Date().getFullYear()
    const [{ data: s }, { data: e }, { data: b }, { data: v }, { data: o }, { data: ot }] = await Promise.all([
      supabase.from('company_settings').select('*').single(),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('vacation_balances').select('*').eq('year', currentYear),
      supabase.from('vacation_requests').select('*').eq('status', 'approved'),
      supabase.from('organizations').select('*').single(),
      supabase.from('overtime_rules').select('*').order('created_at', { ascending: false }),
    ])
    setSettings(s)
    setEmployees(e ?? [])
    setBalances(b ?? [])
    setVacationRequests(v ?? [])
    setOrganization(o)
    setOvertimeRules(ot ?? [])
  }

  async function saveSettings() {
    if (!settings || !organization) return
    await Promise.all([
      supabase.from('company_settings').update({
        break_mode: settings.break_mode,
        auto_break_minutes: settings.auto_break_minutes,
        reminder_clock_in: settings.reminder_clock_in,
        reminder_clock_out: settings.reminder_clock_out,
        annual_vacation_days: settings.annual_vacation_days,
        vacation_pay_percent: settings.vacation_pay_percent,
        max_carryover_days: settings.max_carryover_days,
        overtime_mode: settings.overtime_mode,
      }).eq('id', settings.id),
      supabase.from('organizations').update({
        name: organization.name,
        org_number: organization.org_number,
      }).eq('id', organization.id),
    ])
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
        break_mode: newBreakMode || null,
        auto_break_minutes: newBreakMode === 'auto' && newAutoBreakMinutes ? Number(newAutoBreakMinutes) : null,
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
    setNewBreakMode('')
    setNewAutoBreakMinutes('')
    setAddLoading(false)
    await load()
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    await supabase.from('overtime_rules').insert({
      organization_id: profile.organization_id,
      label: ruleLabel || null,
      day_of_week: ruleUseDate ? null : Number(ruleDay),
      specific_date: ruleUseDate ? ruleDate : null,
      start_time: ruleStart,
      end_time: ruleEnd,
      pay_multiplier: Number(rulePayMultiplier) || 2,
    })

    setShowRuleForm(false)
    setRuleLabel('')
    setRuleUseDate(false)
    setRuleDay('1')
    setRuleDate('')
    setRuleStart('')
    setRuleEnd('')
    setRulePayMultiplier('2.00')
    await load()
  }

  async function deleteRule(id: number) {
    await supabase.from('overtime_rules').delete().eq('id', id)
    setOvertimeRules(prev => prev.filter(r => r.id !== id))
  }

  if (!profile || profile.role !== 'admin' || !settings || !organization) return null

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">{l.title}</h1>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['company', 'overtime', 'employees'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t ? 'bg-white shadow text-blue-700' : 'text-gray-600'
            }`}>
            {t === 'company' ? l.tabCompany : t === 'overtime' ? l.tabOvertime : l.tabEmployees}
          </button>
        ))}
      </div>

      {tab === 'company' ? (
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-900">{l.companyInfo}</h2>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.companyName}</label>
              <input type="text"
                value={organization.name}
                onChange={e => setOrganization(o => o ? { ...o, name: e.target.value } : o)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{l.orgNumber}</label>
              <input type="text" placeholder="XXXXXX-XXXX"
                value={organization.org_number ?? ''}
                onChange={e => setOrganization(o => o ? { ...o, org_number: e.target.value || null } : o)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

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
      ) : tab === 'overtime' ? (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h2 className="font-semibold text-gray-900">{l.obMode}</h2>
            <div className="flex gap-3">
              {(['manual', 'automatic'] as const).map(mode => (
                <button key={mode} type="button"
                  onClick={() => setSettings(s => s ? { ...s, overtime_mode: mode } : s)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    settings.overtime_mode === mode
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}>
                  {mode === 'manual' ? l.obModeManual : l.obModeAutomatic}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {settings.overtime_mode === 'manual' ? l.obModeManualNote : l.obModeAutomaticNote}
            </p>
            <button onClick={saveSettings}
              className="w-full bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm">
              {saved ? l.saved : l.save}
            </button>
          </div>

          <p className="text-sm text-gray-600">{l.overtimeIntro}</p>
          <button
            onClick={() => setShowRuleForm(v => !v)}
            className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl"
          >
            {l.addRule}
          </button>

          {showRuleForm && (
            <form onSubmit={handleAddRule} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.ruleLabel}</label>
                <input type="text" value={ruleLabel} onChange={e => setRuleLabel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={ruleUseDate} onChange={e => setRuleUseDate(e.target.checked)} />
                {l.ruleAllDays}
              </label>

              {ruleUseDate ? (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.ruleDate}</label>
                  <input type="date" required value={ruleDate} onChange={e => setRuleDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.ruleDay}</label>
                  <select value={ruleDay} onChange={e => setRuleDay(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    {l.weekdays.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.ruleStart}</label>
                  <input type="time" required value={ruleStart} onChange={e => setRuleStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.ruleEnd}</label>
                  <input type="time" required value={ruleEnd} onChange={e => setRuleEnd(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.rulePayMultiplier}</label>
                <input type="number" step="0.1" min={1} max={5} required value={rulePayMultiplier}
                  onChange={e => setRulePayMultiplier(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRuleForm(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600">
                  {l.cancel}
                </button>
                <button type="submit"
                  className="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">
                  {l.create}
                </button>
              </div>
            </form>
          )}

          {overtimeRules.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{l.noRules}</p>
          ) : (
            overtimeRules.map(rule => (
              <div key={rule.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{rule.label || '—'}</p>
                  <p className="text-sm text-gray-600">
                    {rule.specific_date ? rule.specific_date : l.weekdays[rule.day_of_week ?? 0]}
                    {' · '}{rule.start_time}–{rule.end_time}
                    {' · '}{rule.pay_multiplier}x
                  </p>
                </div>
                <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-600 font-medium">
                  {l.delete}
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
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

              <div>
                <label className="block text-sm text-gray-600 mb-1">{l.breakModePersonal}</label>
                <select value={newBreakMode} onChange={e => setNewBreakMode(e.target.value as '' | 'auto' | 'manual')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">{l.breakModeDefault}</option>
                  <option value="auto">{l.auto}</option>
                  <option value="manual">{l.manual}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{l.breakModeNote}</p>
              </div>
              {newBreakMode === 'auto' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{l.autoBreakMinutesPersonal}</label>
                  <input type="number" min={0} max={120} value={newAutoBreakMinutes}
                    onChange={e => setNewAutoBreakMinutes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              )}

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

          {employees.map(emp => {
            const balance = balances.find(b => b.user_id === emp.id) ?? null
            const requests = vacationRequests.filter(r => r.user_id === emp.id)
            const vacationSummary = calculateVacationSummary(emp, settings, balance, requests)

            return (
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

                {/* Vacation summary, merged in */}
                <div className="mt-2 bg-gray-50 rounded-lg p-2">
                  {emp.employment_type === 'hourly' ? (
                    <p className="text-xs text-gray-600">{l.hourlyVacationNote(settings.vacation_pay_percent)}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{vacationSummary.available}</p>
                        <p className="text-xs text-gray-500">{l.available}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{vacationSummary.earnedThisYear}</p>
                        <p className="text-xs text-gray-500">{l.earnedThisYear}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{vacationSummary.usedThisYear}</p>
                        <p className="text-xs text-gray-500">{l.used}</p>
                      </div>
                    </div>
                  )}
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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{l.breakModePersonal}</label>
                    <select
                      value={emp.break_mode ?? ''}
                      onChange={e => updateEmployee(emp.id, { break_mode: (e.target.value || null) as 'auto' | 'manual' | null })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">{l.breakModeDefault}</option>
                      <option value="auto">{l.auto}</option>
                      <option value="manual">{l.manual}</option>
                    </select>
                  </div>
                  {emp.break_mode === 'auto' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">{l.autoBreakMinutesPersonal}</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={emp.auto_break_minutes ?? ''}
                        onChange={e => updateEmployee(emp.id, { auto_break_minutes: e.target.value ? Number(e.target.value) : null })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
