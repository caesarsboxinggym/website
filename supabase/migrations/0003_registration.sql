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

begin;

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
