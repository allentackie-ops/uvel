create table if not exists public.brand_listing_drafts (
  id text primary key,
  brand_id text not null,
  owner_firebase_uid text not null,
  draft jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_listing_drafts_owner_updated_idx
  on public.brand_listing_drafts(owner_firebase_uid, updated_at desc);

create index if not exists brand_listing_drafts_brand_updated_idx
  on public.brand_listing_drafts(brand_id, updated_at desc);

alter table public.brand_listing_drafts enable row level security;
-- Access is mediated by the brand-listing-drafts Edge Function, which verifies
-- the signed-in identity before using the server-side Supabase service role.
