-- =====================================================================
-- Timetable editor
--
-- An admin edits the weekly pattern in the staff area and saves it in one
-- go. save_timetable() takes the whole week as it should now look, updates
-- schedule_slots (which the website's timetable reads), and brings the
-- dated sessions from a chosen day onward into line (which the booking
-- page and the roll call read).
--
-- What happens to sessions already generated:
--   * a class that only changes time or places   -> its sessions change in
--     place, and anyone already booked moves with it
--   * a class that is removed, or moves to another day or becomes a
--     different class -> its sessions are taken off, EXCEPT any that
--     already have people booked or waiting. Those are left exactly as
--     they were, for a coach to deal with by hand.
--   * a new class, or a new day -> sessions are created for it
-- Sessions in the past are never touched.
-- =====================================================================

begin;

-- ---------- taking a slot's future sessions off ----------

create or replace function timetable_retire_slot(
  p_slot_id uuid,
  p_from    date,
  out removed integer,
  out kept    integer
)
  language plpgsql security definer set search_path = public as $$
declare
  v_n integer;
begin
  removed := 0;
  kept := 0;

  -- People are booked or waiting: leave the session alone, just cut its
  -- tie to the weekly pattern.
  update sessions s
  set slot_id = null
  where s.slot_id = p_slot_id
    and s.session_date >= p_from
    and s.status = 'scheduled'
    and (
      exists (select 1 from bookings b
              where b.session_id = s.id and b.status <> 'cancelled')
      or exists (select 1 from booking_requests r
                 where r.session_id = s.id and r.status = 'new')
    );
  get diagnostics kept = row_count;

  -- Nothing has ever hung off it: delete it outright.
  delete from sessions s
  where s.slot_id = p_slot_id
    and s.session_date >= p_from
    and not exists (select 1 from bookings b where b.session_id = s.id)
    and not exists (select 1 from booking_requests r where r.session_id = s.id);
  get diagnostics v_n = row_count;
  removed := removed + v_n;

  -- It has history (a cancelled booking, an old request): keep the record
  -- but mark the session cancelled.
  update sessions s
  set slot_id = null,
      status = 'cancelled',
      cancel_reason = coalesce(s.cancel_reason, 'Timetable changed')
  where s.slot_id = p_slot_id
    and s.session_date >= p_from;
  get diagnostics v_n = row_count;
  removed := removed + v_n;
end;
$$;

revoke execute on function timetable_retire_slot(uuid, date) from public, anon, authenticated;

-- ---------- saving the week ----------
--
-- p_slots is the whole week: a JSON array of
--   { "id": uuid or null, "class_type_id": uuid, "weekday": 1-7,
--     "starts": "18:00", "ends": "19:30", "capacity": 25 }
-- A slot that is on the timetable now but missing from the array is removed.
create or replace function save_timetable(
  p_slots jsonb,
  p_from  date default current_date
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_from     date := greatest(coalesce(p_from, current_date), current_date);
  v_to       date;
  e          jsonb;
  cur        schedule_slots%rowtype;
  v_id       uuid;
  v_class    uuid;
  v_weekday  integer;
  v_starts   time;
  v_ends     time;
  v_capacity integer;
  v_keep     uuid[] := '{}';
  v_removed  integer := 0;
  v_kept     integer := 0;
  v_changed  integer := 0;
  v_added    integer := 0;
  v_n        integer;
  r          record;
begin
  if not is_admin() then
    raise exception 'Only an admin can change the timetable';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'The timetable was not sent in the right shape';
  end if;

  -- Sessions are kept generated as far ahead as they already are, and at
  -- least eight weeks past the day the change starts.
  select greatest(coalesce(max(session_date), current_date), v_from + 56)
    into v_to
  from sessions;

  for e in select * from jsonb_array_elements(p_slots) loop
    v_id       := nullif(e->>'id', '')::uuid;
    v_class    := (e->>'class_type_id')::uuid;
    v_weekday  := (e->>'weekday')::integer;
    v_starts   := (e->>'starts')::time;
    v_ends     := (e->>'ends')::time;
    v_capacity := coalesce((e->>'capacity')::integer, 25);

    if not exists (select 1 from class_types ct where ct.id = v_class and ct.active) then
      raise exception 'One of the classes on the timetable no longer exists';
    end if;
    if v_weekday is null or v_weekday not between 1 and 7 then
      raise exception 'A session has no day set';
    end if;
    if v_starts is null or v_ends is null or v_ends <= v_starts then
      raise exception 'A session has to finish after it starts';
    end if;
    if v_capacity not between 1 and 500 then
      raise exception 'Places has to be between 1 and 500';
    end if;

    if v_id is not null then
      select * into cur from schedule_slots where id = v_id;
      if not found then
        raise exception 'The timetable changed while you were editing. Reload the page and try again.';
      end if;

      if cur.weekday <> v_weekday or cur.class_type_id <> v_class then
        -- A different day or a different class: the old sessions go, new
        -- ones are generated below.
        select t.removed, t.kept into r from timetable_retire_slot(v_id, v_from) t;
        v_removed := v_removed + r.removed;
        v_kept    := v_kept + r.kept;
      elsif cur.starts <> v_starts or cur.ends <> v_ends or cur.capacity <> v_capacity then
        update sessions s
        set starts = v_starts, ends = v_ends, capacity = v_capacity
        where s.slot_id = v_id
          and s.session_date >= v_from
          and s.status = 'scheduled';
        get diagnostics v_n = row_count;
        v_changed := v_changed + v_n;
      end if;

      update schedule_slots
      set class_type_id = v_class,
          weekday  = v_weekday,
          starts   = v_starts,
          ends     = v_ends,
          capacity = v_capacity,
          active   = true
      where id = v_id;
    else
      insert into schedule_slots (class_type_id, weekday, starts, ends, capacity)
      values (v_class, v_weekday, v_starts, v_ends, v_capacity)
      returning id into v_id;
    end if;

    v_keep := v_keep || v_id;
  end loop;

  -- Anything on the timetable now that was not sent back has been removed.
  for cur in
    select * from schedule_slots sl
    where sl.active and not (sl.id = any (v_keep))
  loop
    select t.removed, t.kept into r from timetable_retire_slot(cur.id, v_from) t;
    v_removed := v_removed + r.removed;
    v_kept    := v_kept + r.kept;
    update schedule_slots set active = false where id = cur.id;
  end loop;

  -- Fill in whatever is now missing.
  insert into sessions (slot_id, class_type_id, session_date, starts, ends, coach_id, capacity)
  select sl.id, sl.class_type_id, d::date, sl.starts, sl.ends, sl.coach_id, sl.capacity
  from schedule_slots sl
  cross join generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') as d
  where sl.active
    and extract(isodow from d) = sl.weekday
  on conflict (slot_id, session_date) do nothing;
  get diagnostics v_added = row_count;

  return jsonb_build_object(
    'added',   v_added,
    'removed', v_removed,
    'changed', v_changed,
    'kept',    v_kept,
    'from',    v_from,
    'to',      v_to
  );
end;
$$;

revoke execute on function save_timetable(jsonb, date) from public, anon;
grant execute on function save_timetable(jsonb, date) to authenticated;

commit;
