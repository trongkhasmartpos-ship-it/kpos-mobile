-- KPOS staff / role permission backend
alter table public.kpos_members
  add column if not exists permissions jsonb not null default '{"pos":true,"products":true,"inventory":true,"customers":true,"crm":true,"warranty":true,"debts":true,"reports":false,"settings":false}'::jsonb;

create or replace function public.kpos_list_members(p_workspace uuid)
returns table(user_id uuid,email text,display_name text,role text,permissions jsonb,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_kpos_workspace_member(p_workspace) then raise exception 'Không có quyền truy cập workspace'; end if;
  return query select m.user_id,p.email,p.display_name,m.role,coalesce(m.permissions,'{}'::jsonb),m.created_at
  from public.kpos_members m left join public.kpos_profiles p on p.id=m.user_id
  where m.workspace_id=p_workspace
  order by case m.role when 'owner' then 1 when 'manager' then 2 else 3 end,m.created_at;
end;$$;

create or replace function public.kpos_add_member_by_email(p_workspace uuid,p_email text,p_role text default 'staff',p_permissions jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_caller_role text; v_user uuid;
begin
  select m.role into v_caller_role from public.kpos_members m where m.workspace_id=p_workspace and m.user_id=auth.uid();
  if v_caller_role not in ('owner','manager') then raise exception 'Chỉ chủ cửa hàng hoặc quản lý được thêm nhân viên'; end if;
  if p_role not in ('manager','staff') then raise exception 'Vai trò không hợp lệ'; end if;
  if v_caller_role='manager' and p_role<>'staff' then raise exception 'Quản lý chỉ được thêm nhân viên'; end if;
  select u.id into v_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'Email này chưa có tài khoản KPOS. Hãy tạo tài khoản trước rồi thêm lại.'; end if;
  insert into public.kpos_members(workspace_id,user_id,role,permissions)
  values(p_workspace,v_user,p_role,coalesce(p_permissions,'{}'::jsonb))
  on conflict(workspace_id,user_id) do update set role=excluded.role,permissions=excluded.permissions;
  return v_user;
end;$$;

create or replace function public.kpos_update_member(p_workspace uuid,p_user uuid,p_role text,p_permissions jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_caller_role text; v_target_role text;
begin
  select m.role into v_caller_role from public.kpos_members m where m.workspace_id=p_workspace and m.user_id=auth.uid();
  select m.role into v_target_role from public.kpos_members m where m.workspace_id=p_workspace and m.user_id=p_user;
  if v_caller_role not in ('owner','manager') then raise exception 'Không có quyền cập nhật nhân viên'; end if;
  if v_target_role='owner' then raise exception 'Không thể thay đổi quyền chủ cửa hàng'; end if;
  if p_role not in ('manager','staff') then raise exception 'Vai trò không hợp lệ'; end if;
  if v_caller_role='manager' and (v_target_role<>'staff' or p_role<>'staff') then raise exception 'Quản lý chỉ được cập nhật nhân viên'; end if;
  update public.kpos_members set role=p_role,permissions=coalesce(p_permissions,'{}'::jsonb) where workspace_id=p_workspace and user_id=p_user;
end;$$;

create or replace function public.kpos_remove_member(p_workspace uuid,p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_caller_role text; v_target_role text;
begin
  select m.role into v_caller_role from public.kpos_members m where m.workspace_id=p_workspace and m.user_id=auth.uid();
  select m.role into v_target_role from public.kpos_members m where m.workspace_id=p_workspace and m.user_id=p_user;
  if v_caller_role not in ('owner','manager') then raise exception 'Không có quyền xóa nhân viên'; end if;
  if v_target_role='owner' then raise exception 'Không thể xóa chủ cửa hàng'; end if;
  if v_caller_role='manager' and v_target_role<>'staff' then raise exception 'Quản lý chỉ được xóa nhân viên'; end if;
  delete from public.kpos_members where workspace_id=p_workspace and user_id=p_user;
end;$$;

grant execute on function public.kpos_list_members(uuid) to authenticated;
grant execute on function public.kpos_add_member_by_email(uuid,text,text,jsonb) to authenticated;
grant execute on function public.kpos_update_member(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.kpos_remove_member(uuid,uuid) to authenticated;
