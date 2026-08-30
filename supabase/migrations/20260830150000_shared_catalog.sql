create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.interest_categories (
  id text primary key,
  display_name text not null check (char_length(display_name) between 1 and 80),
  is_active boolean not null default true,
  sort_order smallint not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sort_order)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  provider_source_id text not null check (char_length(provider_source_id) between 1 and 255),
  handle text check (handle is null or char_length(handle) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 255),
  description text not null default '',
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'unavailable', 'deleted')),
  metadata_fetched_at timestamptz,
  metadata_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_source_id),
  check (metadata_expires_at is null or metadata_fetched_at is not null),
  check (metadata_expires_at is null or metadata_expires_at >= metadata_fetched_at)
);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  provider_media_id text not null check (char_length(provider_media_id) between 1 and 255),
  source_id uuid not null references public.sources(id) on update restrict on delete restrict,
  title text not null check (char_length(title) between 1 and 500),
  description text not null default '',
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  published_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  is_livestream boolean not null default false,
  is_upcoming_premiere boolean not null default false,
  status text not null default 'active' check (status in ('active', 'unavailable', 'deleted')),
  metadata_fetched_at timestamptz,
  metadata_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_media_id),
  unique (id, source_id),
  check (not (is_livestream and is_upcoming_premiere)),
  check (metadata_expires_at is null or metadata_fetched_at is not null),
  check (metadata_expires_at is null or metadata_expires_at >= metadata_fetched_at)
);

create table if not exists public.source_interests (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on update restrict on delete restrict,
  interest_id text not null references public.interest_categories(id) on update restrict on delete restrict,
  is_active boolean not null default true,
  provenance text check (provenance is null or provenance in ('editorial', 'automated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, interest_id)
);

create table if not exists public.weekly_pick_sets (
  id uuid primary key default gen_random_uuid(),
  interest_id text not null references public.interest_categories(id) on update restrict on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'expired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interest_id, period_start, period_end),
  check (period_end >= period_start),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table if not exists public.weekly_pick_items (
  id uuid primary key default gen_random_uuid(),
  pick_set_id uuid not null references public.weekly_pick_sets(id) on update restrict on delete restrict,
  source_id uuid not null references public.sources(id) on update restrict on delete restrict,
  featured_media_item_id uuid,
  display_order smallint not null check (display_order between 1 and 3),
  public_reason text check (public_reason is null or char_length(public_reason) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pick_set_id, display_order),
  foreign key (featured_media_item_id, source_id)
    references public.media_items(id, source_id) on update restrict on delete restrict
);

create index if not exists sources_status_expiry_idx
  on public.sources (status, metadata_expires_at);
create index if not exists media_items_source_publication_idx
  on public.media_items (source_id, published_at desc);
create index if not exists media_items_status_expiry_idx
  on public.media_items (status, metadata_expires_at);
create index if not exists source_interests_interest_active_idx
  on public.source_interests (interest_id, is_active);
create index if not exists weekly_pick_sets_current_idx
  on public.weekly_pick_sets (interest_id, status, period_start, period_end);
create index if not exists weekly_pick_items_set_order_idx
  on public.weekly_pick_items (pick_set_id, display_order);

insert into public.interest_categories (id, display_name, sort_order)
values
  ('tech', 'Technology', 1),
  ('science', 'Science', 2),
  ('design', 'Design', 3),
  ('music', 'Music', 4),
  ('film', 'Film', 5),
  ('photography', 'Photography', 6),
  ('architecture', 'Architecture', 7),
  ('history', 'History', 8),
  ('philosophy', 'Philosophy', 9),
  ('literature', 'Literature', 10),
  ('art', 'Fine Art', 11),
  ('cooking', 'Cooking', 12),
  ('nature', 'Nature', 13),
  ('travel', 'Travel', 14),
  ('craft', 'Craft', 15),
  ('writing', 'Writing', 16),
  ('interviews', 'Interviews', 17),
  ('essays', 'Essays', 18)
on conflict (id) do nothing;

create or replace trigger interest_categories_set_updated_at before update on public.interest_categories
for each row execute function public.set_updated_at();
create or replace trigger sources_set_updated_at before update on public.sources
for each row execute function public.set_updated_at();
create or replace trigger media_items_set_updated_at before update on public.media_items
for each row execute function public.set_updated_at();
create or replace trigger source_interests_set_updated_at before update on public.source_interests
for each row execute function public.set_updated_at();
create or replace trigger weekly_pick_sets_set_updated_at before update on public.weekly_pick_sets
for each row execute function public.set_updated_at();
create or replace trigger weekly_pick_items_set_updated_at before update on public.weekly_pick_items
for each row execute function public.set_updated_at();

alter table public.interest_categories enable row level security;
alter table public.interest_categories force row level security;
alter table public.sources enable row level security;
alter table public.sources force row level security;
alter table public.media_items enable row level security;
alter table public.media_items force row level security;
alter table public.source_interests enable row level security;
alter table public.source_interests force row level security;
alter table public.weekly_pick_sets enable row level security;
alter table public.weekly_pick_sets force row level security;
alter table public.weekly_pick_items enable row level security;
alter table public.weekly_pick_items force row level security;

revoke all privileges on table public.interest_categories from anon, authenticated;
revoke all privileges on table public.sources from anon, authenticated;
revoke all privileges on table public.media_items from anon, authenticated;
revoke all privileges on table public.source_interests from anon, authenticated;
revoke all privileges on table public.weekly_pick_sets from anon, authenticated;
revoke all privileges on table public.weekly_pick_items from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
