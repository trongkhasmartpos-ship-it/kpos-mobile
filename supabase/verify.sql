-- KPOS Mobile V8 - Xác minh backend sau khi chạy schema.sql
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
