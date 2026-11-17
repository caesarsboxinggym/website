-- =====================================================================
-- Caesar's Boxing Gym — full schema, applied in one transaction.
--
-- All three migrations concatenated. If ANY statement fails, the whole
-- thing rolls back and your database is untouched, so this is safe to
-- paste and re-paste.
--
-- Paste into: Supabase dashboard -> SQL Editor -> New query -> Run
--
-- Afterwards, run bootstrap_admin.sql or you will be locked out: every
-- policy tests is_staff()/is_admin(), and profiles starts empty.
-- =====================================================================

begin;

-- ###########  migrations/0001_init.sql  ###########

-- =====================================================================
-- Caesar's Boxing Gym — initial schema
--
-- Design decisions this encodes, from the scoping conversation:
--
--   1. Paid / unpaid is NEVER stored. It is derived from passes, so a
--      week pass bought on Thursday retroactively settles Monday.
--   2. The session rate follows the MEMBER, not the class. Kids £3,
--      everyone else £5. Circuit training is £5 because an adult is in it.
--   3. A week pass covers the calendar week it was bought in (Mon-Sun),
--      not the next seven days. Same idea for the month.
--   4. Coaches can see attendance and paid/unpaid. They cannot read the
--      payments table at all — they record money through an RPC.
--   5. All money in integer pence. No floats anywhere near currency.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- STAFF
-- =====================================================================

create type staff_role as enum ('coach', 'admin');

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       staff_role not null default 'coach',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table profiles is
  'Staff accounts. Created by an admin — there is no public sign-up.';

-- These are security definer so that policies ON profiles can call them
-- without recursing through that table's own RLS.
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
  );
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role = 'admin'
  );
$$;

-- =====================================================================
-- PRICING
-- =====================================================================

create type member_band as enum ('kid', 'teen', 'adult');

-- The poster's three lines: kids £3 a session, teenagers/adults £5,
-- ladies £5. Ladies is not a separate rate — it is the adult rate.
create table session_rates (
  band        member_band primary key,
  price_pence integer not null check (price_pence >= 0)
);

insert into session_rates (band, price_pence) values
  ('kid',   300),
  ('teen',  500),
  ('adult', 500);

create type pass_kind as enum ('single', 'week', 'month');

create table pass_products (
  kind                  pass_kind primary key,
  label                 text not null,
  -- null for 'single': that price comes from session_rates
  price_pence           integer check (price_pence >= 0),
  -- OPEN QUESTION: the timetable lists "£10 for the week" under
  -- Teenagers/Adults only. Kids train twice a week at £3, so a £10 week
  -- pass would cost a parent more. Drop 'kid' from this array to enforce.
  eligible_bands        member_band[] not null default '{kid,teen,adult}',
  -- OPEN QUESTION: does the week pass cover Wednesday circuits and the
  -- ladies bootcamp, or boxing only? null = every class.
  covers_class_type_ids uuid[],
  active                boolean not null default true
);

insert into pass_products (kind, label, price_pence, eligible_bands) values
  ('single', 'Single session', null,  '{kid,teen,adult}'),
  ('week',   'Week pass',      1000, '{kid,teen,adult}'),
  ('month',  'Month pass',     4000, '{kid,teen,adult}');

-- =====================================================================
-- CLASSES AND SCHEDULE
-- =====================================================================

create table class_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  min_age     integer,
  max_age     integer,
  sort        integer not null default 0,
  active      boolean not null default true
);

-- The recurring weekly pattern. Static for now, so this is effectively
-- configuration — there is no schedule-builder UI in v1.
create table schedule_slots (
  id            uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references class_types (id) on delete cascade,
  weekday       smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  starts        time not null,
  ends          time not null,
  coach_id      uuid references profiles (id) on delete set null,
  active        boolean not null default true,
  check (ends > starts)
);

create type session_status as enum ('scheduled', 'cancelled');

-- Concrete dated instances, generated from the slots above. Bookings hang
-- off these, so they have to be real rows rather than computed on the fly.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid references schedule_slots (id) on delete set null,
  class_type_id uuid not null references class_types (id) on delete restrict,
  session_date  date not null,
  starts        time not null,
  ends          time not null,
  coach_id      uuid references profiles (id) on delete set null,
  status        session_status not null default 'scheduled',
  cancel_reason text,
  unique (slot_id, session_date)
);

create index sessions_date_idx on sessions (session_date);

-- =====================================================================
-- MEMBERS
-- =====================================================================

create table members (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text not null,
  last_name                text,
  phone                    text,
  -- Optional by design. Blank means chased in person, as the club does now.
  email                    text,
  address                  text,

  -- Drives the price, so it is not really optional in practice: without it
  -- the system cannot tell a coach what to charge.
  date_of_birth            date,
  -- Escape hatch for anyone whose rate should not follow their age.
  band_override            member_band,

  health_notes             text,

  next_of_kin_name         text,
  next_of_kin_phone        text,
  next_of_kin_relationship text,

  -- Under-18s only. Kids Boxing is 6-12 and Teenagers 13-16, so this is
  -- most of two classes.
  guardian_name            text,
  guardian_phone           text,
  guardian_relationship    text,
  consent_at               timestamptz,
  consent_by               text,

  -- The club posts to Instagram and Facebook, so this needs asking.
  media_consent            boolean not null default false,
  media_consent_at         timestamptz,

  archived                 boolean not null default false,
  created_at               timestamptz not null default now(),
  created_by               uuid references profiles (id) on delete set null
);

create index members_name_idx on members (last_name, first_name);

-- A member's band on a given date. Age matters, so a kid who turns 13
-- mid-season moves to the teen rate from that date forward — and historical
-- bookings keep the rate they were charged (see bookings.price_pence).
create or replace function member_band_on(
  p_dob      date,
  p_override member_band,
  p_on       date
) returns member_band
  language sql stable as $$
  select coalesce(
    p_override,
    case
      when p_dob is null then 'adult'::member_band
      when extract(year from age(p_on::timestamp, p_dob::timestamp)) < 13 then 'kid'::member_band
      when extract(year from age(p_on::timestamp, p_dob::timestamp)) <= 16 then 'teen'::member_band
      else 'adult'::member_band
    end
  );
$$;

-- =====================================================================
-- BOOKINGS
-- =====================================================================

create type booking_status as enum ('booked', 'attended', 'no_show', 'cancelled');

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions (id) on delete cascade,
  member_id    uuid not null references members (id) on delete restrict,
  status       booking_status not null default 'booked',
  -- Snapshot of what this attendance costs, taken when the booking is made.
  -- Without this, a rate change or a birthday would silently rewrite
  -- historical balances.
  price_pence  integer not null check (price_pence >= 0),
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles (id) on delete set null,
  unique (session_id, member_id)
);

create index bookings_member_idx on bookings (member_id);

-- =====================================================================
-- MONEY
-- =====================================================================

create type payment_method as enum ('cash', 'card');

-- Money actually received. Card payments are taken on the SumUp reader
-- first and recorded here afterwards; nothing reconciles the two
-- automatically, which is why taken_by and taken_at matter.
create table payments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members (id) on delete restrict,
  amount_pence integer not null check (amount_pence > 0),
  method       payment_method not null,
  -- Optional. Lets an admin tie a card line back to SumUp in a dispute.
  sumup_ref    text,
  note         text,
  taken_by     uuid not null references profiles (id) on delete restrict,
  taken_at     timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references profiles (id) on delete set null
);

create index payments_member_idx on payments (member_id);
create index payments_taken_at_idx on payments (taken_at);

-- What a payment entitles the member to.
--   single       -> one specific booking
--   week / month -> a date range, covering every session inside it
--
-- This is the table that makes "£10 on Thursday settles Monday" work.
create table passes (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members (id) on delete restrict,
  payment_id   uuid not null references payments (id) on delete cascade,
  kind         pass_kind not null,
  booking_id   uuid references bookings (id) on delete cascade,
  period_start date,
  period_end   date,
  created_at   timestamptz not null default now(),
  check (
    (kind = 'single'
      and booking_id is not null
      and period_start is null and period_end is null)
    or
    (kind <> 'single'
      and booking_id is null
      and period_start is not null and period_end is not null
      and period_end >= period_start)
  )
);

create index passes_member_period_idx on passes (member_id, period_start, period_end);

-- =====================================================================
-- DERIVED STATUS
--
-- Security definer so a coach can see whether a booking is settled
-- without being granted any read access to payments or passes.
-- =====================================================================

create or replace function booking_is_covered(p_booking_id uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select
    -- a single-session pass pointed straight at this booking
    exists (
      select 1
      from passes p
      join payments pay on pay.id = p.payment_id and pay.voided_at is null
      where p.kind = 'single' and p.booking_id = p_booking_id
    )
    or
    -- a period pass whose range contains this session's date
    exists (
      select 1
      from bookings b
      join sessions s      on s.id = b.session_id
      join passes p        on p.member_id = b.member_id and p.kind <> 'single'
      join payments pay    on pay.id = p.payment_id and pay.voided_at is null
      join pass_products pp on pp.kind = p.kind
      where b.id = p_booking_id
        and s.session_date between p.period_start and p.period_end
        and (
          pp.covers_class_type_ids is null
          or s.class_type_id = any (pp.covers_class_type_ids)
        )
    );
$$;

-- Coach-facing roll call. Deliberately carries NO money columns.
-- Runs with owner rights and guards on is_staff(), so coaches never need
-- read access to the underlying tables.
create or replace view roll_call as
select
  b.id            as booking_id,
  s.id            as session_id,
  s.session_date,
  s.starts,
  s.ends,
  s.status        as session_status,
  ct.name         as class_name,
  m.id            as member_id,
  m.first_name,
  m.last_name,
  member_band_on(m.date_of_birth, m.band_override, s.session_date) as band,
  (m.email is not null and m.email <> '') as has_email,
  (m.consent_at is not null)              as consent_on_file,
  b.status        as booking_status,
  booking_is_covered(b.id) as paid
from bookings b
join sessions s     on s.id = b.session_id
join members m      on m.id = b.member_id
join class_types ct on ct.id = s.class_type_id
where is_staff();

-- Admin-only. The end-of-week chase list.
create or replace view outstanding_balances as
select
  m.id                       as member_id,
  m.first_name,
  m.last_name,
  m.phone,
  m.email,
  (m.email is not null and m.email <> '') as has_email,
  count(*)                   as unpaid_sessions,
  sum(b.price_pence)         as owed_pence,
  min(s.session_date)        as oldest_unpaid,
  max(s.session_date)        as newest_unpaid
from bookings b
join sessions s on s.id = b.session_id
join members m  on m.id = b.member_id
where is_admin()
  and b.status <> 'cancelled'
  and s.status <> 'cancelled'
  and not booking_is_covered(b.id)
group by m.id, m.first_name, m.last_name, m.phone, m.email;

-- Admin-only. The cash/card split to eyeball against SumUp's weekly total.
create or replace view takings_by_day as
select
  date_trunc('day', p.taken_at)::date as day,
  p.method,
  count(*)           as payments,
  sum(p.amount_pence) as total_pence
from payments p
where is_admin() and p.voided_at is null
group by 1, 2;

-- =====================================================================
-- RECORDING A PAYMENT
--
-- The only way a coach puts money in. Computes the amount itself rather
-- than trusting a number from the client, and derives the period from the
-- club's rule: whatever calendar week or month the session falls in.
-- =====================================================================

create or replace function record_payment(
  p_member_id  uuid,
  p_kind       pass_kind,
  p_method     payment_method,
  p_booking_id uuid default null,
  p_sumup_ref  text default null,
  p_note       text default null
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
begin
  if not is_staff() then
    raise exception 'Not authorised';
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

  insert into payments (member_id, amount_pence, method, sumup_ref, note, taken_by)
  values (p_member_id, v_amount, p_method, p_sumup_ref, p_note, auth.uid())
  returning id into v_payment;

  insert into passes (member_id, payment_id, kind, booking_id, period_start, period_end)
  values (p_member_id, v_payment, p_kind, p_booking_id, v_start, v_end);

  return v_payment;
end;
$$;

-- =====================================================================
-- GENERATING SESSIONS FROM THE WEEKLY PATTERN
-- =====================================================================

create or replace function generate_sessions(p_from date, p_to date)
  returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
begin
  if not is_admin() then
    raise exception 'Not authorised';
  end if;

  insert into sessions (slot_id, class_type_id, session_date, starts, ends, coach_id)
  select sl.id, sl.class_type_id, d::date, sl.starts, sl.ends, sl.coach_id
  from schedule_slots sl
  cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  where sl.active
    and extract(isodow from d) = sl.weekday
  on conflict (slot_id, session_date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =====================================================================
-- GOOGLE REVIEWS
--
-- Pasted in by hand: the Places API caps at five reviews and the club has
-- seven. Admin-editable so new ones do not need a redeploy.
-- =====================================================================

create table google_reviews (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null,
  rating       smallint not null check (rating between 1 and 5),
  body         text,
  reviewed_on  date,
  sort         integer not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
--
-- Every table. The publishable key is only safe because of what follows.
-- =====================================================================

alter table profiles        enable row level security;
alter table session_rates   enable row level security;
alter table pass_products   enable row level security;
alter table class_types     enable row level security;
alter table schedule_slots  enable row level security;
alter table sessions        enable row level security;
alter table members         enable row level security;
alter table bookings        enable row level security;
alter table payments        enable row level security;
alter table passes          enable row level security;
alter table google_reviews  enable row level security;

-- profiles: see yourself; admins see and manage everyone
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles
  for all using (is_admin()) with check (is_admin());

-- reference data: staff read, admin writes
create policy rates_read on session_rates
  for select using (is_staff());
create policy rates_write on session_rates
  for all using (is_admin()) with check (is_admin());

create policy pass_products_read on pass_products
  for select using (is_staff());
create policy pass_products_write on pass_products
  for all using (is_admin()) with check (is_admin());

-- class types are on the public website, so anyone may read them
create policy class_types_public_read on class_types
  for select using (true);
create policy class_types_write on class_types
  for all using (is_admin()) with check (is_admin());

create policy slots_public_read on schedule_slots
  for select using (true);
create policy slots_write on schedule_slots
  for all using (is_admin()) with check (is_admin());

create policy sessions_read on sessions
  for select using (is_staff());
create policy sessions_write on sessions
  for all using (is_admin()) with check (is_admin());

-- members: any active staff member. Holds emergency contacts and guardian
-- details, so it is staff-only — never public, never anon.
create policy members_staff_read on members
  for select using (is_staff());
create policy members_staff_insert on members
  for insert with check (is_staff());
create policy members_staff_update on members
  for update using (is_staff()) with check (is_staff());
create policy members_admin_delete on members
  for delete using (is_admin());

-- bookings: staff take the roll call
create policy bookings_staff_read on bookings
  for select using (is_staff());
create policy bookings_staff_insert on bookings
  for insert with check (is_staff());
create policy bookings_staff_update on bookings
  for update using (is_staff()) with check (is_staff());
create policy bookings_admin_delete on bookings
  for delete using (is_admin());

-- payments and passes: ADMIN SELECT ONLY.
-- Coaches have no policy here at all, so a coach session reading this table
-- gets zero rows even if the frontend asks. They write via record_payment().
create policy payments_admin_read on payments
  for select using (is_admin());
create policy payments_admin_write on payments
  for all using (is_admin()) with check (is_admin());

create policy passes_admin_read on passes
  for select using (is_admin());
create policy passes_admin_write on passes
  for all using (is_admin()) with check (is_admin());

-- reviews: public website reads the visible ones
create policy reviews_public_read on google_reviews
  for select using (visible);
create policy reviews_admin_write on google_reviews
  for all using (is_admin()) with check (is_admin());

-- Views run with owner rights and guard internally on is_staff() /
-- is_admin(), so expose them to logged-in users only.
revoke all on roll_call, outstanding_balances, takings_by_day from anon;
grant select on roll_call, outstanding_balances, takings_by_day to authenticated;

-- Only the RPCs are callable by staff; nothing else needs execute.
revoke execute on function record_payment(uuid, pass_kind, payment_method, uuid, text, text) from anon;
revoke execute on function generate_sessions(date, date) from anon;


-- ###########  migrations/0002_seed.sql  ###########

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


-- ###########  migrations/0003_registration.sql  ###########

-- =====================================================================
-- Caesar's Boxing Gym — public registration submissions
--
-- The registration form is a public link, so it needs to write to the
-- database without an account. It must NOT write to members directly:
-- that table holds emergency contacts and guardian details for children,
-- and anonymous insert access to it would be a bad idea however carefully
-- the policies were written.
--
-- So public submissions land in their own table. A coach reviews each one
-- and promotes it into members. Anonymous callers can insert and can read
-- nothing back.
-- =====================================================================

create type submission_status as enum ('new', 'accepted', 'rejected');

create table registration_submissions (
  id                       uuid primary key default gen_random_uuid(),

  first_name               text not null,
  last_name                text,
  phone                    text,
  email                    text,
  address                  text,
  date_of_birth            date,

  health_notes             text,

  next_of_kin_name         text,
  next_of_kin_phone        text,
  next_of_kin_relationship text,

  guardian_name            text,
  guardian_phone           text,
  guardian_relationship    text,
  consent_given            boolean not null default false,
  media_consent            boolean not null default false,

  status                   submission_status not null default 'new',
  member_id                uuid references members (id) on delete set null,
  reviewed_by              uuid references profiles (id) on delete set null,
  reviewed_at              timestamptz,

  submitted_at             timestamptz not null default now(),
  -- Populated server-side only. Anything a browser sends here is unverified,
  -- so treat it as a hint when reviewing spam, never as evidence. Real rate
  -- limiting belongs at the edge, not in this table.
  submitted_ip             inet
);

create index registration_submissions_status_idx
  on registration_submissions (status, submitted_at);

alter table registration_submissions enable row level security;

-- Anyone may submit. Note there is no select policy for anon, so a
-- submitter cannot read back their own row or anybody else's.
create policy registration_public_insert on registration_submissions
  for insert to anon, authenticated
  with check (
    status = 'new'
    and member_id is null
    and reviewed_by is null
    and reviewed_at is null
    and length(first_name) between 1 and 100
    and (last_name is null or length(last_name) <= 100)
    and (email is null or length(email) <= 200)
    and (phone is null or length(phone) <= 40)
    and (health_notes is null or length(health_notes) <= 2000)
    -- nobody predates the modern era or is born tomorrow
    and (date_of_birth is null
         or (date_of_birth > '1920-01-01' and date_of_birth <= current_date))
  );

create policy registration_staff_read on registration_submissions
  for select using (is_staff());

create policy registration_staff_update on registration_submissions
  for update using (is_staff()) with check (is_staff());

create policy registration_admin_delete on registration_submissions
  for delete using (is_admin());

-- =====================================================================
-- Promote a submission into a real member record.
--
-- Copies the fields across and stamps the consent with the time it is
-- accepted. Under-18s must have a guardian name and consent ticked —
-- enforced here rather than trusted from the form.
-- =====================================================================

create or replace function accept_registration(p_submission_id uuid)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  s registration_submissions;
  v_member uuid;
  v_is_minor boolean;
begin
  if not is_staff() then
    raise exception 'Not authorised';
  end if;

  select * into s from registration_submissions where id = p_submission_id;

  if s.id is null then
    raise exception 'No such submission';
  end if;

  if s.status <> 'new' then
    raise exception 'That submission has already been reviewed';
  end if;

  v_is_minor := s.date_of_birth is not null
                and s.date_of_birth > (current_date - interval '18 years');

  if v_is_minor and (s.guardian_name is null or not s.consent_given) then
    raise exception 'Under 18s need a guardian name and consent before they can be added';
  end if;

  insert into members (
    first_name, last_name, phone, email, address, date_of_birth,
    health_notes,
    next_of_kin_name, next_of_kin_phone, next_of_kin_relationship,
    guardian_name, guardian_phone, guardian_relationship,
    consent_at, consent_by,
    media_consent, media_consent_at,
    created_by
  ) values (
    s.first_name, s.last_name, s.phone, s.email, s.address, s.date_of_birth,
    s.health_notes,
    s.next_of_kin_name, s.next_of_kin_phone, s.next_of_kin_relationship,
    s.guardian_name, s.guardian_phone, s.guardian_relationship,
    case when s.consent_given then now() end,
    case when s.consent_given then coalesce(s.guardian_name, s.first_name) end,
    s.media_consent,
    case when s.media_consent then now() end,
    auth.uid()
  ) returning id into v_member;

  update registration_submissions
  set status = 'accepted', member_id = v_member,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_submission_id;

  return v_member;
end;
$$;

revoke execute on function accept_registration(uuid) from anon;

commit;
