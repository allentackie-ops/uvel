create table if not exists public.style_dna_profiles (
  firebase_uid text primary key,
  archetype text not null default '',
  palette text not null default '',
  silhouette text not null default '',
  styles jsonb not null default '[]'::jsonb,
  source text not null default 'uvel_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists style_dna_profiles_updated_at_idx
  on public.style_dna_profiles (updated_at desc);

alter table public.style_dna_profiles enable row level security;

comment on table public.style_dna_profiles is 'Supabase source of truth for the user Style DNA used by Uvel recommendations.';
