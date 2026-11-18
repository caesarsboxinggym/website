-- Lets an admin record a payment against the day it was actually taken,
-- for typing up a backlog. Coaches' payments are always stamped "now".
--
-- The old six-argument version is dropped so there is only one
-- record_payment; Supabase will flag that as destructive, which is expected.

begin;

drop function if exists record_payment(uuid, pass_kind, payment_method, uuid, text, text);

create or replace function record_payment(
  p_member_id  uuid,
  p_kind       pass_kind,
  p_method     payment_method,
  p_booking_id uuid default null,
  p_sumup_ref  text default null,
  p_note       text default null,
  p_taken_on   date default null
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_amount    integer;
  v_basis     date;
  v_band      member_band;
  v_start     date;
  v_end       date;
  v_payment   uuid;
  v_eligible  member_band[];
  v_taken_at  timestamptz := now();
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  -- A backdated payment: admins only, never in the future. Stamped at midday
  -- UK time so it lands on the right day in the takings and the export.
  if p_taken_on is not null and p_taken_on <> (now() at time zone 'Europe/London')::date then
    if not is_admin() then
      raise exception 'Only an admin can change the date a payment was taken';
    end if;
    if p_taken_on > (now() at time zone 'Europe/London')::date then
      raise exception 'A payment cannot be dated in the future';
    end if;
    v_taken_at := (p_taken_on + time '12:00') at time zone 'Europe/London';
  end if;

  -- Anchor the period on the session being paid for, falling back to today
  -- for someone paying up front at the door.
  select s.session_date into v_basis
  from bookings b join sessions s on s.id = b.session_id
  where b.id = p_booking_id;

  v_basis := coalesce(v_basis, current_date);

  select member_band_on(m.date_of_birth, m.band_override, v_basis)
    into v_band
  from members m where m.id = p_member_id;

  if v_band is null then
    raise exception 'Unknown member %', p_member_id;
  end if;

  select pp.eligible_bands into v_eligible
  from pass_products pp where pp.kind = p_kind and pp.active;

  if v_eligible is null then
    raise exception 'Pass type % is not available', p_kind;
  end if;

  if not (v_band = any (v_eligible)) then
    raise exception '% is not offered to %', p_kind, v_band;
  end if;

  if p_kind = 'single' then
    if p_booking_id is null then
      raise exception 'A single-session payment needs a booking';
    end if;
    select b.price_pence into v_amount from bookings b where b.id = p_booking_id;
  else
    select pp.price_pence into v_amount
    from pass_products pp where pp.kind = p_kind;

    if p_kind = 'week' then
      -- date_trunc('week') is Monday-based, which matches the club's rule.
      v_start := date_trunc('week', v_basis::timestamp)::date;
      v_end   := v_start + 6;
    else
      v_start := date_trunc('month', v_basis::timestamp)::date;
      v_end   := (v_start + interval '1 month')::date - 1;
    end if;
  end if;

  if v_amount is null then
    raise exception 'No price configured for %', p_kind;
  end if;

  insert into payments (member_id, amount_pence, method, sumup_ref, note, taken_by, taken_at)
  values (p_member_id, v_amount, p_method, p_sumup_ref, p_note, auth.uid(), v_taken_at)
  returning id into v_payment;

  insert into passes (member_id, payment_id, kind, booking_id, period_start, period_end)
  values (p_member_id, v_payment, p_kind, p_booking_id, v_start, v_end);

  return v_payment;
end;
$$;

revoke execute on function record_payment(uuid, pass_kind, payment_method, uuid, text, text, date) from anon;
grant execute on function record_payment(uuid, pass_kind, payment_method, uuid, text, text, date) to authenticated;

commit;
