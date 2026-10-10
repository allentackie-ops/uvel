alter table public.listings
  add column if not exists original_price_cents integer,
  add column if not exists previous_price_cents integer;

comment on column public.listings.original_price_cents is
  'Seller-provided or previously listed comparison price, in cents; null when the listing is not discounted.';

comment on column public.listings.previous_price_cents is
  'Temporary prior active price captured while a listing edit is reviewed; cleared when the edited listing is published.';
