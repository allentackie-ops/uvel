alter table public.listing_photos
  drop constraint if exists listing_photos_capture_source_check;

alter table public.listing_photos
  add constraint listing_photos_capture_source_check
  check (capture_source = any (array['camera'::text, 'legacy_import'::text, 'synthetic_demo'::text]));
