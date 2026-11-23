-- 1. Un même programme pour plusieurs clients (un seul programme actif par client)
create table if not exists public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);
create index if not exists program_assignments_program_idx on public.program_assignments (program_id);

-- reprise des rattachements existants
insert into public.program_assignments (program_id, client_id)
select p.id, p.client_id from public.programs p
where p.client_id is not null
  and p.created_at = (select max(p2.created_at) from public.programs p2 where p2.client_id = p.client_id)
on conflict (client_id) do nothing;
-- le rattachement passe désormais uniquement par program_assignments
update public.programs set client_id = null where client_id is not null;

alter table public.program_assignments enable row level security;
do $$ begin
  create policy program_assignments_select on public.program_assignments for select to authenticated
    using (client_id = (select auth.uid()) or public.owns_program(program_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy program_assignments_write on public.program_assignments for all to authenticated
    using (public.owns_program(program_id))
    with check (public.owns_program(program_id) and public.is_my_client(client_id));
exception when duplicate_object then null; end $$;

-- lecture du programme (et de ses séances / exercices) par tous les clients assignés
create or replace function public.can_read_program(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.programs p
    where p.id = pid and (p.coach_id = auth.uid() or p.client_id = auth.uid()))
  or exists (select 1 from public.program_assignments a where a.program_id = pid and a.client_id = auth.uid())
$$;

alter policy programs_select on public.programs
  using (coach_id = (select auth.uid()) or client_id = (select auth.uid())
         or exists (select 1 from public.program_assignments a where a.program_id = programs.id and a.client_id = (select auth.uid())));

-- 2. Planning du client : ses séances placées sur les jours de son choix
create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  program_session_id uuid not null references public.program_sessions(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_sessions_client_date_idx on public.scheduled_sessions (client_id, date);
create index if not exists scheduled_sessions_session_idx on public.scheduled_sessions (program_session_id);
alter table public.scheduled_sessions enable row level security;
do $$ begin
  create policy scheduled_sessions_select on public.scheduled_sessions for select to authenticated
    using (client_id = (select auth.uid()) or public.is_my_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy scheduled_sessions_write on public.scheduled_sessions for all to authenticated
    using (client_id = (select auth.uid()))
    with check (client_id = (select auth.uid()) and public.can_read_program(public.session_program(program_session_id)));
exception when duplicate_object then null; end $$;

do $$ begin
  begin alter publication supabase_realtime add table public.program_assignments; exception when others then null; end;
end $$;
