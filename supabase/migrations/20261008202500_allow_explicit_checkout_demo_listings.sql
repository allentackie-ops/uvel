create or replace function public.enforce_minimum_camera_photos()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.source = 'supabase'
    and new.status in ('seller_confirmed', 'listed')
    and not (
      coalesce(new.ai_analysis->>'demo', 'false') = 'true'
      and coalesce(new.ai_analysis->>'purpose', '') = 'checkout_testing'
    )
    and (
      select count(*)
      from public.listing_photos p
      where p.listing_id = new.id
        and p.capture_source = 'camera'
    ) < 3
  then
    raise exception 'Normal listings require at least three in-person camera photos';
  end if;
  return new;
end;
$function$;
