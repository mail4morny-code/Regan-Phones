-- Fix Regan Phones RLS recursion.
-- Run this in the Supabase SQL Editor for project qtywjqxhextoaewhgjyr.
--
-- Root cause:
--   The profiles_select_own_or_admin policy queried public.profiles from inside
--   a policy on public.profiles, causing Postgres error 42P17.
--
-- Fix:
--   1. Profiles policies no longer query public.profiles.
--   2. Admin checks for other tables use public.is_admin(), a SECURITY DEFINER
--      function that can read profiles without triggering RLS recursion.

begin;

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
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select
using (id = auth.uid());

create policy "profiles_insert_self" on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "phones_select_admin_or_creator" on public.phones;
drop policy if exists "phones_select_active_staff" on public.phones;
drop policy if exists "phones_insert_admin_or_worker" on public.phones;
drop policy if exists "phones_insert_active_staff" on public.phones;
drop policy if exists "phones_update_admin_or_creator" on public.phones;
drop policy if exists "phones_update_active_staff" on public.phones;
drop policy if exists "phones_delete_admin_only" on public.phones;

create policy "phones_select_active_staff" on public.phones
for select
using (public.is_active_staff());

create policy "phones_insert_active_staff" on public.phones
for insert
with check (
  created_by = auth.uid()
  and public.is_active_staff()
);

create policy "phones_update_active_staff" on public.phones
for update
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "phones_delete_admin_only" on public.phones
for delete
using (public.is_admin());

drop policy if exists "sales_select_admin_or_sold_by" on public.sales;
drop policy if exists "sales_insert_admin_or_worker" on public.sales;
drop policy if exists "sales_update_admin_only" on public.sales;
drop policy if exists "sales_delete_admin_only" on public.sales;

create policy "sales_select_admin_or_sold_by" on public.sales
for select
using (public.is_admin() or sold_by = auth.uid());

create policy "sales_insert_admin_or_worker" on public.sales
for insert
with check (
  sold_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'worker')
      and p.is_active = true
  )
);

create policy "sales_update_admin_only" on public.sales
for update
using (public.is_admin())
with check (public.is_admin());

create policy "sales_delete_admin_only" on public.sales
for delete
using (public.is_admin());

drop policy if exists "dealers_select_admin_or_worker" on public.dealers;
drop policy if exists "dealers_select_active_staff" on public.dealers;
drop policy if exists "dealers_insert_admin_or_worker" on public.dealers;
drop policy if exists "dealers_insert_active_staff" on public.dealers;
drop policy if exists "dealers_update_admin_only" on public.dealers;
drop policy if exists "dealers_delete_admin_only" on public.dealers;

create policy "dealers_select_active_staff" on public.dealers
for select
using (public.is_active_staff());

create policy "dealers_insert_active_staff" on public.dealers
for insert
with check (public.is_active_staff());

create policy "dealers_update_admin_only" on public.dealers
for update
using (public.is_admin())
with check (public.is_admin());

create policy "dealers_delete_admin_only" on public.dealers
for delete
using (public.is_admin());

drop policy if exists "dealer_records_select_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_select_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_insert_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_insert_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_update_admin_or_creator" on public.dealer_records;
drop policy if exists "dealer_records_update_active_staff" on public.dealer_records;
drop policy if exists "dealer_records_delete_admin_only" on public.dealer_records;

create policy "dealer_records_select_active_staff" on public.dealer_records
for select
using (public.is_active_staff());

create policy "dealer_records_insert_active_staff" on public.dealer_records
for insert
with check (
  created_by = auth.uid()
  and public.is_active_staff()
);

create policy "dealer_records_update_active_staff" on public.dealer_records
for update
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "dealer_records_delete_admin_only" on public.dealer_records
for delete
using (public.is_admin());

drop policy if exists "activity_log_select_admin_or_user" on public.activity_log;
drop policy if exists "activity_log_insert_admin_or_worker" on public.activity_log;
drop policy if exists "activity_log_update_delete_admin_only" on public.activity_log;
drop policy if exists "activity_log_delete_admin_only" on public.activity_log;

create policy "activity_log_select_admin_or_user" on public.activity_log
for select
using (public.is_admin() or user_id = auth.uid());

create policy "activity_log_insert_admin_or_worker" on public.activity_log
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'worker')
      and p.is_active = true
  )
);

create policy "activity_log_update_delete_admin_only" on public.activity_log
for update
using (public.is_admin())
with check (public.is_admin());

create policy "activity_log_delete_admin_only" on public.activity_log
for delete
using (public.is_admin());

notify pgrst, 'reload schema';

commit;
