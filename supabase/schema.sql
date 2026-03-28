-- SIRAC COACHING APP – Schéma Supabase

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null, email text not null,
  role text check (role in ('coach', 'client')) not null default 'client',
  sport text, position text, current_phase text default 'Hors-Saison',
  coach_id uuid references public.profiles(id) on delete set null,
  pr_bench numeric, pr_squat numeric, pr_deadlift numeric, speed_40y numeric,
  created_at timestamptz default now()
);
