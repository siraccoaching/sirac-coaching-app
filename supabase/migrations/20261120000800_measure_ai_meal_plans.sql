-- 1. Répétitions, distance ou durée selon l'exercice
alter table public.program_exercises add column if not exists measure text not null default 'reps';
do $$ begin
  alter table public.program_exercises add constraint program_exercises_measure_check check (measure in ('reps', 'distance', 'time'));
exception when duplicate_object then null; end $$;

-- 2. Préférences alimentaires du client (pour le plan généré par l'IA)
alter table public.profiles add column if not exists allergies text[] not null default '{}';
alter table public.profiles add column if not exists kitchen_equipment text[] not null default '{}';
alter table public.profiles add column if not exists diet text;
alter table public.profiles add column if not exists food_dislikes text;

-- 3. Plans alimentaires générés par l'IA (lus par le client et son coach)
create table if not exists public.ai_meal_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  target_kcal int not null,
  days int not null default 1,
  preferences jsonb not null default '{}',
  plan jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_meal_plans_client_idx on public.ai_meal_plans (client_id, created_at desc);
alter table public.ai_meal_plans enable row level security;

do $$ begin
  create policy ai_meal_plans_read on public.ai_meal_plans for select
    using (client_id = (select auth.uid()) or public.is_my_client(client_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ai_meal_plans_delete on public.ai_meal_plans for delete
    using (client_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
-- Pas de politique d'insertion : seule la fonction serveur /api/meal-plan (clé service) écrit dans cette table.
