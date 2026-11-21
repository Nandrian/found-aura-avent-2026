-- Found Aura live beta, 13–14 November 2026. This campaign is deliberately
-- isolated from the December Secret Wardrobe data model.
create table if not exists public.found_aura_beta_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  campaign text not null default 'november-2026-beta'
    check (campaign = 'november-2026-beta'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  participation_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.found_aura_beta_collections (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.found_aura_beta_participants(user_id) on delete cascade,
  campaign text not null default 'november-2026-beta'
    check (campaign = 'november-2026-beta'),
  collection_date date not null
    check (collection_date in (date '2026-11-13', date '2026-11-14')),
  collected_at timestamptz not null default now(),
  unique (user_id, campaign, collection_date)
);

create table if not exists public.found_aura_beta_tickets (
  user_id uuid primary key references public.found_aura_beta_participants(user_id) on delete cascade,
  campaign text not null default 'november-2026-beta'
    check (campaign = 'november-2026-beta'),
  ticket_code text not null unique,
  issued_at timestamptz not null default now()
);

alter table public.found_aura_beta_participants enable row level security;
alter table public.found_aura_beta_collections enable row level security;
alter table public.found_aura_beta_tickets enable row level security;

drop policy if exists "Participants can read their beta identity" on public.found_aura_beta_participants;
create policy "Participants can read their beta identity"
  on public.found_aura_beta_participants for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Participants can read their beta collections" on public.found_aura_beta_collections;
create policy "Participants can read their beta collections"
  on public.found_aura_beta_collections for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Participants can read their final beta ticket" on public.found_aura_beta_tickets;
create policy "Participants can read their final beta ticket"
  on public.found_aura_beta_tickets for select to authenticated
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

revoke all on public.found_aura_beta_participants from anon;
revoke all on public.found_aura_beta_collections from anon;
revoke all on public.found_aura_beta_tickets from anon;
grant select on public.found_aura_beta_participants to authenticated;
grant select on public.found_aura_beta_collections to authenticated;
grant select on public.found_aura_beta_tickets to authenticated;
grant all on public.found_aura_beta_participants to service_role;
grant all on public.found_aura_beta_collections to service_role;
grant all on public.found_aura_beta_tickets to service_role;
grant usage, select on sequence public.found_aura_beta_collections_id_seq to service_role;
