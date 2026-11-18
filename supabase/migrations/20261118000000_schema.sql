-- =====================================================================
-- SIRAC COACHING APP – Schéma complet Supabase
-- À exécuter UNE fois dans Supabase > SQL Editor (projet neuf).
-- Ensuite exécuter 20261118000100_seed_exercises.sql et
-- 20261118000200_seed_foods.sql pour remplir les bases d'exercices / aliments.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PROFILS (coach + clients)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'client' check (role in ('coach', 'client')),
  coach_id uuid references public.profiles(id) on delete set null,
  sport text,
  position text,
  current_phase text default 'Hors-Saison',
  pr_bench numeric, pr_squat numeric, pr_deadlift numeric, speed_40y numeric,
  -- infos coach
  invite_code text unique,
  calendly_url text,
  -- infos client
  height numeric,
  weight numeric,
  birth_date date,
  sex text,
  activity_level text,
  goals text,
  injury_history text,
  level text,
  training_frequency text,
  onboarding_notes text,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_coach_idx on public.profiles(coach_id);

-- Fonctions utilitaires (security definer => pas de récursion RLS)
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
$$;

create or replace function public.my_coach_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coach_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_my_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = cid and coach_id = auth.uid())
$$;

-- Création automatique du profil à l'inscription (rôle toujours "client" ;
-- le compte coach est promu à la main via SQL, cf. guide).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid;
begin
  if new.raw_user_meta_data ? 'invite_code' then
    select id into v_coach from public.profiles
    where invite_code = new.raw_user_meta_data->>'invite_code' and role = 'coach';
  end if;
  insert into public.profiles (id, name, email, role, coach_id, sport, position)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'client',
    v_coach,
    new.raw_user_meta_data->>'sport',
    new.raw_user_meta_data->>'position'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protège les champs sensibles : seul le service (SQL/API admin) change le rôle,
-- et seul un coach peut rattacher / détacher un client.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- SQL editor / service role
  if new.role is distinct from old.role then
    raise exception 'Changement de rôle interdit';
  end if;
  if new.coach_id is distinct from old.coach_id then
    if not public.is_coach() then
      raise exception 'Seul un coach peut modifier le rattachement';
    end if;
    if new.coach_id is not null and new.coach_id <> auth.uid() then
      raise exception 'Un coach ne peut rattacher un client qu''à lui-même';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Lecture publique minimale du coach à partir d'un code d'invitation (page /join)
create or replace function public.get_coach_by_invite(code text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.profiles where invite_code = code and role = 'coach' limit 1
$$;
grant execute on function public.get_coach_by_invite(text) to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or coach_id = auth.uid()
  or id = public.my_coach_id()
  or (public.is_coach() and role = 'client' and coach_id is null)
);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'client');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or coach_id = auth.uid()
    or (public.is_coach() and role = 'client' and coach_id is null)
  )
  with check (id = auth.uid() or coach_id = auth.uid() or coach_id is null);

-- ---------------------------------------------------------------------
-- BIBLIOTHÈQUE D'EXERCICES
-- coach_id NULL = base commune pré-remplie (lecture seule)
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  slug text unique,
  name text not null,
  name_en text,
  category text,
  muscles text,
  secondary_muscles text,
  equipment text,
  level text,
  description text,
  instructions text[],
  images text[],
  video_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists exercises_coach_idx on public.exercises(coach_id);
create index if not exists exercises_name_idx on public.exercises(name);

alter table public.exercises enable row level security;
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated using (
  coach_id is null or coach_id = auth.uid() or coach_id = public.my_coach_id()
);
drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises for all to authenticated
  using (coach_id = auth.uid() and public.is_coach())
  with check (coach_id = auth.uid() and public.is_coach());

-- ---------------------------------------------------------------------
-- PROGRAMMES
-- ---------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  type text not null default 'block' check (type in ('block', 'simple')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.programs drop constraint if exists programs_client_id_fkey;
alter table public.programs add constraint programs_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete set null;
create index if not exists programs_client_idx on public.programs(client_id);

create table if not exists public.program_blocks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  description text,
  duration_weeks int not null default 1,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  block_id uuid references public.program_blocks(id) on delete cascade,
  name text not null,
  notes text,
  day_number int,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.program_sessions drop constraint if exists program_sessions_program_id_fkey;
alter table public.program_sessions add constraint program_sessions_program_id_fkey
  foreign key (program_id) references public.programs(id) on delete cascade;

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.program_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  sets int not null default 3,
  reps text default '8',
  load text,
  rpe numeric,
  rest_seconds int default 120,
  notes text,
  video_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.can_read_program(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.programs p
    where p.id = pid and (p.coach_id = auth.uid() or p.client_id = auth.uid()))
$$;
create or replace function public.owns_program(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.programs p where p.id = pid and p.coach_id = auth.uid())
$$;
create or replace function public.session_program(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select program_id from public.program_sessions where id = sid
$$;

alter table public.programs enable row level security;
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs for select to authenticated
  using (coach_id = auth.uid() or client_id = auth.uid());
drop policy if exists programs_write on public.programs;
create policy programs_write on public.programs for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach()
              and (client_id is null or public.is_my_client(client_id)));

alter table public.program_blocks enable row level security;
drop policy if exists blocks_select on public.program_blocks;
create policy blocks_select on public.program_blocks for select to authenticated using (public.can_read_program(program_id));
drop policy if exists blocks_write on public.program_blocks;
create policy blocks_write on public.program_blocks for all to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

alter table public.program_sessions enable row level security;
drop policy if exists psessions_select on public.program_sessions;
create policy psessions_select on public.program_sessions for select to authenticated using (public.can_read_program(program_id));
drop policy if exists psessions_write on public.program_sessions;
create policy psessions_write on public.program_sessions for all to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

alter table public.program_exercises enable row level security;
drop policy if exists pex_select on public.program_exercises;
create policy pex_select on public.program_exercises for select to authenticated
  using (public.can_read_program(public.session_program(session_id)));
drop policy if exists pex_write on public.program_exercises;
create policy pex_write on public.program_exercises for all to authenticated
  using (public.owns_program(public.session_program(session_id)))
  with check (public.owns_program(public.session_program(session_id)));

-- ---------------------------------------------------------------------
-- SÉANCES RÉALISÉES (suivi)
-- ---------------------------------------------------------------------
create table if not exists public.session_completions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  program_session_id uuid references public.program_sessions(id) on delete set null,
  notes text,
  rpe_session numeric,
  wellbeing_note text,
  session_rating jsonb,
  duration_minutes int,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists completions_client_idx on public.session_completions(client_id, created_at desc);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.session_completions(id) on delete cascade,
  exercise_id uuid references public.program_exercises(id) on delete set null,
  library_exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text,
  set_data jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists exercise_logs_completion_idx on public.exercise_logs(completion_id);

create or replace function public.completion_client(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.session_completions where id = cid
$$;

alter table public.session_completions enable row level security;
drop policy if exists comp_client on public.session_completions;
create policy comp_client on public.session_completions for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists comp_coach_read on public.session_completions;
create policy comp_coach_read on public.session_completions for select to authenticated
  using (public.is_my_client(client_id));
drop policy if exists comp_coach_delete on public.session_completions;
create policy comp_coach_delete on public.session_completions for delete to authenticated
  using (public.is_my_client(client_id));

alter table public.exercise_logs enable row level security;
drop policy if exists logs_client on public.exercise_logs;
create policy logs_client on public.exercise_logs for all to authenticated
  using (public.completion_client(completion_id) = auth.uid())
  with check (public.completion_client(completion_id) = auth.uid());
drop policy if exists logs_coach_read on public.exercise_logs;
create policy logs_coach_read on public.exercise_logs for select to authenticated
  using (public.is_my_client(public.completion_client(completion_id)));
drop policy if exists logs_coach_delete on public.exercise_logs;
create policy logs_coach_delete on public.exercise_logs for delete to authenticated
  using (public.is_my_client(public.completion_client(completion_id)));

-- Anciennes séances (compatibilité avec les pages historiques)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  status text not null default 'planned',
  session_date date default current_date,
  day_number int default 1,
  day_title text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.sessions drop constraint if exists sessions_client_id_fkey;
alter table public.sessions add constraint sessions_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

create table if not exists public.session_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_name text,
  sets_done int, reps_done int, weight_kg numeric, rpe_actual numeric,
  comment text,
  created_at timestamptz not null default now()
);

create or replace function public.legacy_session_client(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.sessions where id = sid
$$;

alter table public.sessions enable row level security;
drop policy if exists sessions_access on public.sessions;
create policy sessions_access on public.sessions for all to authenticated
  using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));
alter table public.session_logs enable row level security;
drop policy if exists slogs_access on public.session_logs;
create policy slogs_access on public.session_logs for all to authenticated
  using (public.legacy_session_client(session_id) = auth.uid() or public.is_my_client(public.legacy_session_client(session_id)))
  with check (public.legacy_session_client(session_id) = auth.uid() or public.is_my_client(public.legacy_session_client(session_id)));

-- ---------------------------------------------------------------------
-- MENSURATIONS & BILANS
-- ---------------------------------------------------------------------
create table if not exists public.client_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  measured_at date not null default current_date,
  weight numeric, body_fat numeric, muscle_mass numeric,
  waist numeric, hips numeric, chest numeric, arms numeric, thighs numeric,
  notes text,
  photo_before_url text, photo_after_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  training_rating int, energy_level int, sleep_quality int, stress_level int,
  notes text,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

alter table public.client_measurements enable row level security;
drop policy if exists meas_client on public.client_measurements;
create policy meas_client on public.client_measurements for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists meas_coach on public.client_measurements;
create policy meas_coach on public.client_measurements for select to authenticated
  using (public.is_my_client(client_id));

alter table public.weekly_checkins enable row level security;
drop policy if exists chk_client on public.weekly_checkins;
create policy chk_client on public.weekly_checkins for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists chk_coach on public.weekly_checkins;
create policy chk_coach on public.weekly_checkins for select to authenticated
  using (public.is_my_client(client_id));

-- ---------------------------------------------------------------------
-- MESSAGERIE
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_pair_idx on public.messages(sender_id, receiver_id, created_at);

alter table public.messages enable row level security;
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_my_client(receiver_id) or receiver_id = public.my_coach_id()));
drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update to authenticated
  using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- ---------------------------------------------------------------------
-- NUTRITION
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid,
  name text not null,
  calories_target numeric default 0,
  protein_target numeric default 0,
  carbs_target numeric default 0,
  fat_target numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.nutrition_plans drop constraint if exists nutrition_plans_client_id_fkey;
alter table public.nutrition_plans add constraint nutrition_plans_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete set null;

create table if not exists public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.nutrition_meals(id) on delete cascade,
  name text not null,
  quantity numeric default 100,
  unit text default 'g',
  calories numeric default 0, protein numeric default 0, carbs numeric default 0, fat numeric default 0,
  created_at timestamptz not null default now()
);

-- Journal alimentaire du client
create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  meal_name text,
  food_name text not null,
  quantity numeric default 100,
  unit text default 'g',
  calories numeric default 0, protein numeric default 0, carbs numeric default 0, fat numeric default 0,
  barcode text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists nutrition_logs_client_date_idx on public.nutrition_logs(client_id, date);

-- Table d'aliments de référence (valeurs pour 100 g)
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  calories numeric not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric default 0,
  portion_g numeric,
  portion_label text
);

create or replace function public.plan_coach(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coach_id from public.nutrition_plans where id = pid
$$;
create or replace function public.plan_client(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.nutrition_plans where id = pid
$$;
create or replace function public.meal_plan(mid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select plan_id from public.nutrition_meals where id = mid
$$;

alter table public.nutrition_plans enable row level security;
drop policy if exists nplans_select on public.nutrition_plans;
create policy nplans_select on public.nutrition_plans for select to authenticated
  using (coach_id = auth.uid() or client_id = auth.uid());
drop policy if exists nplans_write on public.nutrition_plans;
create policy nplans_write on public.nutrition_plans for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach() and (client_id is null or public.is_my_client(client_id)));

alter table public.nutrition_meals enable row level security;
drop policy if exists nmeals_select on public.nutrition_meals;
create policy nmeals_select on public.nutrition_meals for select to authenticated
  using (public.plan_coach(plan_id) = auth.uid() or public.plan_client(plan_id) = auth.uid());
drop policy if exists nmeals_write on public.nutrition_meals;
create policy nmeals_write on public.nutrition_meals for all to authenticated
  using (public.plan_coach(plan_id) = auth.uid()) with check (public.plan_coach(plan_id) = auth.uid());

alter table public.nutrition_foods enable row level security;
drop policy if exists nfoods_select on public.nutrition_foods;
create policy nfoods_select on public.nutrition_foods for select to authenticated
  using (public.plan_coach(public.meal_plan(meal_id)) = auth.uid() or public.plan_client(public.meal_plan(meal_id)) = auth.uid());
drop policy if exists nfoods_write on public.nutrition_foods;
create policy nfoods_write on public.nutrition_foods for all to authenticated
  using (public.plan_coach(public.meal_plan(meal_id)) = auth.uid())
  with check (public.plan_coach(public.meal_plan(meal_id)) = auth.uid());

alter table public.nutrition_logs enable row level security;
drop policy if exists nlogs_client on public.nutrition_logs;
create policy nlogs_client on public.nutrition_logs for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists nlogs_coach on public.nutrition_logs;
create policy nlogs_coach on public.nutrition_logs for select to authenticated
  using (public.is_my_client(client_id));

alter table public.food_items enable row level security;
drop policy if exists food_items_read on public.food_items;
create policy food_items_read on public.food_items for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS PUSH
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  subscription text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- TEMPS RÉEL (alertes coach quand une séance est terminée)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.session_completions; exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.sessions; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- STOCKAGE : photos de progression (bucket public, dossier = id du client)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', true)
on conflict (id) do nothing;

drop policy if exists client_photos_insert on storage.objects;
create policy client_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists client_photos_update on storage.objects;
create policy client_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists client_photos_read on storage.objects;
create policy client_photos_read on storage.objects for select using (bucket_id = 'client-photos');
