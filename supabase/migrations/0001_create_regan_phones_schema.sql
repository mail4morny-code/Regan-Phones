-- Regan Phones MVP schema + RLS
-- Fallback/portable migration: run in Supabase SQL editor or via CLI.

begin;

-- Helpful enum values via CHECK constraints (keep migration simple and portable)

-- 1) profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'worker' check (role in ('admin','worker')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) phones
create table if not exists public.phones (
  id uuid primary key default gen_random_uuid(),
  imei text not null unique,
  brand text not null,
  model text not null,
  storage text,
  color text,
  condition text not null check (condition in ('New','UK Used')),
  cost_price numeric not null,
  selling_price numeric not null,
  status text not null default 'Available' check (status in ('Available','Sold','With Dealer','Returned','Damaged')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phones_created_by_idx on public.phones(created_by);
create index if not exists phones_status_idx on public.phones(status);
create index if not exists phones_brand_model_idx on public.phones(brand, model);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_phones_set_updated_at on public.phones;
create trigger trg_phones_set_updated_at
before update on public.phones
for each row execute function public.set_updated_at();

-- 3) sales
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete restrict,
  customer_name text,
  customer_phone text,
  selling_price numeric not null,
  profit numeric not null,
  sold_by uuid not null references public.profiles(id) on delete restrict,
  sold_at timestamptz not null default now(),
  constraint sales_phone_id_unique_if_desired unique(phone_id) -- ensures one sale per phone
);

create index if not exists sales_sold_by_idx on public.sales(sold_by);
create index if not exists sales_sold_at_idx on public.sales(sold_at);

-- 4) dealers
create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null,
  created_at timestamptz not null default now()
);

create index if not exists dealers_phone_idx on public.dealers(phone_number);

-- 5) dealer_records
create table if not exists public.dealer_records (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  phone_id uuid not null references public.phones(id) on delete restrict,
  agreed_price numeric not null,
  status text not null default 'With Dealer' check (status in ('With Dealer','Sold','Returned')),
  date_given timestamptz not null default now(),
  date_completed timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists dealer_records_dealer_id_idx on public.dealer_records(dealer_id);
create index if not exists dealer_records_phone_id_idx on public.dealer_records(phone_id);
create index if not exists dealer_records_status_idx on public.dealer_records(status);
create index if not exists dealer_records_date_given_idx on public.dealer_records(date_given);

-- 6) activity_log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_id_idx on public.activity_log(user_id);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at);

-- RLS
alter table public.profiles enable row level security;
alter table public.phones enable row level security;
alter table public.sales enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_records enable row level security;
alter table public.activity_log enable row level security;

-- Helper: auth role checks
-- Admin can do anything; workers can only affect rows they created/owned.

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
for select
using (
  role = 'admin'
  or id = auth.uid()
);

create policy "profiles_insert_self" on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- phones
create policy "phones_select_admin_or_creator" on public.phones
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
);

create policy "phones_insert_admin_or_worker" on public.phones
for insert
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker'))
  and created_by = auth.uid()
);

create policy "phones_update_admin_or_creator" on public.phones
for update
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
);

create policy "phones_delete_admin_only" on public.phones
for delete
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- sales
create policy "sales_select_admin_or_sold_by" on public.sales
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or sold_by = auth.uid()
);

create policy "sales_insert_admin_or_worker" on public.sales
for insert
with check (
  sold_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker'))
);

create policy "sales_update_admin_only" on public.sales
for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "sales_delete_admin_only" on public.sales
for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- dealers
create policy "dealers_select_admin_or_worker" on public.dealers
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker') and p.is_active)
);

create policy "dealers_insert_admin_or_worker" on public.dealers
for insert
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker') and p.is_active)
);

create policy "dealers_update_admin_only" on public.dealers
for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "dealers_delete_admin_only" on public.dealers
for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- dealer_records
create policy "dealer_records_select_admin_or_worker" on public.dealer_records
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
);

create policy "dealer_records_insert_admin_or_worker" on public.dealer_records
for insert
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker') and p.is_active)
  and created_by = auth.uid()
);

create policy "dealer_records_update_admin_or_creator" on public.dealer_records
for update
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or created_by = auth.uid()
);

create policy "dealer_records_delete_admin_only" on public.dealer_records
for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- activity_log
create policy "activity_log_select_admin_or_user" on public.activity_log
for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or user_id = auth.uid()
);

create policy "activity_log_insert_admin_or_worker" on public.activity_log
for insert
with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','worker') and p.is_active)
);

create policy "activity_log_update_delete_admin_only" on public.activity_log
for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "activity_log_delete_admin_only" on public.activity_log
for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Ensure gen_random_uuid exists
create extension if not exists pgcrypto;

commit;

