begin;

alter table public.dealer_records
  add column if not exists amount_paid numeric not null default 0;

alter table public.sales
  add column if not exists payment_method text not null default 'Cash';

alter table public.activity_log
  add column if not exists phone_id uuid references public.phones(id) on delete set null,
  add column if not exists dealer_id uuid references public.dealers(id) on delete set null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'phones'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%status%'
  loop
    execute format('alter table public.phones drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.phones
  add constraint phones_status_check
  check (status in ('Available', 'Sold', 'With Dealer', 'Returned', 'Damaged', 'Archived'));

create index if not exists dealer_records_amount_paid_idx on public.dealer_records(amount_paid);
create index if not exists activity_log_phone_id_idx on public.activity_log(phone_id);
create index if not exists activity_log_dealer_id_idx on public.activity_log(dealer_id);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists sales_customer_phone_idx on public.sales(customer_phone);

drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_admin" on public.profiles
for select
using (public.is_admin());

create policy "profiles_update_admin" on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
