create table if not exists public.user_notification_preferences (
  firebase_uid text primary key,
  enabled boolean not null,
  expo_push_token text,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;
revoke all on table public.user_notification_preferences from anon, authenticated;
grant all on table public.user_notification_preferences to service_role;
