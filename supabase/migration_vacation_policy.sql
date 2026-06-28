-- TimeSave: Configurable vacation policy per organization

-- 1. Vacation policy settings per organization
ALTER TABLE public.company_settings ADD COLUMN annual_vacation_days NUMERIC(5,2) NOT NULL DEFAULT 25;
ALTER TABLE public.company_settings ADD COLUMN vacation_pay_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00;
ALTER TABLE public.company_settings ADD COLUMN max_carryover_days NUMERIC(5,2) NOT NULL DEFAULT 5;

-- 2. Employment start date drives accrual calculations
ALTER TABLE public.profiles ADD COLUMN employment_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 3. Per-employee, per-year vacation balance (carryover + manual corrections)
CREATE TABLE public.vacation_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  year INTEGER NOT NULL,
  carried_over_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  manual_adjustment NUMERIC(5,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_org_vacation_balances BEFORE INSERT ON public.vacation_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

CREATE POLICY "users_own_balance" ON public.vacation_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_same_org_balances" ON public.vacation_balances FOR ALL USING (
  public.is_admin() AND organization_id = public.my_org()
);
