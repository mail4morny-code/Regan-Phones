-- Detect and fix duplicate profile rows if profiles was ever created without
-- id as a primary key. The intended schema has public.profiles.id as the
-- primary key, so duplicates should not be possible after this is fixed.

-- Detect duplicate profile ids.
select
  id,
  count(*) as row_count,
  array_agg(ctid order by created_at desc) as duplicate_row_ctids
from public.profiles
group by id
having count(*) > 1;

-- Keep the newest row for each id and delete older duplicates.
-- Only run this delete if the select above returns rows.
with ranked_profiles as (
  select
    ctid,
    row_number() over (
      partition by id
      order by created_at desc nulls last, ctid desc
    ) as row_number_for_user
  from public.profiles
)
delete from public.profiles p
using ranked_profiles r
where p.ctid = r.ctid
  and r.row_number_for_user > 1;

-- Verify the primary key exists. If this returns no rows, add the primary key
-- after duplicates are removed.
select
  conname,
  contype
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and contype = 'p';

-- If needed, run:
-- alter table public.profiles add constraint profiles_pkey primary key (id);
