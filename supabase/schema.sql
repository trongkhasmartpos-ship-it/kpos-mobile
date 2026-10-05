-- KPOS Mobile V8 - Supabase backend
-- Auth + workspace + online JSON state sync + realtime.

create extension if not exists pgcrypto;

create table if not exists public.kpos_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpos_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'KPOS',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpos_members (
  workspace_id uuid not null references public.kpos_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.kpos_state (
  workspace_id uuid primary key references public.kpos_workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.kpos_touch_state()
returns trigger
language plpgsql
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_kpos_touch_state on public.kpos_state;
create trigger trg_kpos_touch_state
before update on public.kpos_state
for each row execute function public.kpos_touch_state();

create or replace function public.is_kpos_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kpos_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_kpos_workspace_owner(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.kpos_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

alter table public.kpos_profiles enable row level security;
alter table public.kpos_workspaces enable row level security;
alter table public.kpos_members enable row level security;
alter table public.kpos_state enable row level security;

drop policy if exists "profile self read" on public.kpos_profiles;
create policy "profile self read" on public.kpos_profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "profile self update" on public.kpos_profiles;
create policy "profile self update" on public.kpos_profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "workspace member read" on public.kpos_workspaces;
create policy "workspace member read" on public.kpos_workspaces
for select to authenticated using (public.is_kpos_workspace_member(id));

drop policy if exists "members read own workspace" on public.kpos_members;
create policy "members read own workspace" on public.kpos_members
for select to authenticated using (public.is_kpos_workspace_member(workspace_id));

drop policy if exists "owner manages members" on public.kpos_members;
create policy "owner manages members" on public.kpos_members
for all to authenticated
using (public.is_kpos_workspace_owner(workspace_id))
with check (public.is_kpos_workspace_owner(workspace_id));

drop policy if exists "state member read" on public.kpos_state;
create policy "state member read" on public.kpos_state
for select to authenticated using (public.is_kpos_workspace_member(workspace_id));

drop policy if exists "state member insert" on public.kpos_state;
create policy "state member insert" on public.kpos_state
for insert to authenticated with check (public.is_kpos_workspace_member(workspace_id));

drop policy if exists "state member update" on public.kpos_state;
create policy "state member update" on public.kpos_state
for update to authenticated
using (public.is_kpos_workspace_member(workspace_id))
with check (public.is_kpos_workspace_member(workspace_id));

create or replace function public.handle_kpos_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
begin
  insert into public.kpos_profiles(id,email,display_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;

  insert into public.kpos_workspaces(name,owner_id)
  values('KPOS',new.id)
  returning id into v_workspace;

  insert into public.kpos_members(workspace_id,user_id,role)
  values(v_workspace,new.id,'owner');

  insert into public.kpos_state(workspace_id,data,updated_by)
  values(v_workspace,'{}'::jsonb,new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kpos on auth.users;
create trigger on_auth_user_created_kpos
after insert on auth.users
for each row execute function public.handle_kpos_new_user();

-- Backfill workspace for existing auth users that do not yet have one.
do $$
declare
  u record;
  w uuid;
begin
  for u in
    select au.id, au.email
    from auth.users au
    where not exists(select 1 from public.kpos_members km where km.user_id = au.id)
  loop
    insert into public.kpos_profiles(id,email,display_name)
    values(u.id,u.email,split_part(coalesce(u.email,''),'@',1))
    on conflict (id) do nothing;

    insert into public.kpos_workspaces(name,owner_id) values('KPOS',u.id) returning id into w;
    insert into public.kpos_members(workspace_id,user_id,role) values(w,u.id,'owner');
    insert into public.kpos_state(workspace_id,data,updated_by) values(w,'{}'::jsonb,u.id);
  end loop;
end $$;

-- Realtime for multi-device sync.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='kpos_state'
  ) then
    alter publication supabase_realtime add table public.kpos_state;
  end if;
end $$;
