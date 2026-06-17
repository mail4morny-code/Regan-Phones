begin;

alter table public.phones
  add column if not exists battery_health text;

create table if not exists public.dealer_batches (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  date_given timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.dealer_records
  add column if not exists batch_id uuid references public.dealer_batches(id) on delete set null;

create index if not exists dealer_batches_dealer_id_idx on public.dealer_batches(dealer_id);
create index if not exists dealer_batches_date_given_idx on public.dealer_batches(date_given);
create index if not exists dealer_records_batch_id_idx on public.dealer_records(batch_id);

alter table public.dealer_batches enable row level security;

drop policy if exists "dealer_batches_select_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_insert_admin_or_worker" on public.dealer_batches;
drop policy if exists "dealer_batches_update_admin_or_creator" on public.dealer_batches;
drop policy if exists "dealer_batches_delete_admin_only" on public.dealer_batches;

create policy "dealer_batches_select_admin_or_worker" on public.dealer_batches
for select using (
  created_by = auth.uid()
  or public.is_admin()
);

create policy "dealer_batches_insert_admin_or_worker" on public.dealer_batches
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'worker')
      and p.is_active = true
  )
);

create policy "dealer_batches_update_admin_or_creator" on public.dealer_batches
for update using (
  created_by = auth.uid()
  or public.is_admin()
) with check (
  created_by = auth.uid()
  or public.is_admin()
);

create policy "dealer_batches_delete_admin_only" on public.dealer_batches
for delete using (public.is_admin());

grant select, insert, update, delete on public.dealer_batches to authenticated;

notify pgrst, 'reload schema';

commit;
