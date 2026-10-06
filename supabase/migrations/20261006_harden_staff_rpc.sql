-- Harden KPOS staff RPC permissions and hide RLS helper functions from the exposed public API.
create schema if not exists kpos_private;
revoke all on schema kpos_private from public;
grant usage on schema kpos_private to authenticated;

create or replace function kpos_private.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.kpos_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
  );
$$;

create or replace function kpos_private.is_workspace_owner(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.kpos_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

revoke all on function kpos_private.is_workspace_member(uuid) from public, anon;
revoke all on function kpos_private.is_workspace_owner(uuid) from public, anon;
grant execute on function kpos_private.is_workspace_member(uuid) to authenticated;
grant execute on function kpos_private.is_workspace_owner(uuid) to authenticated;

drop policy if exists "workspace member read" on public.kpos_workspaces;
create policy "workspace member read" on public.kpos_workspaces
for select to authenticated using (kpos_private.is_workspace_member(id));

drop policy if exists "members read own workspace" on public.kpos_members;
create policy "members read own workspace" on public.kpos_members
for select to authenticated using (kpos_private.is_workspace_member(workspace_id));

drop policy if exists "owner manages members" on public.kpos_members;
create policy "owner manages members" on public.kpos_members
for all to authenticated
using (kpos_private.is_workspace_owner(workspace_id))
with check (kpos_private.is_workspace_owner(workspace_id));

drop policy if exists "state member read" on public.kpos_state;
create policy "state member read" on public.kpos_state
for select to authenticated using (kpos_private.is_workspace_member(workspace_id));

drop policy if exists "state member insert" on public.kpos_state;
create policy "state member insert" on public.kpos_state
for insert to authenticated with check (kpos_private.is_workspace_member(workspace_id));

drop policy if exists "state member update" on public.kpos_state;
create policy "state member update" on public.kpos_state
for update to authenticated
using (kpos_private.is_workspace_member(workspace_id))
with check (kpos_private.is_workspace_member(workspace_id));

revoke all on function public.is_kpos_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_kpos_workspace_owner(uuid) from public, anon, authenticated;

create or replace function public.kpos_list_members(p_workspace uuid)
returns table(user_id uuid,email text,display_name text,role text,permissions jsonb,created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, kpos_private
as $$
declare v_caller_role text;
begin
  select m.role into v_caller_role
  from public.kpos_members m
  where m.workspace_id=p_workspace and m.user_id=auth.uid();
  if v_caller_role not in ('owner','manager') then
    raise exception 'Chỉ chủ cửa hàng hoặc quản lý được xem danh sách nhân viên';
  end if;
  return query
  select m.user_id,p.email,p.display_name,m.role,coalesce(m.permissions,'{}'::jsonb),m.created_at
  from public.kpos_members m
  left join public.kpos_profiles p on p.id=m.user_id
  where m.workspace_id=p_workspace
  order by case m.role when 'owner' then 1 when 'manager' then 2 else 3 end,m.created_at;
end;
$$;

revoke all on function public.kpos_list_members(uuid) from public, anon;
revoke all on function public.kpos_add_member_by_email(uuid,text,text,jsonb) from public, anon;
revoke all on function public.kpos_update_member(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.kpos_remove_member(uuid,uuid) from public, anon;

grant execute on function public.kpos_list_members(uuid) to authenticated;
grant execute on function public.kpos_add_member_by_email(uuid,text,text,jsonb) to authenticated;
grant execute on function public.kpos_update_member(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.kpos_remove_member(uuid,uuid) to authenticated;
