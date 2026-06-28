-- TimeSave: Multi-tenant migration
-- Adds organizations as first-class entities so the app can be sold to multiple companies.

-- 1. Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Create TK Fönster as organization #1 and backfill existing data
INSERT INTO public.organizations (name, slug)
VALUES ('TK Fönster AB', 'tk-fonster');

-- 3. Add organization_id to all tables that need tenant isolation
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.time_entries ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.correction_requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vacation_requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.company_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.overtime_rules ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 4. Backfill existing rows to TK Fönster
UPDATE public.profiles SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');
UPDATE public.time_entries SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');
UPDATE public.correction_requests SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');
UPDATE public.vacation_requests SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');
UPDATE public.company_settings SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');
UPDATE public.overtime_rules SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'tk-fonster');

-- 5. Make organization_id required going forward
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.time_entries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.correction_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.vacation_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.company_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.overtime_rules ALTER COLUMN organization_id SET NOT NULL;

-- 6. Helper functions (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.my_org()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. Auto-fill organization_id on insert based on the acting user's org
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (SELECT organization_id FROM public.profiles WHERE id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_org_time_entries BEFORE INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_org_corrections BEFORE INSERT ON public.correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_org_vacations BEFORE INSERT ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- 8. Drop old policies, replace with organization-scoped ones
DROP POLICY IF EXISTS "admins_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_all_entries" ON public.time_entries;
DROP POLICY IF EXISTS "admins_all_corrections" ON public.correction_requests;
DROP POLICY IF EXISTS "admins_all_vacations" ON public.vacation_requests;
DROP POLICY IF EXISTS "admins_write_settings" ON public.company_settings;
DROP POLICY IF EXISTS "admins_write_overtime" ON public.overtime_rules;
DROP POLICY IF EXISTS "all_read_settings" ON public.company_settings;
DROP POLICY IF EXISTS "all_read_overtime" ON public.overtime_rules;

CREATE POLICY "admins_same_org_profiles" ON public.profiles FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);

CREATE POLICY "admins_same_org_entries" ON public.time_entries FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);

CREATE POLICY "admins_same_org_corrections" ON public.correction_requests FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);

CREATE POLICY "admins_same_org_vacations" ON public.vacation_requests FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);

CREATE POLICY "read_own_org_settings" ON public.company_settings FOR SELECT USING (
  organization_id = public.my_org()
);
CREATE POLICY "admins_write_own_org_settings" ON public.company_settings FOR UPDATE USING (
  public.is_admin() AND organization_id = public.my_org()
);
CREATE POLICY "admins_insert_own_org_settings" ON public.company_settings FOR INSERT WITH CHECK (
  public.is_admin() AND organization_id = public.my_org()
);

CREATE POLICY "read_own_org_overtime" ON public.overtime_rules FOR SELECT USING (
  organization_id = public.my_org()
);
CREATE POLICY "admins_write_own_org_overtime" ON public.overtime_rules FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);

-- 9. Organizations table policies: members can read their own org, nobody can edit via client
CREATE POLICY "members_read_own_org" ON public.organizations FOR SELECT USING (
  id = public.my_org()
);

-- 10. Update handle_new_user to accept organization_id from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    (NEW.raw_user_meta_data->>'organization_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
