-- TEST FIXTURE ONLY: incomplete synthetic baseline for in-memory PGlite. NEVER run on a real Supabase project.
-- SYNTHETIC test schema only; this is NOT a production baseline/export.
create role anon;create role authenticated;
create schema auth;create schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(),email text,raw_user_meta_data jsonb default '{}');
create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid()to anon,authenticated;
create table profiles(id uuid primary key references auth.users on delete cascade,email text,full_name text,mobile text,position text,department text,role text default 'user',permissions jsonb default '{}',account_type text,linked_instructors text[],schedule_link_required boolean,schedule_link_status text,last_link_prompt_at timestamptz,created_at timestamptz default now());
create table academic_schedule(id text primary key default gen_random_uuid()::text,instructor text,course_name text,course_code text,room_name text,day_of_week text,time_slot text,status text default 'active',period_order int default 1,cancelled_dates text[]default '{}');
create table access_codes(id bigint generated always as identity primary key,code text unique);
create table rooms(id uuid primary key default gen_random_uuid(),name text,capacity int,equipment text,created_at timestamptz default now());
create table meetings(id uuid primary key default gen_random_uuid(),user_id uuid references profiles on delete cascade,room_id uuid references rooms,title text,department text,date date,start_time time,end_time time,description text,attendees text,status text,pending_changes jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table faculty_directory(id bigint generated always as identity primary key,full_name text,department_key text,position text,is_active boolean default true,profile_id uuid references profiles,email text,mobile text,linked_at timestamptz,updated_at timestamptz);
create table schedule_actions(id bigint generated always as identity primary key,schedule_id text,action_date date,action_type text,reason text,replacement_instructor text,replacement_room text,created_by text,created_at timestamptz default now());
create table schedule_report_batches(id bigint generated always as identity primary key,created_at timestamptz default now(),report_code text,from_date date,to_date date,action_type_value text,action_type_label text,department_key text,department_label text,faculty_member_name text,created_by_filter_value text,created_by_filter_label text,generated_by_user_id uuid,generated_by_name text,total_rows int,output_mode text,output_status text,snapshot_json jsonb);
create table schedule_report_batch_items(id bigint generated always as identity primary key,batch_id bigint references schedule_report_batches on delete cascade,schedule_action_id bigint,serial_no int);
create table schedule_terms(id bigint generated always as identity primary key,name text,is_active boolean);
create table settings(id int primary key,start_hour int,end_hour int);
create table site_settings(setting_key text primary key,setting_value jsonb);
create table tv_posters(id uuid primary key default gen_random_uuid(),title text,image_url text,is_active boolean,display_order int,duration int,fit_mode text,play_sound boolean,created_at timestamptz default now());
create view active_tv_posters as select *from tv_posters where is_active;
create table exam_schedule(id bigint generated always as identity primary key,exam_date date,start_time time,end_time time,course_name text,instructor text,room_name text);
create table attendance_network_ranges(label text,network_cidr cidr,is_active boolean,inside_campus boolean);
create table lecture_presence_logs(id bigint generated always as identity primary key);
create table page_visits(id bigint generated always as identity primary key,created_at timestamptz default now());
create table user_presence_sessions(id uuid primary key default gen_random_uuid(),user_id uuid,user_email text,user_name text,account_type text,user_role text,started_at timestamptz,last_seen_at timestamptz,ended_at timestamptz,is_online boolean,source_page text);
create publication supabase_realtime;
grant select on profiles to authenticated;
grant usage,select on all sequences in schema public to authenticated;
