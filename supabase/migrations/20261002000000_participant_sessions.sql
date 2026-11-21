begin;

create extension if not exists pgcrypto;

create table if not exists public.found_aura_campaign_participants (
  id uuid primary key default gen_random_uuid(),
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  contact text check (contact is null or char_length(contact) between 3 and 254),
  marketing_consent boolean not null default false,
  public_code text not null unique,
  recovery_token_hash text unique,
  recovery_rotated_at timestamptz,
  legacy_auth_user_id uuid references auth.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists found_aura_campaign_participant_legacy_campaign_idx
  on public.found_aura_campaign_participants (legacy_auth_user_id, campaign)
  where legacy_auth_user_id is not null;

create table if not exists public.found_aura_participant_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.found_aura_campaign_participants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists found_aura_participant_sessions_participant_idx
  on public.found_aura_participant_sessions (participant_id);

create table if not exists public.found_aura_campaign_collections (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.found_aura_campaign_participants(id) on delete cascade,
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  collection_date date not null,
  collected_at timestamptz not null default now(),
  check (
    (campaign = 'november-2026-beta' and collection_date in (date '2026-11-13', date '2026-11-14'))
    or
    (campaign = 'december-2026' and collection_date between date '2026-12-01' and date '2026-12-24')
  ),
  unique (participant_id, campaign, collection_date)
);

create table if not exists public.found_aura_request_limits (
  rate_key text not null,
  action text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (rate_key, action, bucket_start)
);

alter table public.found_aura_campaign_participants enable row level security;
alter table public.found_aura_participant_sessions enable row level security;
alter table public.found_aura_campaign_collections enable row level security;
alter table public.found_aura_request_limits enable row level security;

revoke all on public.found_aura_campaign_participants from public, anon, authenticated;
revoke all on public.found_aura_participant_sessions from public, anon, authenticated;
revoke all on public.found_aura_campaign_collections from public, anon, authenticated;
revoke all on public.found_aura_request_limits from public, anon, authenticated;
revoke all on sequence public.found_aura_campaign_collections_id_seq
  from public, anon, authenticated;

grant all on public.found_aura_campaign_participants to service_role;
grant all on public.found_aura_participant_sessions to service_role;
grant all on public.found_aura_campaign_collections to service_role;
grant all on public.found_aura_request_limits to service_role;
grant usage, select on sequence public.found_aura_campaign_collections_id_seq to service_role;

create or replace function public.consume_found_aura_rate_limit(
  p_rate_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_count integer;
begin
  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  insert into public.found_aura_request_limits (rate_key, action, bucket_start, request_count)
  values (p_rate_key, p_action, v_bucket, 1)
  on conflict (rate_key, action, bucket_start)
  do update set request_count = public.found_aura_request_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_found_aura_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_found_aura_rate_limit(text, text, integer, integer)
  to service_role;

insert into public.found_aura_campaign_participants (
  id,
  campaign,
  full_name,
  contact,
  marketing_consent,
  public_code,
  legacy_auth_user_id,
  registered_at
)
select
  user_id,
  campaign,
  full_name,
  email,
  false,
  participation_code,
  user_id,
  created_at
from public.found_aura_beta_participants
on conflict do nothing;

insert into public.found_aura_campaign_collections (
  participant_id,
  campaign,
  collection_date,
  collected_at
)
select user_id, campaign, collection_date, collected_at
from public.found_aura_beta_collections
on conflict do nothing;

commit;
