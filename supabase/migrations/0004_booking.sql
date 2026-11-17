-- =====================================================================
-- Caesar's Boxing Gym — booking a member into a session
--
-- The price snapshot on a booking has to be computed where the pricing rule
-- lives, not in the browser. A coach's phone should never be trusted to
-- decide what something costs.
-- =====================================================================

begin;

create or replace function book_member(
  p_session_id uuid,
  p_member_id  uuid
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_date  date;
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

  select member_band_on(m.date_of_birth, m.band_override, v_date)
    into v_band
  from members m
  where m.id = p_member_id and not m.archived;

  if v_band is null then
    raise exception 'That member does not exist';
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

-- ---------------------------------------------------------------------
-- Mark attendance / remove somebody from a session.
-- ---------------------------------------------------------------------

create or replace function set_booking_status(
  p_booking_id uuid,
  p_status     booking_status
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  update bookings set status = p_status where id = p_booking_id;
end;
$$;

revoke execute on function set_booking_status(uuid, booking_status) from anon;

-- ---------------------------------------------------------------------
-- What one session costs a given member, for the payment sheet.
--
-- Published prices, so coaches may see this — it is the aggregate takings
-- they are kept away from, not the price list.
-- ---------------------------------------------------------------------

create or replace function booking_price(p_booking_id uuid)
  returns integer
  language sql stable security definer set search_path = public as $$
  select b.price_pence from bookings b where b.id = p_booking_id;
$$;

commit;
