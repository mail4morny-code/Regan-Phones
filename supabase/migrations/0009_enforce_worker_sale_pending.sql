-- Enforce worker sale payment confirmation at the database level.
-- Even if old app code is running, worker sales are saved as pending.

begin;

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

update public.sales s
set payment_status = 'Pending Admin Confirmation',
    confirmed_by = null,
    confirmed_at = null
from public.profiles p
where s.sold_by = p.id
  and p.role = 'worker'
  and s.payment_status = 'Received'
  and s.confirmed_by is null;

notify pgrst, 'reload schema';

commit;
