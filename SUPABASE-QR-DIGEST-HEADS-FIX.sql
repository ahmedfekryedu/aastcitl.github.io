-- CITL surgical fix: pgcrypto lookup for QR + secure department-head deletion.
-- Run this file once in Supabase SQL Editor.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase normally installs pgcrypto in the `extensions` schema.  The
-- protected functions previously searched only public/auth, so digest() could
-- not be resolved while generating or scanning a QR token.
do $fix_search_path$
begin
  if to_regprocedure('public.citl_secure_api(text,jsonb)') is not null then
    execute 'alter function public.citl_secure_api(text,jsonb) set search_path = public, auth, extensions, pg_temp';
  end if;
  if to_regprocedure('public.citl_attendance_scan(text)') is not null then
    execute 'alter function public.citl_attendance_scan(text) set search_path = public, auth, extensions, pg_temp';
  end if;
  if to_regprocedure('public.citl_prepare_registration(text,jsonb)') is not null then
    execute 'alter function public.citl_prepare_registration(text,jsonb) set search_path = public, auth, extensions, pg_temp';
  end if;
  if to_regprocedure('public.citl_prepare_manager_registration(jsonb)') is not null then
    execute 'alter function public.citl_prepare_manager_registration(jsonb) set search_path = public, auth, extensions, pg_temp';
  end if;
  if to_regprocedure('public.citl_finish_registration()') is not null then
    execute 'alter function public.citl_finish_registration() set search_path = public, auth, extensions, pg_temp';
  end if;
end
$fix_search_path$;

create or replace function public.citl_delete_department_head(p_department_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  uid uuid := auth.uid();
  affected integer;
begin
  if uid is null or not public.is_manager() then
    raise exception 'هذه العملية للمدير فقط';
  end if;
  if nullif(trim(coalesce(p_department_key, '')), '') is null then
    raise exception 'القسم مطلوب';
  end if;

  update public.department_heads
     set active = false,
         assigned_by = uid,
         assigned_at = now()
   where department_key = p_department_key
     and active = true;
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'رئيس القسم غير موجود أو محذوف بالفعل';
  end if;

  insert into public.security_audit_log(actor_id, action, entity_type, entity_id)
  values (uid, 'delete', 'department_heads', p_department_key);

  return jsonb_build_object('ok', true, 'department_key', p_department_key);
end
$function$;

revoke all on function public.citl_delete_department_head(text) from public;
grant execute on function public.citl_delete_department_head(text) to authenticated;

notify pgrst, 'reload schema';
commit;
