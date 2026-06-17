-- Regan Phones shared shop visibility fix.
-- Run this in Supabase SQL Editor if workers cannot see admin-added stock.

begin;

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

drop policy if exists "phones_select_admin_or_creator" on public.phones;
drop policy if exists "phones_select_active_staff" on public.phones;
create policy "phones_select_active_staff" on public.phones
for select
using (public.is_active_staff());

drop policy if exists "phones_update_admin_or_creator" on public.phones;
drop policy if exists "phones_update_active_staff" on public.phones;
create policy "phones_update_active_staff" on public.phones
for update
using (public.is_active_staff())
with check (public.is_active_staff());

drop policy if exists "phones_insert_admin_or_worker" on public.phones;
drop policy if exists "phones_insert_active_staff" on public.phones;
create policy "phones_insert_active_staff" on public.phones
for insert
with check (created_by = auth.uid() and public.is_active_staff());

drop policy if exists "dealers_select_admin_or_worker" on public.dealers;
drop policy if exists "dealers_select_active_staff" on public.dealers;
create policy "dealers_select_active_staff" on public.dealers
for select
using (public.is_active_staff());

drop policy if exists "dealers_insert_admin_or_worker" on public.dealers;
drop policy if exists "dealers_insert_active_staff" on public.dealers;
create policy "dealers_insert_active_staff" on public.dealers
for insert
with check (public.is_active_staff());

drop policy if exists "dealer_batches_select_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_select_active_staff" on public.dealer_batches;
create policy "dealer_batches_select_active_staff" on public.dealer_batches
for select
using (public.is_active_staff());

drop policy if exists "dealer_batches_insert_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_insert_active_staff" on public.dealer_batches;
create policy "dealer_batches_insert_active_staff" on public.dealer_batches
for insert
with check (created_by = auth.uid() and public.is_active_staff());

drop policy if exists "dealer_batches_update_admin_or_creator" on public.dealer_batches;
drop policy if exists "dealer_batches_update_active_staff" on public.dealer_batches;
create policy "dealer_batches_update_active_staff" on public.dealer_batches
for update
using (public.is_active_staff())
with check (public.is_active_staff());

drop policy if exists "dealer_records_select_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_select_active_staff" on public.dealer_records;
create policy "dealer_records_select_active_staff" on public.dealer_records
for select
using (public.is_active_staff());

drop policy if exists "dealer_records_insert_admin_or_worker" on public.dealer_records;
drop policy if exists "dealer_records_insert_active_staff" on public.dealer_records;
create policy "dealer_records_insert_active_staff" on public.dealer_records
for insert
with check (created_by = auth.uid() and public.is_active_staff());

drop policy if exists "dealer_records_update_admin_or_creator" on public.dealer_records;
drop policy if exists "dealer_records_update_active_staff" on public.dealer_records;
create policy "dealer_records_update_active_staff" on public.dealer_records
for update
using (public.is_active_staff())
with check (public.is_active_staff());

notify pgrst, 'reload schema';

commit;
