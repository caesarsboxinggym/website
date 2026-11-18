-- =====================================================================
-- 0006 — age groups, and approving a booking request for someone new
--
-- 1. Kids and adults train separately. Anyone 12 or under on the day of
--    the session can only be booked into a kids class, and anyone 13 or
--    over cannot be booked into one. "Kids class" means a class type whose
--    max_age is 12 or under — today that is Kids Boxing. Teenagers are not
--    treated separately yet.
--
-- 2. Approving a booking request no longer needs the person to be a member
--    already. With no member picked, the request's own details become a new
--    member and they are booked into the session they asked for, in one go.
--
-- Safe to run more than once.
-- =====================================================================

begin;

-- ---------- the rule, in one place ----------
--
-- True when somebody born on p_dob may train in that session. An unknown
-- date of birth passes: staff can still book in a member whose date of
-- birth was never recorded, and the Members tab flags those.
create or replace function age_fits_session(p_dob date, p_session_id uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select case
    when p_dob is null then true
    else (extract(year from age(s.session_date::timestamp, p_dob::timestamp)) < 13)
         = (ct.max_age is not null and ct.max_age < 13)
  end
  from sessions s
  join class_types ct on ct.id = s.class_type_id
  where s.id = p_session_id;
$$;

grant execute on function age_fits_session(date, uuid) to anon, authenticated;

-- ---------- requests from the website ----------
--
-- Date of birth is now required, and has to suit the session asked for.
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
    -- cannot request a place on a session that is already full
    and exists (
      select 1 from session_availability sa
      where sa.id = session_id and sa.places_left > 0
    )
  );

-- ---------- booking a member in ----------
--
-- Same as before, plus the age check. Everything that books anyone goes
-- through here: the roll call, the quick add at the door, and approvals.
create or replace function book_member(
  p_session_id uuid,
  p_member_id  uuid
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_date  date;
  v_dob   date;
  v_band  member_band;
  v_price integer;
  v_id    uuid;
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  select s.session_date into v_date
  from sessions s
  where s.id = p_session_id and s.status <> 'cancelled';

  if v_date is null then
    raise exception 'That session does not exist or has been cancelled';
  end if;

  select m.date_of_birth,
         member_band_on(m.date_of_birth, m.band_override, v_date)
    into v_dob, v_band
  from members m
  where m.id = p_member_id and not m.archived;

  if v_band is null then
    raise exception 'That member does not exist';
  end if;

  if not age_fits_session(v_dob, p_session_id) then
    if extract(year from age(v_date::timestamp, v_dob::timestamp)) < 13 then
      raise exception 'They are 12 or under, so they can only be booked into a kids class';
    else
      raise exception 'That is a kids class, for ages 12 and under only';
    end if;
  end if;

  select r.price_pence into v_price
  from session_rates r where r.band = v_band;

  if v_price is null then
    raise exception 'No rate configured for %', v_band;
  end if;

  -- Re-booking somebody who was cancelled just puts them back in, at the
  -- rate that applies now.
  insert into bookings (session_id, member_id, price_pence, created_by)
  values (p_session_id, p_member_id, v_price, auth.uid())
  on conflict (session_id, member_id) do update
    set status = 'booked', price_pence = excluded.price_pence
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function book_member(uuid, uuid) from anon;

-- ---------- approval ----------
--
-- p_member_id is now optional. Left out, the person who asked is added to
-- the members list from the details on their request, then booked in.
create or replace function accept_booking_request(
  p_request_id uuid,
  p_member_id  uuid default null
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  r          booking_requests;
  v_capacity integer;
  v_taken    integer;
  v_member   uuid;
  v_booking  uuid;
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  select * into r from booking_requests where id = p_request_id;

  if r.id is null then
    raise exception 'No such request';
  end if;

  if r.status <> 'new' then
    raise exception 'That request has already been reviewed';
  end if;

  -- Lock the session row so concurrent approvals serialise against it.
  select s.capacity into v_capacity
  from sessions s
  where s.id = r.session_id and s.status <> 'cancelled'
  for update;

  if v_capacity is null then
    raise exception 'That session no longer exists or has been cancelled';
  end if;

  select count(*) into v_taken
  from bookings b
  where b.session_id = r.session_id and b.status <> 'cancelled';

  if v_taken >= v_capacity then
    raise exception 'That session is full (% of %)', v_taken, v_capacity;
  end if;

  v_member := p_member_id;

  if v_member is null then
    -- Date of birth decides the rate and the age group, so a new member
    -- cannot be made without one.
    if r.date_of_birth is null then
      raise exception 'This request has no date of birth, so pick an existing member or add them on the Members tab first';
    end if;

    insert into members (first_name, last_name, phone, email, date_of_birth, created_by)
    values (r.first_name, r.last_name, r.phone, r.email, r.date_of_birth, auth.uid())
    returning id into v_member;
  end if;

  -- Raises if the member is the wrong age for the class, which also undoes
  -- the new member row above.
  v_booking := book_member(r.session_id, v_member);

  update booking_requests
  set status = 'accepted',
      member_id = v_member,
      booking_id = v_booking,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  return v_booking;
end;
$$;

revoke execute on function accept_booking_request(uuid, uuid) from anon;

commit;
