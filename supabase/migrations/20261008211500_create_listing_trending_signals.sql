create table if not exists public.listing_trending_events (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  market_code text not null check (market_code ~ '^[A-Z]{2}$'),
  event_type text not null check (event_type in ('qualified_view', 'share', 'copy_link')),
  actor_hash text not null check (length(actor_hash) = 64),
  event_key text not null unique,
  dwell_seconds smallint,
  created_at timestamptz not null default now(),
  constraint listing_trending_event_payload_check check (
    (event_type = 'qualified_view' and dwell_seconds between 10 and 300)
    or (event_type in ('share', 'copy_link') and dwell_seconds is null)
  )
);

create index if not exists listing_trending_events_market_created_idx
  on public.listing_trending_events (market_code, created_at desc);
create index if not exists listing_trending_events_listing_created_idx
  on public.listing_trending_events (listing_id, created_at desc);

alter table public.listing_trending_events enable row level security;
revoke all on table public.listing_trending_events from public, anon, authenticated;

create table if not exists public.brand_catalog_items (
  id text primary key,
  brand_id text not null,
  brand_name text not null,
  owner_firebase_uid text not null,
  listed_by_uid text not null,
  status text not null check (status in ('owned', 'draft', 'review_pending', 'listed', 'sold', 'archived', 'rejected')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  ships_to jsonb not null default '[]'::jsonb,
  category text not null,
  photo_paths text[] not null default array[]::text[],
  piece jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_catalog_photo_count_check check (cardinality(photo_paths) between 1 and 6)
);

create index if not exists brand_catalog_items_public_market_idx
  on public.brand_catalog_items (status, country, updated_at desc);
create index if not exists brand_catalog_items_brand_idx
  on public.brand_catalog_items (brand_id, status);

alter table public.brand_catalog_items enable row level security;
revoke all on table public.brand_catalog_items from public, anon, authenticated;

drop function if exists public.get_listing_trend_scores(text, integer);
create function public.get_listing_trend_scores(
  p_market_code text default null,
  p_days integer default 7
)
returns table (
  listing_id text,
  market_code text,
  trend_score bigint,
  qualified_views bigint,
  shares bigint,
  copied_links bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.listing_id,
    e.market_code,
    sum(case e.event_type when 'qualified_view' then 1 when 'share' then 5 when 'copy_link' then 4 else 0 end)::bigint as trend_score,
    count(*) filter (where e.event_type = 'qualified_view')::bigint as qualified_views,
    count(*) filter (where e.event_type = 'share')::bigint as shares,
    count(*) filter (where e.event_type = 'copy_link')::bigint as copied_links
  from public.listing_trending_events e
  where e.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 30)))
    and (p_market_code is null or e.market_code = upper(p_market_code))
  group by e.listing_id, e.market_code
  order by 3 desc, e.listing_id
  limit 5000;
$$;

revoke all on function public.get_listing_trend_scores(text, integer) from public, anon, authenticated;
grant execute on function public.get_listing_trend_scores(text, integer) to service_role;
