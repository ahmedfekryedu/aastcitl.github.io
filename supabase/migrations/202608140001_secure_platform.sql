-- AAST CITL secure platform migration
-- Run this file once in Supabase SQL Editor. No CLI or Edge Function deployment is required.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Production-schema preflight (verified against the 20 current objects)
-- ---------------------------------------------------------------------------
do $preflight$
declare required_table text;
begin
  foreach required_table in array array[
    'academic_schedule','access_codes','active_tv_posters','attendance_network_ranges','exam_schedule',
    'faculty_directory','lecture_presence_logs','meetings','page_visits','profiles',
    'rooms','schedule_actions','schedule_report_batch_items','schedule_report_batches',
    'schedule_terms','settings','site_settings','tv_posters','user_presence_sessions'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Secure v3 preflight failed: missing existing table public.%', required_table;
    end if;
  end loop;
end $preflight$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer
set search_path = public
as $$
  select p from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'manager' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Durable, per-user notifications (isolated from the legacy table)
-- ---------------------------------------------------------------------------
-- Never alter, rename, index, or attach policies to public.notifications.
-- Production owns that legacy room-level table and it has no recipient_id.
-- Secure v3 uses a dedicated table so old, partial, and repeated runs are safe.
create table if not exists public.citl_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (char_length(kind) between 1 and 80),
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '' check (char_length(body) <= 1000),
  entity_type text,
  entity_id text,
  route text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  dedupe_key text
);

create unique index if not exists citl_notifications_recipient_dedupe_uq
  on public.citl_notifications(recipient_id, dedupe_key);
create index if not exists citl_notifications_recipient_created_idx
  on public.citl_notifications(recipient_id, created_at desc);

alter table public.citl_notifications enable row level security;
drop policy if exists citl_notifications_select_own on public.citl_notifications;
create policy citl_notifications_select_own on public.citl_notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists citl_notifications_update_own on public.citl_notifications;
revoke insert, delete on public.citl_notifications from anon, authenticated;
revoke update on public.citl_notifications from anon, authenticated;
grant select on public.citl_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Departments and visiting lecturers
-- ---------------------------------------------------------------------------
create table if not exists public.department_heads (
  department_key text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index if not exists academic_terms_one_active_uq
  on public.academic_terms(is_active) where is_active;

create table if not exists public.visiting_lecturers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  department_key text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists visiting_lecturers_normalized_uq
  on public.visiting_lecturers(normalized_name);
create unique index if not exists visiting_lecturers_profile_uq
  on public.visiting_lecturers(profile_id) where profile_id is not null;

-- A lecturer is a reusable identity, while the selection itself belongs to a
-- specific academic term. This lets management choose a fresh set every term
-- without deleting historical attendance or duplicating the lecturer account.
create table if not exists public.term_visiting_lecturers (
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  visiting_lecturer_id uuid not null references public.visiting_lecturers(id) on delete cascade,
  department_key text not null,
  is_active boolean not null default true,
  selected_by uuid references auth.users(id) on delete set null,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (term_id, visiting_lecturer_id)
);
create index if not exists term_visiting_lecturers_active_idx
  on public.term_visiting_lecturers(term_id, department_key, visiting_lecturer_id)
  where is_active;

-- Preserve a previous Secure v3 installation by assigning its active lecturer
-- identities to the currently active term once. Repeated runs are harmless.
do $term_visitors_backfill$
begin
  if not exists(select 1 from public.term_visiting_lecturers) then
    insert into public.term_visiting_lecturers(term_id,visiting_lecturer_id,department_key,is_active,selected_by)
    select t.id,v.id,v.department_key,true,v.created_by
    from public.academic_terms t cross join public.visiting_lecturers v
    where t.is_active and v.is_active
    on conflict (term_id,visiting_lecturer_id) do nothing;
  end if;
end $term_visitors_backfill$;

-- Add a fast, explicit flag without relying on faculty/TA labels.
alter table public.profiles add column if not exists is_visiting_lecturer boolean not null default false;
-- The current production export has no profiles.updated_at column, while the
-- protected registration trigger uses it for deterministic account updates.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  room_name text not null,
  token_hash text not null,
  token_hint text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists room_qr_active_room_uq
  on public.room_qr_tokens(term_id, room_name) where is_active;
create unique index if not exists room_qr_token_hash_uq on public.room_qr_tokens(token_hash);

create table if not exists public.visiting_lecture_sessions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  schedule_id text not null,
  visiting_lecturer_id uuid not null references public.visiting_lecturers(id) on delete cascade,
  instructor_name text not null,
  course_name text not null default '',
  room_name text not null,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  check (end_time > start_time)
);
-- Keep the timetable instructor label exactly as entered. A slash or a value
-- such as "غير محدد" is intentional data and must not be split or excluded.
alter table public.visiting_lecture_sessions
  drop constraint if exists visiting_lecture_sessions_term_id_schedule_id_key;
create unique index if not exists visiting_sessions_term_schedule_visitor_uq
  on public.visiting_lecture_sessions(term_id, schedule_id, visiting_lecturer_id);
create index if not exists visiting_sessions_lookup_idx
  on public.visiting_lecture_sessions(term_id, visiting_lecturer_id, day_of_week, start_time);

create table if not exists public.attendance_scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.visiting_lecture_sessions(id) on delete cascade,
  lecturer_profile_id uuid not null references public.profiles(id) on delete cascade,
  lecture_date date not null,
  scanned_at timestamptz not null default now(),
  room_name text not null,
  effective_instructor text,
  schedule_action_id text,
  public_ip inet,
  inside_campus boolean not null default false,
  user_agent text,
  status text not null check (status in ('present', 'rejected')),
  rejection_reason text,
  unique(session_id, lecture_date)
);
create index if not exists attendance_scans_date_idx
  on public.attendance_scans(lecture_date desc, lecturer_profile_id);
alter table public.attendance_scans add column if not exists effective_instructor text;
alter table public.attendance_scans add column if not exists schedule_action_id text;

-- Server-generated audit history for sensitive changes.
create table if not exists public.security_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS for new operational tables. All mutations go through protected SQL RPCs.
-- ---------------------------------------------------------------------------
do $policies$
declare t text;
begin
  foreach t in array array[
    'department_heads','academic_terms','visiting_lecturers','room_qr_tokens',
    'term_visiting_lecturers','visiting_lecture_sessions','attendance_scans','security_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_manager_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_manager())', t || '_manager_select', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $policies$;

drop policy if exists visiting_lecturer_self_select on public.visiting_lecturers;
create policy visiting_lecturer_self_select on public.visiting_lecturers
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists term_visiting_lecturer_self_select on public.term_visiting_lecturers;
create policy term_visiting_lecturer_self_select on public.term_visiting_lecturers
  for select to authenticated using (
    exists (select 1 from public.visiting_lecturers v
      where v.id=visiting_lecturer_id and v.profile_id=auth.uid())
  );
drop policy if exists visiting_sessions_self_select on public.visiting_lecture_sessions;
create policy visiting_sessions_self_select on public.visiting_lecture_sessions
  for select to authenticated using (
    exists (select 1 from public.visiting_lecturers v where v.id = visiting_lecturer_id and v.profile_id = auth.uid())
  );
drop policy if exists attendance_self_select on public.attendance_scans;
create policy attendance_self_select on public.attendance_scans
  for select to authenticated using (lecturer_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lock down the tables that previously exposed sensitive information.
-- Existing app writes remain possible only for authenticated users until the
-- protected SQL functions below are installed and the final policies are used.
-- ---------------------------------------------------------------------------
do $lock$
declare t text; pol record;
begin
  foreach t in array array[
    'profiles','access_codes','meetings','page_visits','user_presence_sessions',
    'presence_events','schedule_actions','schedule_terms','academic_schedule','faculty_directory','exam_schedule',
    'lecture_presence_logs','rooms','schedule_report_batches','schedule_report_batch_items',
    'settings','site_settings','smrm_reservations','tv_posters'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, t);
      end loop;
    end if;
  end loop;
end $lock$;

-- Profiles: every user can read/update only their safe own row; managers can read.
drop policy if exists profiles_authenticated_select on public.profiles;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Access codes must never be queryable from a browser.
alter table public.access_codes add column if not exists code_hash text;
alter table public.access_codes add column if not exists is_active boolean not null default true;
alter table public.access_codes add column if not exists uses_count integer not null default 0;
alter table public.access_codes add column if not exists max_uses integer;
alter table public.access_codes add column if not exists expires_at timestamptz;
alter table public.access_codes add column if not exists last_used_at timestamptz;
alter table public.access_codes add column if not exists role text not null default 'user';
alter table public.access_codes add column if not exists account_type text;
alter table public.access_codes add column if not exists department_key text;
update public.access_codes
set code_hash = encode(digest(code, 'sha256'), 'hex')
where code_hash is null and code is not null;
create index if not exists access_codes_code_hash_idx
  on public.access_codes(code_hash) where code_hash is not null;
revoke all on public.access_codes from anon, authenticated;

-- Schedule and faculty directory are read-only to signed-in users. Public TV/today
-- access should use the secure-api public-schedule action, not direct table reads.
grant select on public.academic_schedule, public.faculty_directory to authenticated;
create or replace view public.faculty_directory_public
with (security_invoker = false)
as select full_name, department_key, position, is_active from public.faculty_directory where is_active = true;
revoke all on public.faculty_directory_public from public;
grant select on public.faculty_directory_public to anon, authenticated;

-- The timetable is intentionally public on /today and /tv_display.
drop policy if exists academic_schedule_public_read on public.academic_schedule;
create policy academic_schedule_public_read on public.academic_schedule for select to anon, authenticated using (true);
grant select on public.academic_schedule to anon;

-- Prevent a normal user from promoting their own profile even though they may edit
-- their contact information. Managers may manage other rows.
create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not public.is_manager() then
    new.role := old.role;
    new.permissions := old.permissions;
    new.is_visiting_lecturer := old.is_visiting_lecturer;
    new.account_type := old.account_type;
    new.linked_instructors := old.linked_instructors;
    new.schedule_link_required := old.schedule_link_required;
    new.schedule_link_status := old.schedule_link_status;
    new.id := old.id;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields before update on public.profiles
for each row execute function public.protect_profile_security_fields();
drop policy if exists profiles_manager_update on public.profiles;
create policy profiles_manager_update on public.profiles for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
grant update on public.profiles to authenticated;

-- Meeting ownership/manager boundaries and durable notification trigger.
drop policy if exists meetings_secure_select on public.meetings;
create policy meetings_secure_select on public.meetings for select to authenticated
  using (user_id = auth.uid() or public.is_manager());
drop policy if exists meetings_secure_insert on public.meetings;
create policy meetings_secure_insert on public.meetings for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists meetings_secure_update on public.meetings;
create policy meetings_secure_update on public.meetings for update to authenticated
  using (user_id = auth.uid() or public.is_manager()) with check (user_id = auth.uid() or public.is_manager());
grant select, insert, update on public.meetings to authenticated;
drop policy if exists meetings_secure_delete on public.meetings;
create policy meetings_secure_delete on public.meetings for delete to authenticated using (public.is_manager());
grant delete on public.meetings to authenticated;

create or replace function public.protect_meeting_approval_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.user_id and not public.is_manager() then
    new.user_id := old.user_id;
    if coalesce(old.status, '') = 'confirmed'
       and coalesce(new.status, '') not in ('modification_requested','cancellation_requested') then
      raise exception 'A confirmed booking must be changed through a modification or cancellation request';
    end if;
    if new.status is distinct from old.status and coalesce(new.status, '') not in ('pending','modification_requested','cancellation_requested') then
      raise exception 'Only a manager can approve or reject a booking';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists meetings_protect_approval on public.meetings;
create trigger meetings_protect_approval before update on public.meetings
for each row execute function public.protect_meeting_approval_fields();

drop policy if exists schedule_actions_authenticated_read on public.schedule_actions;
alter table public.schedule_actions add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;
create policy schedule_actions_authenticated_read on public.schedule_actions for select to authenticated using (true);
grant select on public.schedule_actions to authenticated;

-- Presence columns existed in some deployments and were absent in others.
-- Keep their legacy-compatible text representation for public_ip, while the
-- protected runtime validates the request IP as inet before storing it.
alter table public.user_presence_sessions add column if not exists public_ip text;
alter table public.user_presence_sessions add column if not exists network_label text;
alter table public.user_presence_sessions add column if not exists inside_campus boolean not null default false;

-- Keep the existing bigint schedule_terms table intact. It remains the legacy
-- timetable-term catalogue; Secure v3 uses academic_terms (UUID + date range)
-- for QR validity without changing or deleting schedule_terms.
drop policy if exists schedule_terms_authenticated_read on public.schedule_terms;
create policy schedule_terms_authenticated_read on public.schedule_terms
  for select to authenticated using (true);
drop policy if exists schedule_terms_manager_write on public.schedule_terms;
create policy schedule_terms_manager_write on public.schedule_terms for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
grant select,insert,update,delete on public.schedule_terms to authenticated;

drop policy if exists academic_schedule_manager_write on public.academic_schedule;
create policy academic_schedule_manager_write on public.academic_schedule for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
grant insert, update, delete on public.academic_schedule to authenticated;

drop policy if exists faculty_directory_authenticated_read on public.faculty_directory;
create policy faculty_directory_authenticated_read on public.faculty_directory for select to authenticated using (true);
drop policy if exists faculty_directory_manager_write on public.faculty_directory;
create policy faculty_directory_manager_write on public.faculty_directory for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
grant select, insert, update, delete on public.faculty_directory to authenticated;

drop policy if exists page_visits_insert_only on public.page_visits;
create policy page_visits_insert_only on public.page_visits for insert to anon, authenticated with check (true);
drop policy if exists page_visits_manager_read on public.page_visits;
create policy page_visits_manager_read on public.page_visits for select to authenticated using (public.is_manager());
grant insert on public.page_visits to anon, authenticated;
grant select on public.page_visits to authenticated;

drop policy if exists exam_schedule_public_read on public.exam_schedule;
create policy exam_schedule_public_read on public.exam_schedule for select to anon, authenticated using (true);
drop policy if exists exam_schedule_manager_write on public.exam_schedule;
create policy exam_schedule_manager_write on public.exam_schedule for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select on public.exam_schedule to anon, authenticated;
grant insert, update, delete on public.exam_schedule to authenticated;

drop policy if exists rooms_authenticated_read on public.rooms;
create policy rooms_authenticated_read on public.rooms for select to authenticated using (true);
drop policy if exists rooms_manager_write on public.rooms;
create policy rooms_manager_write on public.rooms for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select, insert, update, delete on public.rooms to authenticated;

drop policy if exists settings_manager_all on public.settings;
create policy settings_manager_all on public.settings for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select, insert, update, delete on public.settings to authenticated;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings for select to anon, authenticated
  using (setting_key in ('news_config','exam_news_config','tv_display_config','tv_poster_config'));
drop policy if exists site_settings_manager_write on public.site_settings;
create policy site_settings_manager_write on public.site_settings for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists tv_posters_public_read on public.tv_posters;
create policy tv_posters_public_read on public.tv_posters for select to anon, authenticated using (is_active = true or public.is_manager());
drop policy if exists tv_posters_manager_write on public.tv_posters;
create policy tv_posters_manager_write on public.tv_posters for all to authenticated using (public.is_manager()) with check (public.is_manager());
grant select on public.tv_posters to anon, authenticated;
grant insert, update, delete on public.tv_posters to authenticated;

-- Some older copies used smrm_reservations, but it is not present in the
-- current 20-object production schema. Apply its security only when present.
do $optional_smrm$
begin
  if to_regclass('public.smrm_reservations') is not null then
    execute 'drop policy if exists smrm_reservations_authenticated_read on public.smrm_reservations';
    execute 'create policy smrm_reservations_authenticated_read on public.smrm_reservations for select to authenticated using (true)';
    execute 'drop policy if exists smrm_reservations_manager_write on public.smrm_reservations';
    execute 'create policy smrm_reservations_manager_write on public.smrm_reservations for all to authenticated using (public.is_manager()) with check (public.is_manager())';
    execute 'grant select,insert,update,delete on public.smrm_reservations to authenticated';
    execute 'create or replace view public.smrm_reservations_public with (security_invoker = false) as select date,start_time,end_time,status from public.smrm_reservations where status = ''confirmed''';
    execute 'revoke all on public.smrm_reservations_public from public';
    execute 'grant select on public.smrm_reservations_public to anon,authenticated';
  end if;
end $optional_smrm$;

drop policy if exists lecture_presence_manager_read on public.lecture_presence_logs;
create policy lecture_presence_manager_read on public.lecture_presence_logs for select to authenticated using (public.is_manager());
grant select on public.lecture_presence_logs to authenticated;

do $reports$
declare t text;
begin
  foreach t in array array['schedule_report_batches','schedule_report_batch_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_manager_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_manager()) with check (public.is_manager())', t || '_manager_all', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $reports$;

create or replace function public.notify_meeting_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare manager_row record;
begin
  if tg_op = 'INSERT' then
    for manager_row in select id from public.profiles where role = 'manager' and id <> new.user_id loop
      insert into public.citl_notifications(recipient_id, actor_id, kind, title, body, entity_type, entity_id, route, dedupe_key)
      values(manager_row.id, new.user_id, 'meeting_request', 'طلب حجز جديد', coalesce(new.title, 'حجز') || ' – ' || coalesce(new.date::text, ''),
        'meetings', new.id::text, '/dashboard/?notification=meeting', 'meeting-created:' || new.id::text)
      on conflict (recipient_id, dedupe_key) do nothing;
    end loop;
  elsif new.status is distinct from old.status or new.pending_changes is distinct from old.pending_changes then
    insert into public.citl_notifications(recipient_id, actor_id, kind, title, body, entity_type, entity_id, route, dedupe_key)
    values(new.user_id, auth.uid(), 'meeting_status', 'تحديث حالة الحجز', coalesce(new.title, 'حجز') || ': ' || coalesce(new.status, ''),
      'meetings', new.id::text, '/dashboard/?notification=meeting', 'meeting-status:' || new.id::text || ':' || coalesce(new.status, '') || ':' || extract(epoch from now())::bigint)
    on conflict (recipient_id, dedupe_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists meetings_durable_notifications on public.meetings;
create trigger meetings_durable_notifications after insert or update on public.meetings
for each row execute function public.notify_meeting_change();

-- Preserve only currently actionable old requests; historical client-side "seen"
-- values are deliberately not reused because they caused the stuck state.
insert into public.citl_notifications(recipient_id, actor_id, kind, title, body, entity_type, entity_id, route, dedupe_key)
select p.id, m.user_id, 'meeting_request', 'طلب حجز يحتاج مراجعة', coalesce(m.title, 'حجز') || ' – ' || coalesce(m.date::text, ''),
       'meetings', m.id::text, '/dashboard/?notification=meeting', 'meeting-created:' || m.id::text
from public.meetings m cross join public.profiles p
where p.role = 'manager' and p.id <> m.user_id
  and coalesce(m.status, 'pending') in ('pending','modification_requested','cancellation_requested')
on conflict (recipient_id, dedupe_key) do nothing;

-- Ensure realtime publication can deliver durable notifications.
do $$ begin
  alter publication supabase_realtime add table public.citl_notifications;
exception when duplicate_object then null;
end $$;

comment on table public.room_qr_tokens is
  'Only SHA-256 hashes are stored. Raw QR tokens are returned once by the manager SQL RPC.';

-- ---------------------------------------------------------------------------
-- SQL-only runtime: registration, management, notifications, presence and QR
-- attendance. This keeps deployment to one SQL file plus the GitHub files.
-- ---------------------------------------------------------------------------
create table if not exists public.campus_networks (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'شبكة الكلية',
  network_cidr cidr not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.campus_networks enable row level security;
drop policy if exists campus_networks_manager_select on public.campus_networks;
create policy campus_networks_manager_select on public.campus_networks
  for select to authenticated using (public.is_manager());
revoke all on public.campus_networks from anon, authenticated;
grant select on public.campus_networks to authenticated;

-- Import the existing attendance ranges exactly. Only enabled ranges that are
-- explicitly marked as inside-campus are trusted for attendance classification.
insert into public.campus_networks(label,network_cidr,active)
select coalesce(nullif(trim(label),''),'شبكة الكلية'),network_cidr::cidr,true
from public.attendance_network_ranges
where is_active is true and inside_campus is true
on conflict (network_cidr) do update
set label=excluded.label,active=true;

-- Import a compatible IP/CIDR value from old settings automatically when one
-- exists. Invalid or unrelated values are ignored and never guessed.
do $campus_import$
declare
  table_name text;
  row_json jsonb;
  pair record;
  parsed cidr;
begin
  foreach table_name in array array['settings','site_settings'] loop
    if to_regclass('public.' || table_name) is null then continue; end if;
    for row_json in execute format('select to_jsonb(t) from public.%I t', table_name) loop
      for pair in select * from jsonb_each_text(row_json) loop
        if pair.key ~* '(campus|college|academy).*(ip|cidr|network|range)|(ip|cidr|network|range).*(campus|college|academy)' then
          begin
            parsed := trim(pair.value)::cidr;
            insert into public.campus_networks(label, network_cidr)
            values ('إعداد سابق: ' || pair.key, parsed)
            on conflict (network_cidr) do nothing;
          exception when others then null;
          end;
        end if;
      end loop;
      if coalesce(row_json->>'setting_key','') ~* '(campus|college|academy).*(ip|cidr)|(ip|cidr).*(campus|college|academy)' then
        begin
          parsed := coalesce(row_json->>'setting_value',row_json->>'value')::cidr;
          insert into public.campus_networks(label,network_cidr)
          values('إعداد سابق: '||row_json->>'setting_key',parsed) on conflict (network_cidr) do nothing;
        exception when others then null;
        end;
      end if;
    end loop;
  end loop;
end $campus_import$;

create or replace function public.citl_normalize_arabic_name(p_value text)
returns text language sql immutable set search_path = public as $$
  select trim(regexp_replace(
    translate(lower(coalesce(p_value,'')), 'أإآىةؤئـ', 'ااايهوي'),
    '[^[:alnum:]ء-ي]+', ' ', 'g'));
$$;

-- Match only the complete timetable label (or a complete alias). Delimiters
-- inside the label are part of the stored value and are never parsed as people.
create or replace function public.citl_name_list_matches(
  p_schedule_name text,
  p_person_name text,
  p_aliases text[] default '{}'
)
returns boolean language sql immutable set search_path = public as $$
  select
    public.citl_normalize_arabic_name(p_schedule_name) = public.citl_normalize_arabic_name(p_person_name)
    or exists (
      select 1 from unnest(coalesce(p_aliases, '{}'::text[])) alias_name
      where public.citl_normalize_arabic_name(alias_name) <> ''
        and public.citl_normalize_arabic_name(alias_name) = public.citl_normalize_arabic_name(p_schedule_name)
    );
$$;

create or replace function public.citl_request_ip()
returns inet language plpgsql stable set search_path = public as $$
declare
  headers jsonb;
  raw_ip text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then headers := '{}'::jsonb;
  end;
  raw_ip := trim(split_part(coalesce(headers->>'cf-connecting-ip', headers->>'x-forwarded-for', headers->>'x-real-ip', ''), ',', 1));
  if raw_ip = '' then return null; end if;
  begin return raw_ip::inet; exception when others then return null; end;
end $$;

create or replace function public.citl_is_inside_campus(p_ip inet)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_ip is not null and exists (
    select 1 from public.campus_networks n
    where n.active and p_ip <<= n.network_cidr
  ), false);
$$;

create or replace function public.citl_network_label(p_ip inet)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select n.label from public.campus_networks n
    where n.active and p_ip <<= n.network_cidr order by masklen(n.network_cidr) desc limit 1), 'خارج شبكة الكلية');
$$;

create table if not exists public.registration_tickets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  code_hash text,
  details jsonb not null,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.registration_tickets enable row level security;
revoke all on public.registration_tickets from anon, authenticated;

create or replace function public.citl_prepare_registration(p_access_code text, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  invite jsonb;
  code_digest text := encode(digest(trim(coalesce(p_access_code,'')), 'sha256'), 'hex');
  raw_ticket text := gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', '');
  resolved jsonb;
  linked_name text;
  faculty jsonb;
begin
  if trim(coalesce(p_details->>'full_name','')) = ''
     or coalesce(p_details->>'email','') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'راجع الاسم والبريد الإلكتروني';
  end if;
  select to_jsonb(a) into invite from public.access_codes a
  where a.code_hash = code_digest and a.is_active = true
    and (a.expires_at is null or a.expires_at > now())
    and (a.max_uses is null or coalesce(a.uses_count,0) < a.max_uses)
  limit 1;
  if invite is null then raise exception 'كود التسجيل غير صحيح أو منتهي الصلاحية'; end if;

  resolved := p_details || jsonb_build_object(
    'role', case when invite->>'role' = 'manager' then 'manager' else 'user' end,
    'account_type', coalesce(nullif(invite->>'account_type',''), nullif(p_details->>'account_type',''), 'user'),
    'department', coalesce(nullif(invite->>'department_key',''), p_details->>'department',''),
    'permissions', '{}'::jsonb
  );
  if resolved->>'account_type' = 'faculty' then
    linked_name := trim(coalesce(p_details->>'linked_instructor',''));
    select jsonb_build_object('full_name',f.full_name,'department_key',f.department_key,'position',f.position)
      into faculty from public.faculty_directory f where f.full_name = linked_name and f.is_active = true limit 1;
    if faculty is null then raise exception 'اختر اسماً أكاديمياً معتمداً من القائمة'; end if;
    resolved := resolved || jsonb_build_object('linked_instructor', faculty->>'full_name',
      'department', coalesce(faculty->>'department_key', resolved->>'department'),
      'position', coalesce(faculty->>'position', resolved->>'position'));
  end if;

  insert into public.registration_tickets(token_hash, code_hash, details)
  values (encode(digest(raw_ticket, 'sha256'), 'hex'), code_digest, resolved);
  return jsonb_build_object('ok', true, 'ticket', raw_ticket);
end $$;
revoke all on function public.citl_prepare_registration(text,jsonb) from public;
grant execute on function public.citl_prepare_registration(text,jsonb) to anon, authenticated;

create or replace function public.citl_prepare_manager_registration(p_details jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  raw_ticket text := gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', '');
  permissions jsonb := coalesce(p_details->'permissions','{}'::jsonb);
  resolved jsonb;
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'هذه العملية للمدير فقط'; end if;
  if trim(coalesce(p_details->>'full_name','')) = ''
     or coalesce(p_details->>'email','') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'راجع الاسم والبريد الإلكتروني';
  end if;
  resolved := p_details || jsonb_build_object('role', case when coalesce((permissions->>'can_approve')::boolean,false)
      or coalesce((permissions->>'can_manage_users')::boolean,false) or coalesce((permissions->>'can_delete')::boolean,false)
      then 'manager' else 'user' end,
    'account_type','user','permissions',permissions);
  insert into public.registration_tickets(token_hash, details, invited_by)
  values (encode(digest(raw_ticket, 'sha256'), 'hex'), resolved, auth.uid());
  return jsonb_build_object('ok', true, 'ticket', raw_ticket);
end $$;
revoke all on function public.citl_prepare_manager_registration(jsonb) from public;
grant execute on function public.citl_prepare_manager_registration(jsonb) to authenticated;

create or replace function public.citl_finish_registration()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  raw_ticket text := new.raw_user_meta_data->>'registration_ticket';
  ticket public.registration_tickets%rowtype;
  d jsonb;
  invite jsonb;
  is_visiting boolean;
  linked text[];
begin
  if coalesce(raw_ticket,'') = '' then return new; end if;
  select * into ticket from public.registration_tickets
  where token_hash = encode(digest(raw_ticket, 'sha256'), 'hex')
    and consumed_at is null and expires_at > now() for update;
  if not found then raise exception 'تذكرة التسجيل غير صالحة أو منتهية'; end if;
  d := ticket.details;
  if lower(coalesce(d->>'email','')) <> lower(coalesce(new.email,'')) then raise exception 'البريد لا يطابق تذكرة التسجيل'; end if;
  if ticket.code_hash is not null then
    select to_jsonb(a) into invite from public.access_codes a where a.code_hash = ticket.code_hash and a.is_active = true
      and (a.expires_at is null or a.expires_at > now())
      and (a.max_uses is null or coalesce(a.uses_count,0) < a.max_uses) limit 1 for update;
    if invite is null then raise exception 'كود التسجيل لم يعد صالحاً'; end if;
    update public.access_codes set uses_count = coalesce(uses_count,0)+1, last_used_at=now() where code_hash=ticket.code_hash;
  end if;
  is_visiting := d->>'account_type' = 'visiting_lecturer';
  linked := case when is_visiting then array[d->>'full_name']
                 when d->>'account_type'='faculty' then array[d->>'linked_instructor'] else null end;
  insert into public.profiles(id,email,full_name,mobile,position,department,role,permissions,account_type,
    linked_instructors,schedule_link_required,schedule_link_status,is_visiting_lecturer,updated_at)
  values(new.id,new.email,d->>'full_name',coalesce(d->>'mobile',''),coalesce(d->>'position',''),coalesce(d->>'department',''),
    coalesce(d->>'role','user'),coalesce(d->'permissions','{}'::jsonb),case when is_visiting then 'faculty' else coalesce(d->>'account_type','user') end,
    linked,is_visiting or d->>'account_type'='faculty',case when is_visiting or d->>'account_type'='faculty' then 'linked' else 'not_required' end,is_visiting,now())
  on conflict (id) do update set email=excluded.email,full_name=excluded.full_name,mobile=excluded.mobile,position=excluded.position,
    department=excluded.department,role=excluded.role,permissions=excluded.permissions,account_type=excluded.account_type,
    linked_instructors=excluded.linked_instructors,schedule_link_required=excluded.schedule_link_required,
    schedule_link_status=excluded.schedule_link_status,is_visiting_lecturer=excluded.is_visiting_lecturer,updated_at=now();
  if is_visiting then
    insert into public.visiting_lecturers(full_name,normalized_name,department_key,profile_id,is_active,created_by)
    values(d->>'full_name',public.citl_normalize_arabic_name(d->>'full_name'),coalesce(d->>'department',''),new.id,true,new.id)
    on conflict (normalized_name) do update set profile_id=excluded.profile_id,department_key=excluded.department_key,is_active=true,updated_at=now();
  elsif d->>'account_type'='faculty' and coalesce(d->>'linked_instructor','')<>'' then
    update public.faculty_directory set profile_id=new.id,email=new.email,mobile=coalesce(d->>'mobile',''),linked_at=now(),updated_at=now()
    where full_name=d->>'linked_instructor';
  end if;
  update public.registration_tickets set consumed_at=now() where id=ticket.id;
  return new;
end $$;
drop trigger if exists citl_auth_registration on auth.users;
create trigger citl_auth_registration after insert on auth.users
for each row execute function public.citl_finish_registration();

create or replace function public.citl_parse_time_slot(p_slot text)
returns time[] language plpgsql immutable set search_path = public as $$
declare
  matches text[][];
  m text[];
  result time[] := '{}';
  hour_value integer;
  minute_value integer;
  suffix text;
begin
  select array_agg(x) into matches from regexp_matches(coalesce(p_slot,''), '(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?', 'gi') x;
  if matches is null then raise exception 'توقيت غير مفهوم: %', p_slot; end if;
  foreach m slice 1 in array matches loop
    hour_value := m[1]::integer; minute_value := coalesce(nullif(m[2],''),'0')::integer; suffix := upper(coalesce(m[3],''));
    if suffix='PM' and hour_value<12 then hour_value:=hour_value+12; end if;
    if suffix='AM' and hour_value=12 then hour_value:=0; end if;
    result := array_append(result, make_time(hour_value,minute_value,0));
  end loop;
  if array_length(result,1)=1 then result:=array_append(result,(result[1]+interval '2 hours')::time); end if;
  return result[1:2];
end $$;

create or replace function public.citl_sync_visiting_sessions(p_term_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  term_row public.academic_terms%rowtype;
  schedule_row record;
  visitor_row public.visiting_lecturers%rowtype;
  times time[];
  synced integer := 0;
  skipped text[] := '{}';
begin
  if not public.is_manager() then raise exception 'هذه العملية للمدير فقط'; end if;
  select * into term_row from public.academic_terms where (p_term_id is not null and id=p_term_id) or (p_term_id is null and is_active) limit 1;
  if not found then raise exception 'حدد ترماً نشطاً أولاً'; end if;
  update public.visiting_lecture_sessions set is_active=false where term_id=term_row.id;
  for schedule_row in select * from public.academic_schedule where lower(coalesce(status,'active')) <> 'cancelled' loop
    times:=null;
    for visitor_row in
      select v.* from public.visiting_lecturers v
      join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id
      where v.is_active and tv.is_active and tv.term_id=term_row.id
        and public.citl_name_list_matches(schedule_row.instructor::text,v.full_name,v.aliases)
      order by (v.normalized_name=public.citl_normalize_arabic_name(schedule_row.instructor::text)) desc,v.created_at
      limit 1
    loop
      begin
        if times is null then times:=public.citl_parse_time_slot(schedule_row.time_slot::text); end if;
        insert into public.visiting_lecture_sessions(term_id,schedule_id,visiting_lecturer_id,instructor_name,course_name,room_name,day_of_week,start_time,end_time,is_active,synced_at)
        values(term_row.id,schedule_row.id::text,visitor_row.id,visitor_row.full_name,coalesce(schedule_row.course_name::text,''),schedule_row.room_name::text,
          schedule_row.day_of_week::text,times[1],times[2],true,now())
        on conflict (term_id,schedule_id,visiting_lecturer_id) do update set instructor_name=excluded.instructor_name,
          course_name=excluded.course_name,room_name=excluded.room_name,day_of_week=excluded.day_of_week,start_time=excluded.start_time,end_time=excluded.end_time,is_active=true,synced_at=now();
        synced:=synced+1;
      exception when others then
        skipped:=array_append(skipped,schedule_row.id::text||':'||visitor_row.id::text);
      end;
    end loop;
  end loop;
  insert into public.security_audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'sync','visiting_lecture_sessions',term_row.id::text,jsonb_build_object('count',synced,'skipped',skipped));
  return jsonb_build_object('count',synced,'skipped',to_jsonb(skipped));
end $$;

create or replace function public.citl_secure_api(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  input jsonb := coalesce(p_payload->'data','{}'::jsonb);
  result jsonb;
  row_json jsonb;
  lecture jsonb;
  profile jsonb;
  dept text;
  action_id text;
  recipient uuid;
  notified integer := 0;
  selected_term_id uuid;
  room text;
  raw_token text;
  generated jsonb := '[]'::jsonb;
  target_id text;
  selected_profile_id uuid;
  previous_profile_id uuid;
  matched_visitor_id uuid;
  sync_result jsonb;
begin
  if uid is null then raise exception 'يلزم تسجيل الدخول'; end if;
  if p_action='notifications.list' then
    select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb) into result
      from (select * from public.citl_notifications where recipient_id=uid and archived_at is null order by created_at desc limit 80) n;
    return jsonb_build_object('ok',true,'notifications',result);
  elsif p_action='notifications.read' then
    update public.citl_notifications set read_at=coalesce(read_at,now()) where recipient_id=uid and read_at is null
      and (not (p_payload ? 'ids') or id::text in (select value from jsonb_array_elements_text(p_payload->'ids')));
    return jsonb_build_object('ok',true);
  elsif p_action='schedule_action.save' then
    select to_jsonb(s) into lecture from public.academic_schedule s where s.id::text=input->>'schedule_id' limit 1;
    select to_jsonb(p) into profile from public.profiles p where p.id=uid;
    if lecture is null then raise exception 'المحاضرة غير موجودة'; end if;
    if input->>'action_type' not in ('cancel','replace','move_room','replace_and_move') then raise exception 'نوع الإجراء غير صحيح'; end if;
    if coalesce(input->>'action_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'تاريخ الإجراء غير صحيح'; end if;
    if profile->>'role'<>'manager' and not exists(select 1 from jsonb_array_elements_text(coalesce(profile->'linked_instructors','[]'::jsonb)) x
      where public.citl_normalize_arabic_name(x)=public.citl_normalize_arabic_name(lecture->>'instructor')) then
      raise exception 'لا يمكنك تسجيل إجراء على محاضرة غير مرتبطة بحسابك';
    end if;
    select id::text into action_id from public.schedule_actions where schedule_id::text=input->>'schedule_id' and action_date=(input->>'action_date')::date limit 1;
    if action_id is null then
      insert into public.schedule_actions(schedule_id,action_date,action_type,reason,replacement_instructor,replacement_room,created_by,created_by_user_id)
      values(input->>'schedule_id',(input->>'action_date')::date,input->>'action_type',left(coalesce(input->>'reason',''),1000),
        nullif(input->>'replacement_instructor',''),nullif(input->>'replacement_room',''),coalesce(profile->>'full_name',profile->>'email'),uid) returning id::text into action_id;
    else
      update public.schedule_actions set action_type=input->>'action_type',reason=left(coalesce(input->>'reason',''),1000),
        replacement_instructor=nullif(input->>'replacement_instructor',''),replacement_room=nullif(input->>'replacement_room',''),
        created_by=coalesce(profile->>'full_name',profile->>'email'),created_by_user_id=uid where id::text=action_id;
    end if;
    dept := coalesce(
      (select tv.department_key
       from public.visiting_lecturers v
       join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id and tv.is_active
       join public.academic_terms t on t.id=tv.term_id
       where (input->>'action_date')::date between t.starts_on and t.ends_on
         and public.citl_name_list_matches(lecture->>'instructor',v.full_name,v.aliases)
       order by t.starts_on desc limit 1),
      (select f.department_key from public.faculty_directory f where f.full_name=lecture->>'instructor' limit 1),
      input->>'department_key', profile->>'department');
    for recipient in
      select distinct r from (
        select h.profile_id r from public.department_heads h where h.active and h.department_key=dept
        union select p.id from public.profiles p where p.role='manager'
        union select f.profile_id from public.faculty_directory f where f.full_name=lecture->>'instructor' and f.profile_id is not null
        union select f.profile_id from public.faculty_directory f where f.full_name=input->>'replacement_instructor' and f.profile_id is not null
      ) recipients where r is not null and r<>uid
    loop
      insert into public.citl_notifications(recipient_id,actor_id,kind,title,body,entity_type,entity_id,route,payload,dedupe_key,read_at)
      values(recipient,uid,'schedule_action','إجراء جديد على الجدول',coalesce(profile->>'full_name','مستخدم')||': '||coalesce(lecture->>'course_name','محاضرة')||' – '||input->>'action_date',
        'schedule_actions',action_id,'/schedules/?notification=schedule-action',jsonb_build_object('action_type',input->>'action_type','department_key',dept,'schedule_id',input->>'schedule_id'),
        'schedule-action:'||action_id,null)
      on conflict (recipient_id,dedupe_key) do update set title=excluded.title,body=excluded.body,payload=excluded.payload,created_at=now(),read_at=null,archived_at=null;
      notified:=notified+1;
    end loop;
    insert into public.security_audit_log(actor_id,action,entity_type,entity_id) values(uid,'save','schedule_actions',action_id);
    return jsonb_build_object('ok',true,'data',(select to_jsonb(a) from public.schedule_actions a where a.id::text=action_id),'notified',notified);
  end if;

  if not public.is_manager() then raise exception 'هذه العملية للمدير فقط'; end if;
  if p_action='registration.manager_ticket' then
    return public.citl_prepare_manager_registration(input);
  elsif p_action='management.snapshot' then
    return jsonb_build_object('ok',true,
      'terms',(select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_on desc),'[]'::jsonb) from public.academic_terms t),
      'visitors',(select coalesce(jsonb_agg(to_jsonb(v) order by v.full_name),'[]'::jsonb) from public.visiting_lecturers v),
      'term_visitors',(
        select coalesce(jsonb_agg(
          to_jsonb(tv)||jsonb_build_object(
            'id',v.id,'full_name',v.full_name,'normalized_name',v.normalized_name,
            'profile_id',v.profile_id,'aliases',v.aliases,'identity_active',v.is_active
          ) order by t.starts_on desc,v.full_name
        ),'[]'::jsonb)
        from public.term_visiting_lecturers tv
        join public.visiting_lecturers v on v.id=tv.visiting_lecturer_id
        join public.academic_terms t on t.id=tv.term_id
      ),
      'schedule_instructors',(
        with candidate_rows as (
          select trim(s.instructor::text) full_name,
            public.citl_normalize_arabic_name(s.instructor::text) normalized_name,
            s.id::text schedule_id, trim(s.room_name::text) room_name
          from public.academic_schedule s
          where lower(coalesce(s.status,'active')) <> 'cancelled'
        ), candidates as (
          select min(full_name) full_name, normalized_name, count(distinct schedule_id) lecture_count,
            array_agg(distinct room_name order by room_name) filter (where room_name<>'') rooms
          from candidate_rows
          where normalized_name<>''
          group by normalized_name
        )
        select coalesce(jsonb_agg(
          to_jsonb(c)||jsonb_build_object(
            'visitor_id',(select v.id from public.visiting_lecturers v
              where v.normalized_name=c.normalized_name
                 or exists(select 1 from unnest(v.aliases) a where public.citl_normalize_arabic_name(a)=c.normalized_name)
              order by (v.normalized_name=c.normalized_name) desc limit 1)
          ) order by c.full_name
        ),'[]'::jsonb) from candidates c
      ),
      'heads',(select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('profiles',jsonb_build_object('full_name',p.full_name,'email',p.email))),'[]'::jsonb) from public.department_heads h join public.profiles p on p.id=h.profile_id where h.active),
      'rooms',(select coalesce(jsonb_agg(to_jsonb(q)-'token_hash' order by q.room_name),'[]'::jsonb) from public.room_qr_tokens q where q.is_active),
      'qr_eligible_rooms',(
        with eligible as (
          select s.id session_id,s.term_id,s.room_name,s.visiting_lecturer_id from public.visiting_lecture_sessions s where s.is_active
          union
          select s.id,s.term_id,a.replacement_room,s.visiting_lecturer_id
          from public.visiting_lecture_sessions s join public.schedule_actions a on a.schedule_id::text=s.schedule_id
          join public.academic_terms t on t.id=s.term_id
          where s.is_active and a.action_type in ('move_room','replace_and_move') and a.replacement_room is not null
            and a.action_date between t.starts_on and t.ends_on
        )
        select coalesce(jsonb_agg(to_jsonb(x) order by x.room_name),'[]'::jsonb)
        from (select term_id,room_name,count(distinct session_id) session_count,count(distinct visiting_lecturer_id) visitor_count
          from eligible where nullif(trim(room_name),'') is not null group by term_id,room_name) x
      ),
      'scans',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('term_id',s.term_id,'visiting_lecture_sessions',jsonb_build_object('course_name',s.course_name,'instructor_name',s.instructor_name,'start_time',s.start_time,'end_time',s.end_time)) order by a.scanned_at desc),'[]'::jsonb) from (select * from public.attendance_scans order by scanned_at desc limit 300) a join public.visiting_lecture_sessions s on s.id=a.session_id),
      'presence_sessions',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',u.id,'user_id',u.user_id,'user_name',u.user_name,'started_at',u.started_at,
        'last_seen_at',u.last_seen_at,'ended_at',u.ended_at,'is_online',u.is_online,
        'inside_campus',u.inside_campus,'network_label',u.network_label,'source_page',u.source_page
      ) order by u.started_at desc),'[]'::jsonb) from (
        select ps.* from public.user_presence_sessions ps
        where exists(
          select 1 from public.visiting_lecturers v
          join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id and tv.is_active
          where v.profile_id=ps.user_id
        ) order by ps.started_at desc limit 300
      ) u),
      'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'department',p.department,'role',p.role,'is_visiting_lecturer',p.is_visiting_lecturer) order by p.full_name),'[]'::jsonb) from public.profiles p));
  elsif p_action='term.save' then
    if coalesce(input->>'code','')='' or coalesce(input->>'name','')='' or input->>'starts_on' is null or input->>'ends_on' is null then raise exception 'بيانات الترم ناقصة'; end if;
    if coalesce((input->>'is_active')::boolean,false) then update public.academic_terms set is_active=false where id::text<>coalesce(input->>'id',''); end if;
    if coalesce(input->>'id','')='' then
      insert into public.academic_terms(code,name,starts_on,ends_on,is_active,created_by) values(left(input->>'code',40),left(input->>'name',120),(input->>'starts_on')::date,(input->>'ends_on')::date,coalesce((input->>'is_active')::boolean,false),uid) returning to_jsonb(academic_terms) into row_json;
    else
      update public.academic_terms set code=left(input->>'code',40),name=left(input->>'name',120),starts_on=(input->>'starts_on')::date,ends_on=(input->>'ends_on')::date,is_active=coalesce((input->>'is_active')::boolean,false) where id::text=input->>'id' returning to_jsonb(academic_terms) into row_json;
    end if;
    update public.profiles p set is_visiting_lecturer=exists(
      select 1 from public.visiting_lecturers v
      join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id and tv.is_active
      join public.academic_terms t on t.id=tv.term_id and t.is_active
      where v.profile_id=p.id
    ) where p.is_visiting_lecturer or exists(select 1 from public.visiting_lecturers v where v.profile_id=p.id);
    return jsonb_build_object('ok',true,'data',row_json);
  elsif p_action='visitor.save' then
    selected_term_id:=nullif(input->>'term_id','')::uuid;
    if selected_term_id is null or not exists(select 1 from public.academic_terms where id=selected_term_id) then raise exception 'اختر الترم الدراسي'; end if;
    if public.citl_normalize_arabic_name(input->>'full_name')='' or coalesce(input->>'department_key','')='' then raise exception 'اسم المنتدب والقسم مطلوبان'; end if;
    selected_profile_id:=nullif(input->>'profile_id','')::uuid;
    matched_visitor_id:=null;
    if coalesce(input->>'id','')<>'' then
      matched_visitor_id:=(input->>'id')::uuid;
    else
      select v.id into matched_visitor_id from public.visiting_lecturers v
      where v.normalized_name=public.citl_normalize_arabic_name(input->>'full_name') limit 1;
      if matched_visitor_id is null and selected_profile_id is not null then
        select v.id into matched_visitor_id from public.visiting_lecturers v where v.profile_id=selected_profile_id limit 1;
      end if;
    end if;
    if matched_visitor_id is null then
      insert into public.visiting_lecturers(full_name,normalized_name,department_key,profile_id,aliases,is_active,created_by)
      values(left(trim(input->>'full_name'),180),public.citl_normalize_arabic_name(input->>'full_name'),input->>'department_key',selected_profile_id,
        string_to_array(coalesce(input->>'aliases',''),','),true,uid)
      returning id,to_jsonb(visiting_lecturers) into matched_visitor_id,row_json;
    else
      select profile_id into previous_profile_id from public.visiting_lecturers where id=matched_visitor_id;
      update public.visiting_lecturers set full_name=left(trim(input->>'full_name'),180),normalized_name=public.citl_normalize_arabic_name(input->>'full_name'),department_key=input->>'department_key',profile_id=nullif(input->>'profile_id','')::uuid,
        aliases=case when jsonb_typeof(input->'aliases')='array' then array(select jsonb_array_elements_text(input->'aliases')) else string_to_array(coalesce(input->>'aliases',''),',') end,
        is_active=true,updated_at=now() where id=matched_visitor_id returning to_jsonb(visiting_lecturers) into row_json;
    end if;
    insert into public.term_visiting_lecturers(term_id,visiting_lecturer_id,department_key,is_active,selected_by,selected_at,updated_at)
    values(selected_term_id,matched_visitor_id,input->>'department_key',coalesce((input->>'is_active')::boolean,true),uid,now(),now())
    on conflict (term_id,visiting_lecturer_id) do update set
      department_key=excluded.department_key,is_active=excluded.is_active,selected_by=uid,updated_at=now();

    -- Keep the identity/profile flags derived from term assignments, never from
    -- a browser-supplied global switch.
    update public.visiting_lecturers v set is_active=exists(
      select 1 from public.term_visiting_lecturers tv where tv.visiting_lecturer_id=v.id and tv.is_active
    ) where v.id=matched_visitor_id;
    update public.profiles p set is_visiting_lecturer=exists(
      select 1 from public.visiting_lecturers v
      join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id and tv.is_active
      join public.academic_terms t on t.id=tv.term_id and t.is_active
      where v.profile_id=p.id
    ) where p.id in (selected_profile_id,previous_profile_id);

    perform public.citl_sync_visiting_sessions(selected_term_id);

    select h.profile_id into recipient from public.department_heads h
      where h.active and h.department_key=input->>'department_key' limit 1;
    if recipient is not null and recipient<>uid then
      insert into public.citl_notifications(recipient_id,actor_id,kind,title,body,entity_type,entity_id,route,payload,dedupe_key)
      values(recipient,uid,'visiting_lecturer_assignment','تحديث منتدبي القسم',
        (row_json->>'full_name')||' - '||(select name from public.academic_terms where id=selected_term_id),
        'term_visiting_lecturers',matched_visitor_id::text,'/schedules/?open=attendance&notification=visiting-lecturer',
        jsonb_build_object('term_id',selected_term_id,'department_key',input->>'department_key','is_active',coalesce((input->>'is_active')::boolean,true)),
        'term-visitor:'||selected_term_id::text||':'||matched_visitor_id::text)
      on conflict (recipient_id,dedupe_key) do update set body=excluded.body,payload=excluded.payload,created_at=now(),read_at=null,archived_at=null;
    end if;
    return jsonb_build_object('ok',true,'data',row_json||jsonb_build_object('term_id',selected_term_id,'is_active',coalesce((input->>'is_active')::boolean,true)));
  elsif p_action='head.save' then
    if coalesce(input->>'department_key','')='' or coalesce(input->>'profile_id','')='' then raise exception 'القسم ورئيس القسم مطلوبان'; end if;
    recipient:=(input->>'profile_id')::uuid;
    insert into public.department_heads(department_key,profile_id,active,assigned_by,assigned_at) values(input->>'department_key',recipient,true,uid,now())
    on conflict (department_key) do update set profile_id=excluded.profile_id,active=true,assigned_by=uid,assigned_at=now() returning to_jsonb(department_heads) into row_json;
    select id into selected_term_id from public.academic_terms where is_active limit 1;
    if recipient<>uid and selected_term_id is not null then
      insert into public.citl_notifications(recipient_id,actor_id,kind,title,body,entity_type,entity_id,route,payload,dedupe_key)
      values(recipient,uid,'department_head_assignment','تم تعيينك رئيسًا للقسم',
        'عدد المنتدبين النشطين في الترم الحالي: '||(select count(*) from public.term_visiting_lecturers tv where tv.term_id=selected_term_id and tv.department_key=input->>'department_key' and tv.is_active),
        'department_heads',input->>'department_key','/schedules/?open=attendance&notification=department-head',
        jsonb_build_object('term_id',selected_term_id,'department_key',input->>'department_key'),
        'department-head:'||(input->>'department_key')||':'||selected_term_id::text)
      on conflict (recipient_id,dedupe_key) do update set body=excluded.body,payload=excluded.payload,created_at=now(),read_at=null,archived_at=null;
    end if;
    return jsonb_build_object('ok',true,'data',row_json);
  elsif p_action='sessions.sync' then
    return jsonb_build_object('ok',true)||public.citl_sync_visiting_sessions(nullif(p_payload->>'term_id','')::uuid);
  elsif p_action='qr.generate' then
    selected_term_id:=nullif(p_payload->>'term_id','')::uuid; if selected_term_id is null then raise exception 'الترم مطلوب'; end if;
    sync_result:=public.citl_sync_visiting_sessions(selected_term_id);
    update public.room_qr_tokens set is_active=false,revoked_at=now()
      where term_id=selected_term_id and is_active;
    for room in select distinct x.room_name from (
      select s.room_name from public.visiting_lecture_sessions s where s.term_id=selected_term_id and s.is_active
      union select a.replacement_room from public.schedule_actions a
        join public.visiting_lecture_sessions s on s.schedule_id::text=a.schedule_id::text and s.term_id=selected_term_id and s.is_active
        join public.academic_terms t on t.id=selected_term_id
        where a.action_type in ('move_room','replace_and_move') and a.action_date between t.starts_on and t.ends_on and a.replacement_room is not null
    ) x where x.room_name is not null loop
      raw_token:=gen_random_uuid()::text||replace(gen_random_uuid()::text,'-','');
      insert into public.room_qr_tokens(term_id,room_name,token_hash,token_hint,created_by)
      values(selected_term_id,room,encode(digest(raw_token,'sha256'),'hex'),right(raw_token,8),uid);
      generated:=generated||jsonb_build_array(jsonb_build_object('room_name',room,'token',raw_token,'url','https://aastcitl.me/attendance/?t='||raw_token));
    end loop;
    return jsonb_build_object('ok',true,'generated',generated,'synced',sync_result->'count');
  elsif p_action='schedule.delete' then
    target_id:=p_payload->>'id'; delete from public.academic_schedule where id::text=target_id;
    insert into public.security_audit_log(actor_id,action,entity_type,entity_id) values(uid,'delete','academic_schedule',target_id);
    return jsonb_build_object('ok',true);
  elsif p_action='schedule_action.delete' then
    target_id:=p_payload->>'id'; delete from public.schedule_actions where id::text=target_id;
    insert into public.security_audit_log(actor_id,action,entity_type,entity_id) values(uid,'delete','schedule_actions',target_id);
    return jsonb_build_object('ok',true);
  elsif p_action='user.delete' then
    target_id:=p_payload->>'id';
    if target_id is null or target_id=uid::text then raise exception 'لا يمكن حذف الحساب الحالي'; end if;
    if (select role from public.profiles where id=target_id::uuid)='manager' and (select count(*) from public.profiles where role='manager')<=1 then raise exception 'لا يمكن حذف آخر مدير'; end if;
    delete from auth.users where id=target_id::uuid;
    insert into public.security_audit_log(actor_id,action,entity_type,entity_id) values(uid,'delete','users',target_id);
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'عملية غير معروفة';
end $$;
revoke all on function public.citl_secure_api(text,jsonb) from public;
grant execute on function public.citl_secure_api(text,jsonb) to authenticated;

create or replace function public.citl_attendance_scan(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid:=auth.uid();
  visitor public.visiting_lecturers%rowtype;
  qr public.room_qr_tokens%rowtype;
  term_row public.academic_terms%rowtype;
  current_local timestamp:=timezone('Africa/Cairo',now());
  lecture_day text:=case extract(isodow from timezone('Africa/Cairo',now()))::integer
    when 1 then 'Monday' when 2 then 'Tuesday' when 3 then 'Wednesday'
    when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
    when 7 then 'Sunday' end;
  matched record;
  match_count integer;
  request_ip inet:=public.citl_request_ip();
  is_inside boolean;
  scan_id uuid;
  headers jsonb;
begin
  if uid is null then raise exception 'يلزم تسجيل الدخول'; end if;
  if length(coalesce(p_token,''))<32 then raise exception 'رمز القاعة غير صالح'; end if;
  select * into qr from public.room_qr_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') and is_active limit 1;
  if not found then raise exception 'رمز القاعة غير صالح أو تم استبداله'; end if;
  select * into term_row from public.academic_terms where id=qr.term_id;
  if current_local::date not between term_row.starts_on and term_row.ends_on then raise exception 'هذا الرمز خارج فترة الترم'; end if;
  select v.* into visitor
  from public.visiting_lecturers v
  join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id
  where v.profile_id=uid and v.is_active and tv.term_id=qr.term_id and tv.is_active
  limit 1;
  if not found then raise exception 'حسابك غير محدد كمنتدب نشط في هذا الترم'; end if;

  with candidates as (
    select s.*,a.id action_id,a.action_type,a.replacement_room,a.replacement_instructor,
      case when a.action_type in ('move_room','replace_and_move') then a.replacement_room else s.room_name end effective_room,
      case when a.action_type in ('replace','replace_and_move') then a.replacement_instructor else s.instructor_name end effective_instructor
    from public.visiting_lecture_sessions s left join public.schedule_actions a on a.schedule_id::text=s.schedule_id and a.action_date=current_local::date
    where s.term_id=qr.term_id and s.day_of_week=lecture_day and s.is_active and coalesce(a.action_type,'')<>'cancel'
  ), matching as (
    select * from candidates c where c.effective_room=qr.room_name
      and (case when c.action_type in ('replace','replace_and_move')
          then public.citl_name_list_matches(c.effective_instructor,visitor.full_name,visitor.aliases)
          else c.visiting_lecturer_id=visitor.id end)
      and current_local::time between (c.start_time-interval '30 minutes')::time and (c.end_time+interval '45 minutes')::time
  ) select count(*) into match_count from matching;
  if match_count=0 then raise exception 'لا توجد لك محاضرة في هذه القاعة ضمن الوقت الحالي'; end if;
  if match_count>1 then raise exception 'يوجد تداخل في الجدول؛ تواصل مع الإدارة لتصحيحه'; end if;
  select s.*,a.id action_id,a.action_type,
    case when a.action_type in ('replace','replace_and_move') then a.replacement_instructor else s.instructor_name end effective_instructor
  into matched from public.visiting_lecture_sessions s left join public.schedule_actions a on a.schedule_id::text=s.schedule_id and a.action_date=current_local::date
  where s.term_id=qr.term_id and s.day_of_week=lecture_day and s.is_active and coalesce(a.action_type,'')<>'cancel'
    and (case when a.action_type in ('move_room','replace_and_move') then a.replacement_room else s.room_name end)=qr.room_name
    and (case when a.action_type in ('replace','replace_and_move')
        then public.citl_name_list_matches(a.replacement_instructor,visitor.full_name,visitor.aliases)
        else s.visiting_lecturer_id=visitor.id end)
    and current_local::time between (s.start_time-interval '30 minutes')::time and (s.end_time+interval '45 minutes')::time limit 1;
  is_inside:=public.citl_is_inside_campus(request_ip);
  begin headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then headers:='{}'::jsonb; end;
  begin
    insert into public.attendance_scans(session_id,lecturer_profile_id,lecture_date,room_name,effective_instructor,schedule_action_id,public_ip,inside_campus,user_agent,status)
    values(matched.id,uid,current_local::date,qr.room_name,matched.effective_instructor,matched.action_id::text,request_ip,is_inside,left(coalesce(headers->>'user-agent',''),400),'present') returning id into scan_id;
  exception when unique_violation then raise exception 'تم تسجيل حضور هذه المحاضرة اليوم بالفعل'; end;
  insert into public.citl_notifications(recipient_id,actor_id,kind,title,body,entity_type,entity_id,route,dedupe_key)
  values(uid,uid,'attendance','تم تسجيل الحضور',matched.course_name||' – '||qr.room_name,'attendance_scans',scan_id::text,'/attendance/','attendance:'||matched.id::text||':'||current_local::date)
  on conflict (recipient_id,dedupe_key) do nothing;
  return jsonb_build_object('ok',true,'scan',jsonb_build_object('scanned_at',now(),'course_name',matched.course_name,'room_name',qr.room_name,'inside_campus',is_inside));
end $$;
revoke all on function public.citl_attendance_scan(text) from public;
grant execute on function public.citl_attendance_scan(text) to authenticated;

create or replace function public.citl_presence_track(p_event_type text, p_session_id text default null, p_source_page text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid:=auth.uid();
  profile public.profiles%rowtype;
  event_name text;
  session_value text:=p_session_id;
  request_ip inet:=public.citl_request_ip();
  inside boolean;
begin
  if uid is null then raise exception 'يلزم تسجيل الدخول'; end if;
  select * into profile from public.profiles where id=uid;
  if not exists(
    select 1 from public.visiting_lecturers v
    join public.term_visiting_lecturers tv on tv.visiting_lecturer_id=v.id and tv.is_active
    join public.academic_terms t on t.id=tv.term_id and t.is_active
    where v.profile_id=uid and v.is_active
      and timezone('Africa/Cairo',now())::date between t.starts_on and t.ends_on
  ) then
    return jsonb_build_object('ok',true,'ignored',true,'reason','not_visiting_lecturer');
  end if;
  event_name:=case when p_event_type='start' then 'login' when p_event_type in ('login','heartbeat','logout') then p_event_type else 'heartbeat' end;
  inside:=public.citl_is_inside_campus(request_ip);
  if event_name='login' then
    insert into public.user_presence_sessions(user_id,user_email,user_name,account_type,user_role,started_at,last_seen_at,is_online,source_page,public_ip,network_label,inside_campus)
    values(uid,profile.email,coalesce(profile.full_name,profile.email),'visiting_lecturer',coalesce(profile.role,'user'),now(),now(),true,left(p_source_page,200),request_ip,public.citl_network_label(request_ip),inside)
    returning id::text into session_value;
  elsif event_name='logout' and session_value is not null then
    update public.user_presence_sessions set last_seen_at=now(),ended_at=now(),is_online=false,public_ip=request_ip,inside_campus=inside,network_label=public.citl_network_label(request_ip)
    where id::text=session_value and user_id=uid;
  elsif session_value is not null then
    update public.user_presence_sessions set last_seen_at=now(),is_online=true,public_ip=request_ip,inside_campus=inside,network_label=public.citl_network_label(request_ip)
    where id::text=session_value and user_id=uid;
  end if;
  return jsonb_build_object('ok',true,'session_id',session_value,'last_seen_at',now(),'inside_campus',inside,'network_label',public.citl_network_label(request_ip),'public_ip',request_ip);
end $$;
revoke all on function public.citl_presence_track(text,text,text) from public;
grant execute on function public.citl_presence_track(text,text,text) to authenticated;

-- Final install verification. Any missing object aborts the migration instead of
-- leaving the operator with a false success message.
do $verify$
declare
  required_table text;
  required_column record;
  rls_enabled boolean;
begin
  foreach required_table in array array[
    'citl_notifications','department_heads','academic_terms','visiting_lecturers',
    'term_visiting_lecturers','room_qr_tokens','visiting_lecture_sessions','attendance_scans','security_audit_log',
    'campus_networks','registration_tickets'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Secure v3 verification failed: missing table public.%', required_table;
    end if;
  end loop;

  -- Verify every column introduced or consumed by Secure v3. This prevents a
  -- successful-looking partial installation on older database layouts.
  for required_column in
    select * from (values
      ('citl_notifications','id'),('citl_notifications','recipient_id'),('citl_notifications','actor_id'),('citl_notifications','kind'),
      ('citl_notifications','title'),('citl_notifications','body'),('citl_notifications','entity_type'),
      ('citl_notifications','entity_id'),('citl_notifications','route'),('citl_notifications','payload'),
      ('citl_notifications','created_at'),('citl_notifications','read_at'),('citl_notifications','archived_at'),
      ('citl_notifications','dedupe_key'),
      ('profiles','is_visiting_lecturer'),('profiles','updated_at'),
      ('access_codes','code_hash'),('access_codes','is_active'),('access_codes','uses_count'),
      ('access_codes','max_uses'),('access_codes','expires_at'),('access_codes','last_used_at'),
      ('access_codes','role'),('access_codes','account_type'),('access_codes','department_key'),
      ('schedule_actions','created_by_user_id'),
      ('user_presence_sessions','public_ip'),('user_presence_sessions','network_label'),
      ('user_presence_sessions','inside_campus'),
      ('department_heads','department_key'),('department_heads','profile_id'),
      ('academic_terms','id'),('academic_terms','code'),('academic_terms','starts_on'),('academic_terms','ends_on'),
      ('visiting_lecturers','id'),('visiting_lecturers','full_name'),('visiting_lecturers','normalized_name'),
      ('visiting_lecturers','profile_id'),('visiting_lecturers','aliases'),
      ('term_visiting_lecturers','term_id'),('term_visiting_lecturers','visiting_lecturer_id'),
      ('term_visiting_lecturers','department_key'),('term_visiting_lecturers','is_active'),
      ('room_qr_tokens','term_id'),('room_qr_tokens','room_name'),('room_qr_tokens','token_hash'),
      ('visiting_lecture_sessions','term_id'),('visiting_lecture_sessions','schedule_id'),
      ('visiting_lecture_sessions','visiting_lecturer_id'),('visiting_lecture_sessions','start_time'),
      ('visiting_lecture_sessions','end_time'),
      ('attendance_scans','session_id'),('attendance_scans','lecturer_profile_id'),
      ('attendance_scans','lecture_date'),('attendance_scans','effective_instructor'),
      ('attendance_scans','schedule_action_id'),('attendance_scans','inside_campus'),
      ('campus_networks','network_cidr'),('campus_networks','active'),
      ('registration_tickets','token_hash'),('registration_tickets','details'),
      ('registration_tickets','expires_at')
    ) as expected(table_name,column_name)
  loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=required_column.table_name
        and c.column_name=required_column.column_name
    ) then
      raise exception 'Secure v3 verification failed: missing column public.%.%',
        required_column.table_name, required_column.column_name;
    end if;
  end loop;

  foreach required_table in array array[
    'citl_notifications','visiting_lecturers','term_visiting_lecturers','attendance_scans','security_audit_log',
    'campus_networks','registration_tickets'
  ] loop
    select c.relrowsecurity into rls_enabled
    from pg_class c
    where c.oid = to_regclass('public.' || required_table);
    if coalesce(rls_enabled, false) is not true then
      raise exception 'Secure v3 verification failed: RLS is disabled on public.%', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'meetings_durable_notifications' and not tgisinternal
  ) then
    raise exception 'Secure v3 verification failed: meetings notification trigger is missing';
  end if;

  if not exists (select 1 from pg_trigger where tgname='citl_auth_registration' and not tgisinternal) then
    raise exception 'Secure v3 verification failed: registration trigger is missing';
  end if;
  if to_regprocedure('public.citl_secure_api(text,jsonb)') is null
     or to_regprocedure('public.citl_attendance_scan(text)') is null
     or to_regprocedure('public.citl_presence_track(text,text,text)') is null
     or to_regprocedure('public.citl_prepare_registration(text,jsonb)') is null then
    raise exception 'Secure v3 verification failed: one or more SQL runtime functions are missing';
  end if;

  raise notice 'CITL Secure v3 database installation verified successfully';
end $verify$;
