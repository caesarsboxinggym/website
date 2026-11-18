-- Teenagers are a next-year feature. This takes the "Fighters & Teenagers"
-- class off the website, the timetable and the booking page without
-- deleting anything, so it can be switched back on later.
--
-- To bring it back:
--   update class_types    set active = true where slug = 'fighters-teenagers';
--   update schedule_slots set active = true
--     where class_type_id = (select id from class_types where slug = 'fighters-teenagers');
--   then press "Generate the next 8 weeks" in the staff area.

update class_types set active = false where slug = 'fighters-teenagers';

update schedule_slots set active = false
where class_type_id = (select id from class_types where slug = 'fighters-teenagers');

-- Sessions already generated for it, from today on.
update sessions
set status = 'cancelled', cancel_reason = 'Teenagers class paused until next year'
where class_type_id = (select id from class_types where slug = 'fighters-teenagers')
  and session_date >= current_date
  and status = 'scheduled';
