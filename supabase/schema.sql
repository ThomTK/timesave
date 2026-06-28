-- TimeSave Database Schema

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  hourly_rate NUMERIC(10,2),
  monthly_salary NUMERIC(10,2),
  employment_type TEXT NOT NULL DEFAULT 'hourly' CHECK (employment_type IN ('hourly', 'monthly')),
  language TEXT NOT NULL DEFAULT 'sv' CHECK (language IN ('sv', 'uk')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company settings
CREATE TABLE public.company_settings (
  id SERIAL PRIMARY KEY,
  break_mode TEXT NOT NULL DEFAULT 'auto' CHECK (break_mode IN ('auto', 'manual')),
  auto_break_minutes INTEGER NOT NULL DEFAULT 30,
  reminder_clock_in TIME,
  reminder_clock_out TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.company_settings DEFAULT VALUES;

-- Overtime rules
CREATE TABLE public.overtime_rules (
  id SERIAL PRIMARY KEY,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- null = all days
  specific_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time entries
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  entry_type TEXT NOT NULL DEFAULT 'work' CHECK (entry_type IN ('work', 'sick', 'vacation', 'overtime')),
  note TEXT,
  approved BOOLEAN,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Correction requests
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requested_clock_in TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vacation requests
CREATE TABLE public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_rules ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "users_own_profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admins_all_profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Time entries: users see own, admins see all
CREATE POLICY "users_own_entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins_all_entries" ON public.time_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Correction requests
CREATE POLICY "users_own_corrections" ON public.correction_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_corrections" ON public.correction_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_all_corrections" ON public.correction_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Vacation requests
CREATE POLICY "users_own_vacations" ON public.vacation_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_vacations" ON public.vacation_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_all_vacations" ON public.vacation_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Company settings: all read, admins write
CREATE POLICY "all_read_settings" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "admins_write_settings" ON public.company_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Overtime rules: all read, admins write
CREATE POLICY "all_read_overtime" ON public.overtime_rules FOR SELECT USING (true);
CREATE POLICY "admins_write_overtime" ON public.overtime_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
