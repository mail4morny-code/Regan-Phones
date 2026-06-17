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

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.phones to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.dealers to authenticated;
grant select, insert, update, delete on public.dealer_records to authenticated;
grant select, insert, update, delete on public.activity_log to authenticated;

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

notify pgrst, 'reload schema';

commit;
