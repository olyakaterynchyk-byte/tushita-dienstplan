-- ============================================================
-- Tushita Dienstplan — Supabase Schema
-- ============================================================



-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  firstname TEXT NOT NULL DEFAULT '',
  lastname TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  area TEXT NOT NULL DEFAULT 'service' CHECK (area IN ('service', 'kueche', 'both')),
  hours NUMERIC DEFAULT 0,
  phone TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== HELPER FUNCTION =====
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Shift Templates
CREATE TABLE public.shift_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL CHECK (area IN ('service', 'kueche')),
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color TEXT NOT NULL DEFAULT '#E0DDD2',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- Shifts
CREATE TABLE public.shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL CHECK (area IN ('service', 'kueche')),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  label TEXT DEFAULT '',
  custom_label TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'modified')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Indexes for common queries
CREATE INDEX idx_shifts_date ON public.shifts(date);
CREATE INDEX idx_shifts_area_date ON public.shifts(area, date);
CREATE INDEX idx_shifts_employee ON public.shifts(employee_id);

-- Swap Requests
CREATE TABLE public.swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
  from_employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'taken', 'cancelled')),
  taken_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, firstname, lastname, role, area)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'firstname', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'lastname', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data ->> 'area', 'service')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ROW LEVEL SECURITY POLICIES =====

-- PROFILES
CREATE POLICY "Anyone authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Service role full access to profiles"
  ON public.profiles FOR ALL TO service_role USING (true);

-- SHIFT TEMPLATES
CREATE POLICY "Anyone authenticated can read templates"
  ON public.shift_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage templates"
  ON public.shift_templates FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can update templates"
  ON public.shift_templates FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Admins can delete templates"
  ON public.shift_templates FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Service role full access to templates"
  ON public.shift_templates FOR ALL TO service_role USING (true);

-- SHIFTS
CREATE POLICY "Read shifts: published or own or admin"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR employee_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY "Admins can insert shifts"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can update shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Admins can delete shifts"
  ON public.shifts FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "Service role full access to shifts"
  ON public.shifts FOR ALL TO service_role USING (true);

-- SWAP REQUESTS
CREATE POLICY "Anyone authenticated can read swaps"
  ON public.swap_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Employees can create swap for own shift"
  ON public.swap_requests FOR INSERT TO authenticated
  WITH CHECK (from_employee_id = auth.uid());

CREATE POLICY "Can update open swaps or own swaps"
  ON public.swap_requests FOR UPDATE TO authenticated
  USING (
    status = 'open'
    OR from_employee_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY "Admins can delete swaps"
  ON public.swap_requests FOR DELETE TO authenticated
  USING (get_my_role() = 'admin' OR from_employee_id = auth.uid());

CREATE POLICY "Service role full access to swaps"
  ON public.swap_requests FOR ALL TO service_role USING (true);

-- ===== SEED: Default Shift Templates =====
INSERT INTO public.shift_templates (area, label, start_time, end_time, color, sort_order) VALUES
  -- Service
  ('service', 'Frühschicht',           '09:00', '14:00', '#F2D2D6', 1),
  ('service', 'Mittagsschicht',        '11:45', '16:00', '#DFDAB0', 2),
  ('service', 'Mittagsschicht (kurz)', '12:00', '16:00', '#E8D49C', 3),
  ('service', 'Spätschicht',           '16:00', '20:30', '#E0DDD2', 4),
  ('service', 'Spätschicht (lang)',    '14:00', '20:30', '#E0DDD2', 5),
  ('service', 'Ganzer Tag',            '10:45', '19:30', '#C8DEE6', 6),
  ('service', 'Open End Schicht',      '11:30', '16:00', '#C5D8E3', 7),
  ('service', 'Cleaning',              '19:30', '21:30', '#ECEAE0', 8),
  -- Küche
  ('kueche', 'Backen',             '05:00', '08:00', '#F2D2D6', 1),
  ('kueche', 'Kochen',             '08:00', '11:30', '#DFDAB0', 2),
  ('kueche', 'Putzdienst',         '11:30', '13:00', '#F4D89B', 3),
  ('kueche', 'Rest der Lieferung', '12:00', '13:00', '#F4D89B', 4);
