-- Regan Phones remote database initializer.
-- Run this once in Supabase SQL Editor for project qtywjqxhextoaewhgjyr,
-- or apply it with psql/Supabase CLI using a privileged database connection.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone_number text,
  role text not null default 'worker' check (role in ('admin', 'worker')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.phones (
  id uuid primary key default gen_random_uuid(),
  imei text not null unique,
  brand text not null,
  model text not null,
  storage text,
  color text,
  battery_health text,
  condition text not null check (condition in ('New', 'UK Used')),
  cost_price numeric not null,
  selling_price numeric not null,
  status text not null default 'Available' check (status in ('Available', 'Sold', 'With Dealer', 'Returned', 'Damaged', 'Archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete restrict,
  customer_name text,
  customer_phone text,
  selling_price numeric not null,
  profit numeric not null,
  payment_method text not null default 'Cash',
  payment_status text not null default 'Received' check (payment_status in ('Pending Admin Confirmation', 'Received')),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  sold_by uuid not null references public.profiles(id) on delete restrict,
  sold_at timestamptz not null default now(),
  constraint sales_phone_id_unique_if_desired unique(phone_id)
);

create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.dealer_batches (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  date_given timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.dealer_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.dealer_batches(id) on delete set null,
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  phone_id uuid not null references public.phones(id) on delete restrict,
  agreed_price numeric not null,
  amount_paid numeric not null default 0,
  status text not null default 'With Dealer' check (status in ('With Dealer', 'Sold', 'Returned')),
  date_given timestamptz not null default now(),
  date_completed timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  phone_id uuid references public.phones(id) on delete set null,
  dealer_id uuid references public.dealers(id) on delete set null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists phones_created_by_idx on public.phones(created_by);
create index if not exists phones_status_idx on public.phones(status);
create index if not exists phones_brand_model_idx on public.phones(brand, model);
create index if not exists sales_sold_by_idx on public.sales(sold_by);
create index if not exists sales_sold_at_idx on public.sales(sold_at);
create index if not exists sales_payment_status_idx on public.sales(payment_status);
create index if not exists sales_confirmed_at_idx on public.sales(confirmed_at);
create index if not exists sales_confirmed_by_idx on public.sales(confirmed_by);
create index if not exists dealers_phone_idx on public.dealers(phone_number);
create index if not exists dealer_batches_dealer_id_idx on public.dealer_batches(dealer_id);
create index if not exists dealer_batches_date_given_idx on public.dealer_batches(date_given);
create index if not exists dealer_records_amount_paid_idx on public.dealer_records(amount_paid);
create index if not exists dealer_records_batch_id_idx on public.dealer_records(batch_id);
create index if not exists dealer_records_dealer_id_idx on public.dealer_records(dealer_id);
create index if not exists dealer_records_phone_id_idx on public.dealer_records(phone_id);
create index if not exists dealer_records_status_idx on public.dealer_records(status);
create index if not exists dealer_records_date_given_idx on public.dealer_records(date_given);
create index if not exists activity_log_user_id_idx on public.activity_log(user_id);
create index if not exists activity_log_phone_id_idx on public.activity_log(phone_id);
create index if not exists activity_log_dealer_id_idx on public.activity_log(dealer_id);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_phone_number_idx on public.profiles(phone_number);
create index if not exists sales_customer_phone_idx on public.sales(customer_phone);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_phones_set_updated_at on public.phones;
create trigger trg_phones_set_updated_at
before update on public.phones
for each row execute function public.set_updated_at();

create or replace function public.set_sale_payment_confirmation_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_role text;
begin
  select role into seller_role
  from public.profiles
  where id = new.sold_by;

  if seller_role = 'worker' then
    new.payment_status := 'Pending Admin Confirmation';
    new.confirmed_by := null;
    new.confirmed_at := null;
  elsif seller_role = 'admin' then
    new.payment_status := coalesce(new.payment_status, 'Received');
    if new.payment_status = 'Received' then
      new.confirmed_by := coalesce(new.confirmed_by, new.sold_by);
      new.confirmed_at := coalesce(new.confirmed_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_payment_confirmation_defaults on public.sales;
create trigger trg_sales_payment_confirmation_defaults
before insert on public.sales
for each row execute function public.set_sale_payment_confirmation_defaults();

alter table public.profiles enable row level security;
alter table public.phones enable row level security;
alter table public.sales enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_batches enable row level security;
alter table public.dealer_records enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'worker')
      and p.is_active = true
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to anon, authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "phones_select_admin_or_creator" on public.phones;
drop policy if exists "phones_select_active_staff" on public.phones;
drop policy if exists "phones_insert_admin_or_worker" on public.phones;
drop policy if exists "phones_insert_active_staff" on public.phones;
drop policy if exists "phones_update_admin_or_creator" on public.phones;
drop policy if exists "phones_update_active_staff" on public.phones;
drop policy if exists "phones_delete_admin_only" on public.phones;
drop policy if exists "sales_select_admin_or_sold_by" on public.sales;
drop policy if exists "sales_insert_admin_or_worker" on public.sales;
drop policy if exists "sales_update_admin_only" on public.sales;
drop policy if exists "sales_delete_admin_only" on public.sales;
drop policy if exists "dealers_select_admin_or_worker" on public.dealers;
drop policy if exists "dealers_select_active_staff" on public.dealers;
drop policy if exists "dealers_insert_admin_or_worker" on public.dealers;
drop policy if exists "dealers_insert_active_staff" on public.dealers;
drop policy if exists "dealers_update_admin_only" on public.dealers;
drop policy if exists "dealers_delete_admin_only" on public.dealers;
drop policy if exists "dealer_batches_select_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_select_active_staff" on public.dealer_batches;
drop policy if exists "dealer_batches_insert_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_insert_active_staff" on public.dealer_batches;
drop policy if exists "dealer_batches_update_admin_or_creator" on public.dealer_batches;
drop policy if exists "dealer_batches_update_active_staff" on public.dealer_batches;
drop policy if exists "dealer_batches_delete_admin_only" on public.dealer_batches;
drop policy if exists "dealer_records_select_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_select_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_insert_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_insert_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_update_admin_or_creator" on public.dealer_records;
drop policy if exists "dealer_records_update_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_delete_admin_only" on public.dealer_records;
drop policy if exists "activity_log_select_admin_or_user" on public.activity_log;
drop policy if exists "activity_log_insert_admin_or_worker" on public.activity_log;
drop policy if exists "activity_log_update_delete_admin_only" on public.activity_log;
drop policy if exists "activity_log_delete_admin_only" on public.activity_log;

create policy "profiles_select_own" on public.profiles
for select using (
  id = auth.uid()
);

create policy "profiles_select_admin" on public.profiles
for select using (public.is_admin());

create policy "profiles_insert_self" on public.profiles
for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

create policy "phones_select_active_staff" on public.phones
for select using (public.is_active_staff());

create policy "phones_insert_active_staff" on public.phones
for insert with check (
  created_by = auth.uid()
  and public.is_active_staff()
);

create policy "phones_update_active_staff" on public.phones
for update using (public.is_active_staff())
with check (public.is_active_staff());

create policy "phones_delete_admin_only" on public.phones
for delete using (public.is_admin());

create policy "sales_select_admin_or_sold_by" on public.sales
for select using (
  sold_by = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "sales_insert_admin_or_worker" on public.sales
for insert with check (
  sold_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'worker') and p.is_active)
);

create policy "sales_update_admin_only" on public.sales
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "sales_delete_admin_only" on public.sales
for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "dealers_select_active_staff" on public.dealers
for select using (public.is_active_staff());

create policy "dealers_insert_active_staff" on public.dealers
for insert with check (public.is_active_staff());

create policy "dealers_update_admin_only" on public.dealers
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "dealers_delete_admin_only" on public.dealers
for delete using (public.is_admin());

create policy "dealer_batches_select_active_staff" on public.dealer_batches
for select using (public.is_active_staff());

create policy "dealer_batches_insert_active_staff" on public.dealer_batches
for insert with check (
  created_by = auth.uid()
  and public.is_active_staff()
);

create policy "dealer_batches_update_active_staff" on public.dealer_batches
for update using (public.is_active_staff())
with check (public.is_active_staff());

create policy "dealer_batches_delete_admin_only" on public.dealer_batches
for delete using (
  public.is_admin()
);

create policy "dealer_records_select_active_staff" on public.dealer_records
for select using (public.is_active_staff());

create policy "dealer_records_insert_active_staff" on public.dealer_records
for insert with check (
  created_by = auth.uid()
  and public.is_active_staff()
);

create policy "dealer_records_update_active_staff" on public.dealer_records
for update using (public.is_active_staff())
with check (public.is_active_staff());

create policy "dealer_records_delete_admin_only" on public.dealer_records
for delete using (public.is_admin());

create policy "activity_log_select_admin_or_user" on public.activity_log
for select using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "activity_log_insert_admin_or_worker" on public.activity_log
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'worker') and p.is_active)
);

create policy "activity_log_update_delete_admin_only" on public.activity_log
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "activity_log_delete_admin_only" on public.activity_log
for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.phones to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.dealers to authenticated;
grant select, insert, update, delete on public.dealer_batches to authenticated;
grant select, insert, update, delete on public.dealer_records to authenticated;
grant select, insert on public.activity_log to authenticated;
grant update, delete on public.activity_log to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'admin',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';

commit;
