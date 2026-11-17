-- =====================================================================
-- Caesar's Boxing Gym — seed data
--
-- The timetable is transcribed from the club's current poster. It is static
-- for now, so this file is effectively configuration rather than test data.
--
-- Coach names are still unknown, so every slot's coach_id is left null.
-- One name did surface in a Google review — "Coach Paddy" — but which
-- sessions he takes has not been confirmed, so it is not seeded here.
-- =====================================================================

-- ---------- classes ----------

begin;

insert into class_types (name, slug, description, min_age, max_age, sort) values
  ('Kids Boxing',
   'kids-boxing',
   'Footwork, technique and fitness in a group, no contact. Tuesday and Thursday, straight after school.',
   6, 12, 10),

  ('Fighters & Teenagers',
   'fighters-teenagers',
   'Teenagers training alongside the fighters. Proper boxing, coached carefully, guardian consent on registration.',
   13, null, 20),

  ('Fighters Boxing',
   'fighters-boxing',
   'For anyone competing or working towards it. Pads, sparring and conditioning.',
   null, null, 30),

  ('Adults Boxing',
   'adults-boxing',
   'The late session, open to any ability. Come for the boxing or come for the fitness — nobody has to spar.',
   17, null, 40),

  ('Circuit Training',
   'circuit-training',
   'Wednesday conditioning. Stations, timed rounds, no gloves needed.',
   null, null, 50),

  ('Ladies Bootcamp',
   'ladies-bootcamp',
   'Women only, Wednesday evenings. Boxing-based fitness with no sparring and no experience needed.',
   null, null, 60);

-- ---------- the weekly pattern ----------
-- weekday is ISO: 1 = Monday ... 7 = Sunday

insert into schedule_slots (class_type_id, weekday, starts, ends)
select ct.id, v.weekday, v.starts, v.ends
from (values
  -- Monday
  ('fighters-boxing',    1, '18:00'::time, '19:30'::time),
  ('adults-boxing',      1, '19:30',       '20:30'),
  -- Tuesday
  ('kids-boxing',        2, '17:00',       '18:00'),
  ('fighters-teenagers', 2, '18:00',       '19:30'),
  ('adults-boxing',      2, '19:30',       '20:30'),
  -- Wednesday
  ('circuit-training',   3, '18:00',       '19:00'),
  ('ladies-bootcamp',    3, '19:00',       '20:00'),
  -- Thursday
  ('kids-boxing',        4, '17:00',       '18:00'),
  ('fighters-teenagers', 4, '18:00',       '19:30'),
  ('adults-boxing',      4, '19:30',       '20:30')
) as v (slug, weekday, starts, ends)
join class_types ct on ct.slug = v.slug;

-- ---------- google reviews ----------
-- Pasted by hand from the club's listing: 5.0 from 7 reviews, all five star.
--
-- Two were truncated by Google's "…More" link and are cut at a natural
-- point — replace the body once the full text is to hand.
-- Nasreen's review opened with five star emoji, removed here because the
-- rating is rendered separately.
-- A seventh reviewer, Ella Powers, left a rating with no text, so there is
-- nothing to display. She still counts toward the 5.0 average of 7.
--
-- reviewed_on is approximate: Google shows only "3 months ago" style
-- relative dates, so these are set to the first of the implied month and
-- should be displayed as month and year only.

insert into google_reviews (author_name, rating, body, reviewed_on, sort) values
  ('AJ Frost', 5,
   'When it comes to gyms that make you feel welcome, valued, and a part of a team then look no further than Caesars. With great coaches who value everyone who walks through their doors more than the money they pay…',
   '2026-05-01', 10),

  ('Nasreen Seedat', 5,
   'Fantastic boxing gym for kids! My kids absolutely love their lessons here. The classes are fun, dynamic…',
   '2025-11-01', 20),

  ('Safwan Chowdhury', 5,
   'Great gym with even better coaches. It''s a friendly environment where everyone feels welcome. It is small however this makes you all feel apart of a team and allows more attention from the coaches',
   '2025-11-01', 30),

  ('Skdkdk Skid', 5,
   'Coach Paddy is a top G, every1 get down to learn, train and have fun with the lovely blokes and women that train there.',
   '2026-05-01', 40),

  ('Jacob', 5,
   'Great gym with solid coaches! If your looking to get fit and learn to box get yourself down 🥊',
   '2026-05-01', 50),

  ('Hehw Snm', 5,
   'Great knowledge in this boxing gym.',
   '2026-05-01', 60);

commit;
