-- TimeSave: Sick leave reporting + payroll export fields

-- 1. Fortnox payroll export fields per employee
ALTER TABLE public.profiles ADD COLUMN personnummer TEXT;
ALTER TABLE public.profiles ADD COLUMN fortnox_employee_number TEXT;

-- 2. Sick leave requests (mirrors vacation_requests, separate table for clarity)
CREATE TABLE public.sick_leave_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sick_leave_reports ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_sick_leave BEFORE INSERT ON public.sick_leave_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE POLICY "users_own_sick_leave" ON public.sick_leave_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_sick_leave" ON public.sick_leave_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_same_org_sick_leave" ON public.sick_leave_reports FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);
