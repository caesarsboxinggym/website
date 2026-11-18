-- =====================================================================
-- 0007 — invite-only classes
--
-- Fighters Boxing is by invitation. It stays on the timetable and on the
-- booking page so people can see it runs, but nobody can ask for a place
-- from the website. A coach puts a fighter into a session from the roll
-- call, exactly as they add anyone else — that is the invitation.
--
-- To make another class invite-only later (or open one back up):
--   update class_types set invite_only = true where slug = 'fighters-teenagers';
--
-- Safe to run more than once.
-- =====================================================================

begin;

alter table class_types
  add column if not exists invite_only boolean not null default false;

update class_types set invite_only = true where slug = 'fighters-boxing';

-- ---------- what the public may see ----------
--
-- Same view as before with invite_only added on the end, so the booking
-- page can show the session without offering it.
create or replace view session_availability as
select
  s.id,
  s.session_date,
  s.starts,
  s.ends,
  s.capacity,
  ct.name    as class_name,
  ct.slug    as class_slug,
  ct.min_age,
  ct.max_age,
  coalesce(b.taken, 0)   as taken,
  coalesce(r.pending, 0) as pending,
  greatest(s.capacity - coalesce(b.taken, 0) - coalesce(r.pending, 0), 0) as places_left,
  ct.invite_only
from sessions s
join class_types ct on ct.id = s.class_type_id
left join (
  select session_id, count(*) as taken
  from bookings where status <> 'cancelled'
  group by session_id
) b on b.session_id = s.id
left join (
  select session_id, count(*) as pending
  from booking_requests where status = 'new'
  group by session_id
) r on r.session_id = s.id
where s.status <> 'cancelled';

grant select on session_availability to anon, authenticated;

-- ---------- requests from the website ----------
--
-- As in 0006, and now refused for an invite-only session as well.
drop policy if exists booking_requests_public_insert on booking_requests;

create policy booking_requests_public_insert on booking_requests
  for insert to anon, authenticated
  with check (
    status = 'new'
    and member_id is null
    and booking_id is null
    and reviewed_by is null
    and reviewed_at is null
    and length(first_name) between 1 and 100
    and (last_name is null or length(last_name) <= 100)
    and length(phone) between 6 and 40
    and (email is null or length(email) <= 200)
    and (note is null or length(note) <= 500)
    and date_of_birth is not null
    and date_of_birth > '1920-01-01'
    and date_of_birth <= current_date
    and age_fits_session(date_of_birth, session_id)
    -- must have room, and must not be an invite-only class
    and exists (
      select 1 from session_availability sa
      where sa.id = session_id and sa.places_left > 0 and not sa.invite_only
    )
  );

commit;
