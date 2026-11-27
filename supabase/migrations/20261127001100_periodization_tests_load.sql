-- ─────────────────────────────────────────────────────────────────────
-- 1. Exercices : fourchettes, tempo, type de bloc, unités, progression semaine par semaine
-- ─────────────────────────────────────────────────────────────────────
alter table public.program_exercises add column if not exists sets_text text;      -- « 2 → 3 », « 3RM + 2 × 3 »
alter table public.program_exercises add column if not exists rpe_text text;       -- « 7-8 »
alter table public.program_exercises add column if not exists rest_text text;      -- « 2-3 min », « retour marché »
alter table public.program_exercises add column if not exists tempo text;          -- « 3-0-1-0 »
alter table public.program_exercises add column if not exists block_type text;     -- terrain | salle | prevention | conditionnement
alter table public.program_exercises add column if not exists week_overrides jsonb not null default '{}'; -- { "1": {sets, reps, load, rpe, note}, ... }
alter table public.program_exercises add column if not exists track_velocity boolean not null default false;
do $$ begin
  alter table public.program_exercises add constraint program_exercises_block_type_check check (block_type in ('terrain', 'salle', 'prevention', 'conditionnement'));
exception when duplicate_object then null; end $$;
alter table public.program_exercises drop constraint if exists program_exercises_measure_check;
alter table public.program_exercises add constraint program_exercises_measure_check check (measure in ('reps', 'distance', 'yards', 'time', 'minutes'));

-- Étiquettes de semaine dans une phase : { "4": "Décharge", "10": "Tests" }
alter table public.program_blocks add column if not exists week_labels jsonb not null default '{}';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Calendrier : date de début du programme pour chaque client, matchs et événements
-- ─────────────────────────────────────────────────────────────────────
alter table public.program_assignments add column if not exists start_date date;

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  type text not null default 'match' check (type in ('match', 'bye', 'test', 'autre')),
  label text,
  created_at timestamptz not null default now()
);
create index if not exists client_events_client_date_idx on public.client_events (client_id, date);
alter table public.client_events enable row level security;
do $$ begin
  create policy client_events_select on public.client_events for select to authenticated
    using (client_id = (select auth.uid()) or public.is_my_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy client_events_write on public.client_events for all to authenticated
    using (public.is_my_client(client_id)) with check (public.is_my_client(client_id));
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Séance réalisée : durée, lancers, GPS (la charge = RPE × durée)
-- ─────────────────────────────────────────────────────────────────────
alter table public.session_completions add column if not exists throws int;
alter table public.session_completions add column if not exists gps jsonb;            -- { distance_m, hsr_m, vmax_kmh, accels }
alter table public.session_completions add column if not exists phase_week int;      -- semaine du programme au moment de la séance

-- ─────────────────────────────────────────────────────────────────────
-- 4. Tests de performance (1RM, sauts, sprints, ischios…) et maximums servant au calcul des charges
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.performance_tests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  test_key text not null,          -- ex. 'squat_1rm', 'cmj', 'sprint_10yd' ou 'rm:<nom d'exercice>'
  label text,
  value numeric not null,
  value2 numeric,                  -- 2e valeur (ex. jambe droite pour les ischios)
  unit text,
  reps int,                        -- pour un xRM : nombre de répétitions (1RM estimé calculé)
  tested_at date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists performance_tests_client_idx on public.performance_tests (client_id, test_key, tested_at desc);
alter table public.performance_tests enable row level security;
do $$ begin
  create policy performance_tests_select on public.performance_tests for select to authenticated
    using (client_id = (select auth.uid()) or public.is_my_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy performance_tests_write on public.performance_tests for all to authenticated
    using (client_id = (select auth.uid()) or public.is_my_client(client_id))
    with check (client_id = (select auth.uid()) or public.is_my_client(client_id));
exception when duplicate_object then null; end $$;
