import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: NextRequest) {
  const { companyName, fullName, email, password } = await request.json()

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const baseSlug = slugify(companyName) || 'foretag'
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: companyName, slug })
    .select()
    .single()

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 400 })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin', organization_id: org.id },
  })

  if (createError) {
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const { error: settingsError } = await admin
    .from('company_settings')
    .insert({ organization_id: org.id })

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: created.user.id, organizationId: org.id })
}
