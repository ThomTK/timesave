import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const {
    email, password, full_name, role, employment_type, hourly_rate, monthly_salary,
    language, employment_start_date, reminder_clock_in, reminder_clock_out,
    break_mode, auto_break_minutes,
  } = await request.json()

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: role ?? 'employee', organization_id: profile.organization_id },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      employment_type: employment_type ?? 'hourly',
      hourly_rate: hourly_rate ?? null,
      monthly_salary: monthly_salary ?? null,
      language: language ?? 'sv',
      ...(employment_start_date ? { employment_start_date } : {}),
      reminder_clock_in: reminder_clock_in || null,
      reminder_clock_out: reminder_clock_out || null,
      break_mode: break_mode || null,
      auto_break_minutes: auto_break_minutes ?? null,
    })
    .eq('id', created.user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: created.user.id })
}
