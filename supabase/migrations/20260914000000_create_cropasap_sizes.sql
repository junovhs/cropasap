-- One row of saved and pinned output sizes per CropASAP account (ACCT-02).
-- Shape and policy mirror noceremony_workbooks: the client owns the JSON, the
-- database owns the revision, and a stale write is refused rather than merged.
-- Table and function are prefixed cropasap_ because the project is shared
-- across Strange Systems apps (DEC-06).

create table public.cropasap_sizes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cropasap_sizes_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint cropasap_sizes_state_has_schema_version check (state ? 'schemaVersion')
);

comment on table public.cropasap_sizes is 'Saved and pinned output sizes for one CropASAP account, revisioned.';

alter table public.cropasap_sizes enable row level security;
alter table public.cropasap_sizes force row level security;

create policy "CropASAP users can read their own sizes"
on public.cropasap_sizes for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.cropasap_save_sizes(expected_revision bigint, next_state jsonb)
returns public.cropasap_sizes
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  saved public.cropasap_sizes%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Expected revision cannot be negative.';
  end if;
  if next_state is null or jsonb_typeof(next_state) <> 'object' or not (next_state ? 'schemaVersion') then
    raise exception using errcode = '22023', message = 'Size state must be an object with schemaVersion.';
  end if;

  if expected_revision = 0 then
    insert into public.cropasap_sizes (user_id, state, revision)
    values (caller_id, next_state, 1)
    on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.cropasap_sizes
    set state = next_state, revision = revision + 1, updated_at = now()
    where user_id = caller_id and revision = expected_revision
    returning * into saved;
  end if;

  if saved.user_id is null then
    raise exception using errcode = 'PT409', message = 'Size revision conflict.';
  end if;
  return saved;
end;
$$;

revoke all on table public.cropasap_sizes from anon, authenticated;
grant select on table public.cropasap_sizes to authenticated;
revoke all on function public.cropasap_save_sizes(bigint, jsonb) from public, anon;
grant execute on function public.cropasap_save_sizes(bigint, jsonb) to authenticated;
