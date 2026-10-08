create table if not exists public.promotions (
  id text primary key,
  brand_id text,
  listing_id text,
  owner_firebase_uid text,
  code text not null,
  kind text not null check (kind in ('percentage', 'fixed')),
  value numeric(12, 2) not null check (value > 0),
  currency text,
  minimum_order_cents integer not null default 0 check (minimum_order_cents >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'paused', 'ended')),
  start_at timestamptz,
  end_at timestamptz,
  created_by_uid text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (brand_id is not null or listing_id is not null),
  check (end_at is null or start_at is null or end_at > start_at)
);

create unique index if not exists promotions_code_unique_idx on public.promotions (lower(code));
create index if not exists promotions_brand_idx on public.promotions (brand_id, status, updated_at desc);
create index if not exists promotions_listing_idx on public.promotions (listing_id, status, updated_at desc);
create index if not exists promotions_owner_idx on public.promotions (owner_firebase_uid, updated_at desc);

alter table public.promotions enable row level security;

create or replace function public.redeem_promotion(p_promotion_id text, p_uid text)
returns public.promotions
language plpgsql
security definer
set search_path = public
as $$
declare result public.promotions;
begin
  update public.promotions
  set usage_count = usage_count + 1,
      updated_at = timezone('utc', now())
  where id = p_promotion_id
    and status = 'live'
    and (start_at is null or start_at <= timezone('utc', now()))
    and (end_at is null or end_at >= timezone('utc', now()))
    and (usage_limit is null or usage_count < usage_limit)
  returning * into result;
  if result.id is null then
    raise exception 'Promotion is no longer available';
  end if;
  return result;
end;
$$;

revoke all on function public.redeem_promotion(text, text) from public, anon, authenticated;
