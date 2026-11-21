begin;

create table if not exists public.found_aura_campaign_draw_settings (
  campaign text primary key check (campaign in ('november-2026-beta', 'december-2026')),
  minimum_score integer check (minimum_score is null or minimum_score >= 0),
  facebook_submission_deadline timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.found_aura_campaign_draw_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  minimum_score integer not null check (minimum_score >= 0),
  threshold integer check (threshold is null or threshold >= 0),
  status text not null check (status in ('NO_ELIGIBLE_PARTICIPANTS', 'FINALIZED')),
  eligible_participants jsonb not null default '[]'::jsonb,
  recalculation_of uuid references public.found_aura_campaign_draw_snapshots(id) on delete set null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists found_aura_draw_snapshots_campaign_idx
  on public.found_aura_campaign_draw_snapshots (campaign, created_at desc);

create table if not exists public.found_aura_facebook_draw_entries (
  id uuid primary key default gen_random_uuid(),
  campaign text not null check (campaign in ('november-2026-beta', 'december-2026')),
  participant_id uuid not null references public.found_aura_campaign_participants(id) on delete cascade,
  public_code text not null,
  comment_reference text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign, participant_id)
);

alter table public.found_aura_campaign_draw_settings enable row level security;
alter table public.found_aura_campaign_draw_snapshots enable row level security;
alter table public.found_aura_facebook_draw_entries enable row level security;

revoke all on public.found_aura_campaign_draw_settings from public, anon, authenticated;
revoke all on public.found_aura_campaign_draw_snapshots from public, anon, authenticated;
revoke all on public.found_aura_facebook_draw_entries from public, anon, authenticated;

grant all on public.found_aura_campaign_draw_settings to service_role;
grant all on public.found_aura_campaign_draw_snapshots to service_role;
grant all on public.found_aura_facebook_draw_entries to service_role;

-- Intentionally do not insert a December minimum score or Facebook deadline:
-- those are organizer-controlled decisions that must be published before launch.

commit;
