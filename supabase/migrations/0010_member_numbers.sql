-- =====================================================================
-- Member numbers
--
-- Every member gets a random four-digit number (1000-9999). It goes in
-- their welcome email, and on the booking page they can type it instead
-- of filling the form in again.
--
-- A four-digit number can be guessed, so it is treated as a convenience
-- and not a password:
--   * nothing about the member is ever sent back to the public page
--     except whether they train with the kids or the adults
--   * a booking made with a number is still only a request, and a coach
--     still approves it
-- =====================================================================

begin;

-- ---------- the number ----------

alter table members add column if not exists member_no integer;

create or replace function new_member_no() returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_no integer;
begin
  for i in 1..200 loop
    v_no := 1000 + floor(random() * 9000)::integer;
    if not exists (select 1 from members where member_no = v_no) then
      return v_no;
    end if;
  end loop;
  raise exception 'Could not find a free member number';
end;
$$;

revoke execute on function new_member_no() from anon, authenticated;

create or replace function members_set_no() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.member_no is null then
    new.member_no := new_member_no();
  end if;
  return new;
end;
$$;

drop trigger if exists members_set_no on members;
create trigger members_set_no
  before insert on members
  for each row execute function members_set_no();

-- Everyone already on the system gets one too.
do $$
declare
  r record;
begin
  for r in select id from members where member_no is null loop
    update members set member_no = new_member_no() where id = r.id;
  end loop;
end;
$$;

alter table members alter column member_no set not null;

alter table members drop constraint if exists members_member_no_key;
alter table members add constraint members_member_no_key unique (member_no);

alter table members drop constraint if exists members_member_no_range;
alter table members add constraint members_member_no_range
  check (member_no between 1000 and 9999);

-- ---------- what the booking page may ask ----------
--
-- "Is this number a kid or an adult?" — so the page can show the right
-- classes. Returns null for a number that is not in use. No name, nothing
-- else.
create or replace function member_group(p_member_no integer) returns text
  language sql stable security definer set search_path = public as $$
  select case
    when extract(year from age(current_date::timestamp, m.date_of_birth::timestamp)) < 13
      then 'kid'
    else 'adult'
  end
  from members m
  where m.member_no = p_member_no and not m.archived;
$$;

grant execute on function member_group(integer) to anon, authenticated;

-- ---------- asking for a place with a number ----------
--
-- Makes the same kind of request the public form makes, with the member's
-- own details filled in and the request already tied to them, so a coach
-- only has to approve it. Returns a short code the page turns into words:
--   ok | not_found | gone | invite | full | age | already
create or replace function request_place_by_number(
  p_session_id uuid,
  p_member_no  integer
) returns text
  language plpgsql security definer set search_path = public as $$
declare
  m  members%rowtype;
  sa record;
begin
  select * into m from members
  where member_no = p_member_no and not archived;

  if not found then
    return 'not_found';
  end if;

  select a.session_date, a.places_left, a.invite_only into sa
  from session_availability a
  where a.id = p_session_id;

  if not found or sa.session_date < current_date then
    return 'gone';
  end if;

  if sa.invite_only then
    return 'invite';
  end if;

  if not age_fits_session(m.date_of_birth, p_session_id) then
    return 'age';
  end if;

  if exists (
       select 1 from bookings b
       where b.session_id = p_session_id and b.member_id = m.id and b.status <> 'cancelled'
     )
     or exists (
       select 1 from booking_requests r
       where r.session_id = p_session_id and r.member_id = m.id and r.status = 'new'
     ) then
    return 'already';
  end if;

  if sa.places_left <= 0 then
    return 'full';
  end if;

  insert into booking_requests
    (session_id, first_name, last_name, phone, email, date_of_birth, note, member_id)
  values
    (p_session_id, m.first_name, m.last_name,
     coalesce(nullif(trim(m.phone), ''), 'member ' || m.member_no),
     m.email, m.date_of_birth,
     'Asked for with member number ' || m.member_no, m.id);

  return 'ok';
exception
  when unique_violation then
    return 'already';
end;
$$;

grant execute on function request_place_by_number(uuid, integer) to anon, authenticated;

-- ---------- brothers and sisters ----------
--
-- The "no double requests" rule used to look at the phone number alone,
-- which stopped two children on one parent's phone asking for the same
-- class. It now looks at the phone number and the first name together.
drop index if exists booking_requests_no_dupes;
create unique index booking_requests_no_dupes
  on booking_requests (session_id, regexp_replace(phone, '\D', '', 'g'), lower(trim(first_name)))
  where status = 'new';

commit;
