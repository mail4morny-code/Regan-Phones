-- Auto-create profiles row when a user signs up
-- Run in Supabase SQL editor.

begin;

-- Ensure extension for gen_random_uuid (harmless if exists)
create extension if not exists pgcrypto;

-- Trigger function
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
    null,
    'admin',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop + create trigger
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

commit;

