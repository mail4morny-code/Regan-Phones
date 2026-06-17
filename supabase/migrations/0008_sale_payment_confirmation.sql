-- Sale payment confirmation workflow.
-- Worker sales wait for admin money confirmation before counting as received.

begin;

alter table public.sales
  add column if not exists payment_status text not null default 'Received'
    check (payment_status in ('Pending Admin Confirmation', 'Received')),
  add column if not exists confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists confirmed_at timestamptz;

update public.sales
set payment_status = 'Received',
    confirmed_at = coalesce(confirmed_at, sold_at)
where payment_status is null;

create index if not exists sales_payment_status_idx on public.sales(payment_status);
create index if not exists sales_confirmed_at_idx on public.sales(confirmed_at);
create index if not exists sales_confirmed_by_idx on public.sales(confirmed_by);

notify pgrst, 'reload schema';

commit;
