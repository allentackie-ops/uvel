create table if not exists public.marketplace_conversations (
  id text primary key,
  piece_id text not null,
  buyer_uid text not null,
  seller_uid text not null,
  piece_name text not null default '',
  piece_photo text not null default '',
  piece_price_cents integer not null default 0,
  seller_name text not null default '',
  buyer_name text not null default '',
  buyer_photo text,
  buyer_username text,
  brand_id text,
  brand_name text,
  brand_logo text,
  brand_verified boolean not null default false,
  recipient_ids text[] not null default '{}',
  order_id text,
  support_case_id text,
  last_text text not null default '',
  last_at timestamptz not null default timezone('utc', now()),
  last_from text not null default '',
  unread_buyer integer not null default 0,
  unread_seller integer not null default 0,
  typing_by text not null default '',
  typing_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.marketplace_conversations(id) on delete cascade,
  text text not null default '',
  from_uid text not null,
  kind text not null default 'text',
  photo_url text,
  offer_cents integer,
  offer_id text,
  offer_status text,
  offer_expires_at timestamptz,
  checkout_expires_at timestamptz,
  response_message text,
  from_name text,
  from_username text,
  from_photo text,
  status text not null default 'sent',
  created_at timestamptz not null default timezone('utc', now()),
  constraint marketplace_messages_has_content check (length(trim(text)) > 0 or nullif(trim(coalesce(photo_url, '')), '') is not null)
);

create table if not exists public.marketplace_chat_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  reporter_uid text not null,
  reason text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists marketplace_conversations_buyer_idx on public.marketplace_conversations (buyer_uid, updated_at desc);
create index if not exists marketplace_conversations_seller_idx on public.marketplace_conversations (seller_uid, updated_at desc);
create index if not exists marketplace_conversations_recipients_idx on public.marketplace_conversations using gin (recipient_ids);
create index if not exists marketplace_messages_conversation_idx on public.marketplace_messages (conversation_id, created_at asc);
create index if not exists marketplace_chat_reports_conversation_idx on public.marketplace_chat_reports (conversation_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('message-media', 'message-media', false, 8388608)
on conflict (id) do nothing;

alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;
alter table public.marketplace_chat_reports enable row level security;
