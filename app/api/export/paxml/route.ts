import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', adminProfile.organization_id)
    .single()

  const [{ data: vacations }, { data: sickLeave }] = await Promise.all([
    supabase
      .from('vacation_requests')
      .select('*, profiles(full_name, personnummer, fortnox_employee_number)')
      .eq('status', 'approved')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart),
    supabase
      .from('sick_leave_reports')
      .select('*, profiles(full_name, personnummer, fortnox_employee_number)')
      .lte('start_date', monthEnd)
      .or(`end_date.gte.${monthStart},end_date.is.null`),
  ])

  const warnings: string[] = []
  const transactions: string[] = []

  function addTransaction(tidkod: string, startDate: string, endDate: string, profile: {
    full_name: string
    personnummer: string | null
    fortnox_employee_number: string | null
  } | null) {
    if (!profile) return
    if (!profile.personnummer || !profile.fortnox_employee_number) {
      if (!warnings.includes(profile.full_name)) warnings.push(profile.full_name)
      return
    }
    transactions.push(
      `    <tidtrans anstid="${escapeXml(profile.fortnox_employee_number)}" persnr="${escapeXml(profile.personnummer)}">\n` +
      `      <tidkod>${tidkod}</tidkod>\n` +
      `      <datumfrom>${startDate}</datumfrom>\n` +
      `      <datumtom>${endDate}</datumtom>\n` +
      `    </tidtrans>`
    )
  }

  for (const v of vacations ?? []) {
    addTransaction('SEM', v.start_date, v.end_date, v.profiles as { full_name: string; personnummer: string | null; fortnox_employee_number: string | null } | null)
  }

  for (const s of sickLeave ?? []) {
    addTransaction('SJK', s.start_date, s.end_date ?? s.start_date, s.profiles as { full_name: string; personnummer: string | null; fortnox_employee_number: string | null } | null)
  }

  const exportDate = new Date().toISOString().slice(0, 19)

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<paxml>\n` +
    `  <header version="2.0" datum="${exportDate}" foretagnamn="${escapeXml(org?.name ?? '')}"` +
    `${org?.org_number ? ` foretagorgnr="${escapeXml(org.org_number)}"` : ''} programnamn="TimeSave"/>\n` +
    `  <tidtransaktioner>\n` +
    transactions.join('\n') +
    `\n  </tidtransaktioner>\n` +
    `</paxml>\n`

  const filename = `timesave-loneunderlag-${year}-${String(month).padStart(2, '0')}.xml`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Warnings': encodeURIComponent(warnings.join(', ')),
    },
  })
}
