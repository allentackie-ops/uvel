create table if not exists public.friend_listing_views (
  viewer_uid text not null,
  listing_id text not null,
  view_count integer not null default 0,
  last_viewed_at timestamptz not null default now(),
  primary key (viewer_uid, listing_id),
  constraint friend_listing_views_viewer_uid_length check (char_length(viewer_uid) between 1 and 160),
  constraint friend_listing_views_listing_id_length check (char_length(listing_id) between 1 and 200),
  constraint friend_listing_views_count_nonnegative check (view_count >= 0)
);

create index if not exists friend_listing_views_viewer_recent_idx
  on public.friend_listing_views (viewer_uid, last_viewed_at desc);

alter table public.friend_listing_views enable row level security;
