-- Madina Street: run this entire script in the Neon SQL Editor.
-- Creates empty relational tables. Does not migrate madina_street_state
-- or switch the application's existing JSONB storage to these tables.
-- Existing tables/data are preserved; IF NOT EXISTS does not upgrade schemas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array'),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  username text UNIQUE,
  role text NOT NULL REFERENCES public.roles(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  active boolean NOT NULL DEFAULT true,
  phone text,
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  last_login timestamptz,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array')
);

CREATE TABLE IF NOT EXISTS public.houses (
  id text PRIMARY KEY,
  house_no text NOT NULL UNIQUE,
  street text NOT NULL,
  sector text NOT NULL,
  category text NOT NULL,
  resident_type text NOT NULL CHECK (resident_type IN ('Owner', 'Tenant')),
  head_name text NOT NULL,
  cnic text,
  phone text NOT NULL,
  whatsapp text,
  family_members integer NOT NULL DEFAULT 0 CHECK (family_members >= 0),
  monthly_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  status text NOT NULL DEFAULT 'Active',
  current_dues numeric(14,2) NOT NULL DEFAULT 0,
  current_dues_override boolean NOT NULL DEFAULT false,
  registration_month text,
  joined_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  notes text,
  last_payment_date date,
  last_receipt_no text
);

CREATE TABLE IF NOT EXISTS public.collections (
  id text PRIMARY KEY,
  receipt_no text NOT NULL UNIQUE,
  house_id text NOT NULL REFERENCES public.houses(id) ON DELETE RESTRICT,
  house_no text NOT NULL,
  head_name text NOT NULL,
  sector text NOT NULL,
  street text NOT NULL,
  month text NOT NULL,
  year integer,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  late_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  total_paid numeric(14,2) NOT NULL CHECK (total_paid >= 0),
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  reference_no text,
  collector_id text REFERENCES public.users(id) ON DELETE SET NULL,
  collector_name text NOT NULL,
  notes text,
  remarks text,
  status text NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Cancelled')),
  cancelled_by text,
  cancelled_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  voucher_no text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL REFERENCES public.expense_categories(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  date date NOT NULL,
  paid_to text NOT NULL,
  payment_method text NOT NULL,
  reference_no text,
  receipt_attachment_url text,
  created_by text NOT NULL,
  approved_by text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.designations (
  id text PRIMARY KEY,
  title text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.staff (
  id text PRIMARY KEY,
  emp_no text NOT NULL UNIQUE,
  name text NOT NULL,
  father_name text,
  cnic text NOT NULL,
  phone text NOT NULL,
  emergency_contact text,
  address text NOT NULL,
  role text NOT NULL REFERENCES public.designations(title) ON UPDATE CASCADE ON DELETE RESTRICT,
  joining_date date NOT NULL,
  monthly_salary numeric(14,2) NOT NULL CHECK (monthly_salary >= 0),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Resigned')),
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.salaries (
  id text PRIMARY KEY,
  slip_no text NOT NULL UNIQUE,
  staff_id text NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  staff_name text NOT NULL,
  staff_role text NOT NULL,
  month text NOT NULL,
  year integer,
  base_salary numeric(14,2) NOT NULL CHECK (base_salary >= 0),
  allowance numeric(14,2) NOT NULL DEFAULT 0,
  bonus numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_paid numeric(14,2) NOT NULL CHECK (net_paid >= 0),
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  notes text,
  paid_by text
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id text PRIMARY KEY,
  date date NOT NULL,
  staff_id text NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  staff_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Half Day', 'Late')),
  check_in text,
  notes text,
  UNIQUE (staff_id, date)
);

CREATE TABLE IF NOT EXISTS public.ledger (
  id text PRIMARY KEY,
  date date NOT NULL,
  reference_no text NOT NULL,
  reference_type text CHECK (reference_type IN ('COLLECTION', 'EXPENSE', 'SALARY', 'ADJUSTMENT')),
  type text NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  account_head text NOT NULL,
  description text NOT NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  running_balance numeric(14,2) NOT NULL DEFAULT 0,
  performed_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mohalla_name text NOT NULL,
  registration_no text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  currency_symbol text NOT NULL DEFAULT 'Rs.',
  default_monthly_fee numeric(14,2) NOT NULL DEFAULT 1500,
  late_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  due_day_of_month integer NOT NULL DEFAULT 10 CHECK (due_day_of_month BETWEEN 1 AND 31),
  president_name text NOT NULL DEFAULT '',
  treasurer_name text NOT NULL DEFAULT '',
  receipt_header text NOT NULL DEFAULT '',
  receipt_footer text NOT NULL DEFAULT '',
  show_bismillah boolean NOT NULL DEFAULT true,
  enable_sms_alerts boolean NOT NULL DEFAULT false,
  time_zone text DEFAULT 'Asia/Karachi',
  language text DEFAULT 'English / Urdu',
  receipt_logo_url text,
  signature_area_text text,
  receipt_layout text DEFAULT 'Both' CHECK (receipt_layout IN ('A4', 'Thermal', 'Both')),
  thermal_width_mm integer DEFAULT 80 CHECK (thermal_width_mm > 0),
  auto_backup_enabled boolean NOT NULL DEFAULT false,
  auto_backup_frequency text DEFAULT 'Daily' CHECK (auto_backup_frequency IN ('Daily', 'Weekly', 'Monthly'))
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  link text
);

CREATE TABLE IF NOT EXISTS public.backup_history (
  id text PRIMARY KEY,
  filename text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  type text NOT NULL CHECK (type IN ('MANUAL', 'SCHEDULED')),
  status text NOT NULL CHECK (status IN ('COMPLETED', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS public.login_history (
  id text PRIMARY KEY,
  user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  login_time timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz,
  ip_address text NOT NULL,
  browser text NOT NULL,
  os text NOT NULL,
  location text
);

-- Audit identities remain as historical text, including deleted/system users.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_role text NOT NULL,
  action text NOT NULL,
  module text NOT NULL,
  description text NOT NULL,
  ip_address text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_houses_sector_street ON public.houses(sector, street);
CREATE INDEX IF NOT EXISTS idx_collections_house_date ON public.collections(house_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_collections_collector ON public.collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_collections_payment_date ON public.collections(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_salaries_staff_date ON public.salaries(staff_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.ledger(date);
CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON public.login_history(user_id, login_time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

COMMIT;

-- Show the tables after successful creation.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
