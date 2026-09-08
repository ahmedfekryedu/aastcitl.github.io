-- READ ONLY. Run before/after migration on a copy of the actual database.
-- Inventory only: review the results; this is not a full compatibility guarantee.
begin read only;
select wanted.name, to_regclass('public.'||wanted.name) is not null as exists_in_database
from unnest(array['academic_schedule','access_codes','active_tv_posters','attendance_network_ranges','exam_schedule','faculty_directory','lecture_presence_logs','meetings','page_visits','profiles','rooms','schedule_actions','schedule_report_batch_items','schedule_report_batches','schedule_terms','settings','site_settings','tv_posters','user_presence_sessions'])wanted(name);
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select c.relname as relation,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p') order by c.relname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
select p.oid::regprocedure::text as function_name,p.prosecdef as security_definer,p.proconfig as settings from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and(p.proname like 'citl_%'or p.proname in('is_manager','protect_profile_security_fields','protect_meeting_approval_fields'))order by function_name;
select c.conrelid::regclass::text as relation,c.conname,pg_get_constraintdef(c.oid)as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'order by relation,c.conname;
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime'order by tablename;
commit;
