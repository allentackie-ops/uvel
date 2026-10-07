alter table public.listings
  add column if not exists processing_status text not null default 'idle',
  add column if not exists processing_message text,
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists background_map jsonb not null default '{}'::jsonb,
  add column if not exists ai_suggestions jsonb not null default '{}'::jsonb,
  add column if not exists owner_firebase_uid text;

alter table public.listing_photos
  add column if not exists background_key text,
  add column if not exists render_storage_path text,
  add column if not exists render_url text;

alter table public.profiles
  add column if not exists expo_push_token text;

alter table public.listings
  drop constraint if exists listings_processing_status_check;

alter table public.listings
  add constraint listings_processing_status_check
  check (processing_status = any (array['idle'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'failed'::text]));

create index if not exists listings_owner_processing_idx
  on public.listings(owner_id, processing_status, updated_at desc);

create index if not exists listings_processing_queue_idx
  on public.listings(processing_status, updated_at asc)
  where processing_status in ('queued', 'processing');

create index if not exists listings_owner_firebase_uid_idx
  on public.listings(owner_firebase_uid, updated_at desc);

create or replace function public.assign_listing_draft_uuid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.legacy_firebase_id is not null
     and new.legacy_firebase_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    new.id := new.legacy_firebase_id::uuid;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_assign_draft_uuid on public.listings;

create trigger listings_assign_draft_uuid
before insert on public.listings
for each row execute function public.assign_listing_draft_uuid();
