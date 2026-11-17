-- =====================================================================
-- Caesar's Boxing Gym — self-service booking, with approval
--
-- Members ask for a place from the public site; a coach or admin approves.
-- Requests land in their own table rather than in bookings, for the same
-- reason registrations do: anonymous writes must never touch a table that
-- money and member records hang off.
--
-- Capacity is 25 a session by default. Places left counts confirmed
-- bookings AND requests still waiting, so the number the public sees is
-- honest — otherwise 40 people could request 25 places.
-- =====================================================================

begin;

-- ---------- capacity ----------

alter table schedule_slots add column capacity integer not null default 25
  check (capacity > 0);
alter table sessions       add column capacity integer not null default 25
  check (capacity > 0);

comment on column sessions.capacity is
  'Snapshotted from the slot when the session is generated, so changing the
   weekly pattern does not rewrite the capacity of sessions already run.';

-- ---------- requests ----------

create type request_status as enum ('new', 'accepted', 'rejected');

create table booking_requests (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions (id) on delete cascade,

  first_name    text not null,
  last_name     text,
  -- Required: it is how a coach recognises them and how they get called if
  -- the session is full or cancelled.
  phone         text not null,
  email         text,
  -- Only needed for someone not yet on the system; it decides their rate.
  date_of_birth date,
  note          text,

  status        request_status not null default 'new',
  member_id     uuid references members (id) on delete set null,
  booking_id    uuid references bookings (id) on delete set null,
  reviewed_by   uuid references profiles (id) on delete set null,
  reviewed_at   timestamptz,

  requested_at  timestamptz not null default now(),
  submitted_ip  inet
);

create index booking_requests_status_idx on booking_requests (status, requested_at);
create index booking_requests_session_idx on booking_requests (session_id);

-- Stops the same phone number requesting the same session twice while one
-- is still waiting. Digits only, so spacing does not defeat it.
create unique index booking_requests_no_dupes
  on booking_requests (session_id, regexp_replace(phone, '\D', '', 'g'))
  where status = 'new';

-- ---------- what the public may see ----------
--
-- Counts only. No names, no contact details, nothing about who is booked.
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
  greatest(s.capacity - coalesce(b.taken, 0) - coalesce(r.pending, 0), 0) as places_left
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

-- ---------- approval ----------
--
-- Ties the request to a member and books them in. Capacity is enforced
-- here, not in the browser, so two coaches approving at once cannot
-- overfill a session.

create or replace function accept_booking_request(
  p_request_id uuid,
  p_member_id  uuid
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  r          booking_requests;
  v_capacity integer;
  v_taken    integer;
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

  v_booking := book_member(r.session_id, p_member_id);

  update booking_requests
  set status = 'accepted',
      member_id = p_member_id,
      booking_id = v_booking,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;

  return v_booking;
end;
$$;

revoke execute on function accept_booking_request(uuid, uuid) from anon;

create or replace function reject_booking_request(
  p_request_id uuid
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  update booking_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id and status = 'new';
end;
$$;

revoke execute on function reject_booking_request(uuid) from anon;

-- ---------- row level security ----------

alter table booking_requests enable row level security;

-- Anyone may ask for a place. No select policy for anon, so a requester
-- cannot read back the queue or anybody else's details.
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
    and (date_of_birth is null
         or (date_of_birth > '1920-01-01' and date_of_birth <= current_date))
    -- cannot request a place on a session that is already full
    and exists (
      select 1 from session_availability sa
      where sa.id = session_id and sa.places_left > 0
    )
  );

create policy booking_requests_staff_read on booking_requests
  for select using (is_staff());

create policy booking_requests_staff_update on booking_requests
  for update using (is_staff()) with check (is_staff());

create policy booking_requests_admin_delete on booking_requests
  for delete using (is_admin());

-- ---------- regenerate sessions carrying capacity ----------

create or replace function generate_sessions(p_from date, p_to date)
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
begin
  if not is_admin() then
    raise exception 'Not authorised';
  end if;

  insert into sessions (slot_id, class_type_id, session_date, starts, ends, coach_id, capacity)
  select sl.id, sl.class_type_id, d::date, sl.starts, sl.ends, sl.coach_id, sl.capacity
  from schedule_slots sl
  cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  where sl.active
    and extract(isodow from d) = sl.weekday
  on conflict (slot_id, session_date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

commit;
