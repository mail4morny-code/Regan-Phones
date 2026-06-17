-- Regan Phones activity accountability backfill.
-- Run once in Supabase SQL Editor if you want old activity rows to use staff names.
-- This is safe to rerun. It rebuilds known activity descriptions from linked
-- profiles, phones, dealers, and dealer records where possible.

begin;

alter table public.activity_log
  add column if not exists phone_id uuid references public.phones(id) on delete set null,
  add column if not exists dealer_id uuid references public.dealers(id) on delete set null;

alter table public.dealer_records
  add column if not exists amount_paid numeric not null default 0;

create index if not exists activity_log_phone_id_idx on public.activity_log(phone_id);
create index if not exists activity_log_dealer_id_idx on public.activity_log(dealer_id);

with activity_context as (
  select
    al.id,
    al.action,
    al.description,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Staff member') as actor_name,
    coalesce(ph.imei, substring(coalesce(al.description, '') from 'IMEI[[:space:]]+([A-Za-z0-9-]+)')) as imei,
    trim(coalesce(ph.brand, '') || ' ' || coalesce(ph.model, '')) as phone_name,
    coalesce(nullif(trim(d.name), ''), 'the dealer') as dealer_name,
    dr.agreed_price,
    dr.amount_paid,
    p.role,
    substring(coalesce(al.description, '') from 'Added worker[[:space:]]+(.+)$') as created_worker,
    substring(coalesce(al.description, '') from 'Enabled worker[[:space:]]+(.+)$') as enabled_worker,
    substring(coalesce(al.description, '') from 'Disabled worker[[:space:]]+(.+)$') as disabled_worker,
    substring(coalesce(al.description, '') from 'Gave[[:space:]]+([0-9]+[[:space:]]+phones?)') as batch_count,
    substring(coalesce(al.description, '') from 'Total agreed:[[:space:]]*(.+)$') as batch_total,
    substring(coalesce(al.description, '') from 'to dealer[[:space:]]+(.+?)\.') as dealer_from_description,
    substring(coalesce(al.description, '') from 'Agreed:[[:space:]]*(.+)$') as agreed_from_description
  from public.activity_log al
  left join public.profiles p on p.id = al.user_id
  left join public.phones ph on ph.id = al.phone_id
  left join public.dealers d on d.id = al.dealer_id
  left join lateral (
    select dealer_records.agreed_price, dealer_records.amount_paid
    from public.dealer_records
    where (al.phone_id is not null or al.dealer_id is not null)
      and (al.phone_id is null or dealer_records.phone_id = al.phone_id)
      and (al.dealer_id is null or dealer_records.dealer_id = al.dealer_id)
    order by coalesce(dealer_records.date_completed, dealer_records.created_at) desc
    limit 1
  ) dr on true
),
new_descriptions as (
  select
    id,
    case action
      when 'PHONE_ADDED' then
        actor_name || ' added phone IMEI ' || coalesce(imei, 'not available')
      when 'PHONE_UPDATED' then
        actor_name || ' updated ' || coalesce(nullif(phone_name, ''), 'phone') || ' IMEI ' || coalesce(imei, 'not available')
      when 'PHONE_ARCHIVED' then
        actor_name || ' removed ' || coalesce(nullif(phone_name, ''), 'phone') || ' IMEI ' || coalesce(imei, 'not available') || ' from active stock'
      when 'PHONE_DAMAGED' then
        actor_name || ' marked ' || coalesce(nullif(phone_name, ''), 'phone') || ' IMEI ' || coalesce(imei, 'not available') || ' as damaged'
      when 'PHONE_SOLD' then
        actor_name || ' sold phone IMEI ' || coalesce(imei, 'not available') || '. Money received.'
      when 'PHONE_SOLD_PENDING_CONFIRMATION' then
        actor_name || ' sold phone IMEI ' || coalesce(imei, 'not available') || '. Owner needs to confirm payment.'
      when 'PHONE_GIVEN' then
        actor_name || ' gave phone IMEI ' || coalesce(imei, 'not available') ||
        ' to ' || coalesce(dealer_from_description, dealer_name) ||
        coalesce('. Agreed: ' || agreed_from_description, case when agreed_price is not null then '. Agreed: GHS ' || to_char(agreed_price, 'FM999,999,999,990.00') else '' end)
      when 'DEALER_BATCH_GIVEN' then
        actor_name || ' gave ' || coalesce(batch_count, 'phones') || ' to ' || dealer_name ||
        coalesce('. Total agreed: ' || batch_total, '')
      when 'PHONE_DEALER_SOLD' then
        actor_name || ' marked ' || dealer_name || '''s phone IMEI ' || coalesce(imei, 'not available') || ' as sold.' ||
        case
          when role = 'admin' and agreed_price is not null then
            ' Money received: GHS ' || to_char(coalesce(amount_paid, agreed_price), 'FM999,999,999,990.00') ||
            ' of GHS ' || to_char(agreed_price, 'FM999,999,999,990.00') || '.'
          else ' Owner needs to confirm payment.'
        end
      when 'PHONE_RETURNED' then
        actor_name || ' marked ' || dealer_name || '''s phone IMEI ' || coalesce(imei, 'not available') || ' as returned to the shop.'
      when 'SALE_PAYMENT_CONFIRMED' then
        actor_name || ' confirmed money received for ' || coalesce(nullif(phone_name, ''), 'phone') || ' IMEI ' || coalesce(imei, 'not available') || '.'
      when 'WORKER_CREATED' then
        actor_name || ' added ' || coalesce(created_worker, 'a worker')
      when 'WORKER_ENABLED' then
        actor_name || ' enabled ' || coalesce(enabled_worker, 'a worker')
      when 'WORKER_DISABLED' then
        actor_name || ' disabled ' || coalesce(disabled_worker, 'a worker')
      else description
    end as description
  from activity_context
)
update public.activity_log al
set description = nd.description
from new_descriptions nd
where al.id = nd.id
  and nd.description is not null
  and nd.description is distinct from al.description
  and al.action in (
    'PHONE_ADDED',
    'PHONE_UPDATED',
    'PHONE_ARCHIVED',
    'PHONE_DAMAGED',
    'PHONE_SOLD',
    'PHONE_SOLD_PENDING_CONFIRMATION',
    'PHONE_GIVEN',
    'DEALER_BATCH_GIVEN',
    'PHONE_DEALER_SOLD',
    'PHONE_RETURNED',
    'SALE_PAYMENT_CONFIRMED',
    'WORKER_CREATED',
    'WORKER_ENABLED',
    'WORKER_DISABLED'
  );

notify pgrst, 'reload schema';

commit;
