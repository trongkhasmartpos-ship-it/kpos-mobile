-- KPOS Mobile V8 - Xác minh backend production
-- Chạy file này trong Supabase SQL Editor.

-- 1) Bảng đã tồn tại + RLS bật
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('kpos_profiles','kpos_workspaces','kpos_members','kpos_state')
order by tablename;

-- 2) Policy hiện có
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('kpos_profiles','kpos_workspaces','kpos_members','kpos_state')
order by tablename, policyname;

-- 3) Realtime publication phải có kpos_state
select pubname, schemaname, tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename='kpos_state';

-- 4) Trigger tạo profile/workspace khi signup
select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_name='on_auth_user_created_kpos';

-- 5) Trigger tăng revision khi đồng bộ
select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_name='trg_kpos_touch_state';

-- 6) Số workspace/member/state hiện có
select
  (select count(*) from public.kpos_workspaces) as workspaces,
  (select count(*) from public.kpos_members) as members,
  (select count(*) from public.kpos_state) as state_rows;

-- 7) Cột permissions của nhân viên
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='kpos_members' and column_name='permissions';

-- 8) RPC quản lý nhân viên: anon phải FALSE, authenticated phải TRUE
select
  has_function_privilege('anon','public.kpos_list_members(uuid)','EXECUTE') as anon_list_members,
  has_function_privilege('anon','public.kpos_add_member_by_email(uuid,text,text,jsonb)','EXECUTE') as anon_add_member,
  has_function_privilege('anon','public.kpos_update_member(uuid,uuid,text,jsonb)','EXECUTE') as anon_update_member,
  has_function_privilege('anon','public.kpos_remove_member(uuid,uuid)','EXECUTE') as anon_remove_member,
  has_function_privilege('authenticated','public.kpos_list_members(uuid)','EXECUTE') as auth_list_members,
  has_function_privilege('authenticated','public.kpos_add_member_by_email(uuid,text,text,jsonb)','EXECUTE') as auth_add_member,
  has_function_privilege('authenticated','public.kpos_update_member(uuid,uuid,text,jsonb)','EXECUTE') as auth_update_member,
  has_function_privilege('authenticated','public.kpos_remove_member(uuid,uuid)','EXECUTE') as auth_remove_member;

-- 9) RLS helper không còn nằm trong API public cho anon/authenticated
select
  has_function_privilege('anon','public.is_kpos_workspace_member(uuid)','EXECUTE') as anon_public_member_helper,
  has_function_privilege('authenticated','public.is_kpos_workspace_member(uuid)','EXECUTE') as auth_public_member_helper,
  has_function_privilege('anon','public.is_kpos_workspace_owner(uuid)','EXECUTE') as anon_public_owner_helper,
  has_function_privilege('authenticated','public.is_kpos_workspace_owner(uuid)','EXECUTE') as auth_public_owner_helper;
