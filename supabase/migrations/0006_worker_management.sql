begin;

alter table public.profiles
  add column if not exists phone_number text;

create index if not exists profiles_phone_number_idx on public.profiles(phone_number);

notify pgrst, 'reload schema';

commit;
