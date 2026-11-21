begin;

-- 1. Extend participants table with status, normalized_contact, and merged_into_id
alter table public.found_aura_campaign_participants
  add column if not exists status text not null default 'active'
    check (status in ('active', 'merged', 'suspended')),
  add column if not exists normalized_contact text,
  add column if not exists merged_into_id uuid
    references public.found_aura_campaign_participants(id) on delete set null;

-- Backfill normalized_contact for existing participants without modifying raw contact
update public.found_aura_campaign_participants
set normalized_contact = lower(trim(contact))
where contact is not null and normalized_contact is null;

-- Indexes for campaign-scoped non-blocking lookups
create index if not exists found_aura_participants_campaign_normalized_contact_idx
  on public.found_aura_campaign_participants (campaign, normalized_contact)
  where normalized_contact is not null;

create index if not exists found_aura_participants_status_idx
  on public.found_aura_campaign_participants (status);

-- 2. Assisted Recovery Requests table
create table if not exists public.found_aura_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  contact text not null check (char_length(contact) between 3 and 254),
  normalized_contact text not null,
  explanation text check (explanation is null or char_length(explanation) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  matched_participant_id uuid references public.found_aura_campaign_participants(id) on delete set null,
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  replacement_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists found_aura_recovery_requests_campaign_status_idx
  on public.found_aura_recovery_requests (campaign, status, created_at desc);

-- 3. Controlled Participant Merge Backups table
create table if not exists public.found_aura_participant_merge_backups (
  id uuid primary key default gen_random_uuid(),
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  target_participant_id uuid not null references public.found_aura_campaign_participants(id) on delete cascade,
  source_participant_id uuid not null,
  retained_public_code text not null,
  retired_public_code text not null,
  target_snapshot jsonb not null,
  source_snapshot jsonb not null,
  source_collections_snapshot jsonb not null,
  overlapping_days text[] not null default '{}',
  merged_days text[] not null default '{}',
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_notes text not null,
  merged_at timestamptz not null default now()
);

create index if not exists found_aura_merge_backups_campaign_idx
  on public.found_aura_participant_merge_backups (campaign, merged_at desc);

-- 4. Audit Log table for administrative operations
create table if not exists public.found_aura_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_id text,
  campaign text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists found_aura_audit_logs_action_idx
  on public.found_aura_audit_logs (action, created_at desc);

-- RLS policies: Service role only
alter table public.found_aura_recovery_requests enable row level security;
alter table public.found_aura_participant_merge_backups enable row level security;
alter table public.found_aura_audit_logs enable row level security;

revoke all on public.found_aura_recovery_requests from public, anon, authenticated;
revoke all on public.found_aura_participant_merge_backups from public, anon, authenticated;
revoke all on public.found_aura_audit_logs from public, anon, authenticated;

grant all on public.found_aura_recovery_requests to service_role;
grant all on public.found_aura_participant_merge_backups to service_role;
grant all on public.found_aura_audit_logs to service_role;

commit;
