-- 1) Photos de progression : espace PRIVÉ. Lecture réservée au client (son dossier) et à son coach.
update storage.buckets set public = false where id = 'client-photos';

drop policy if exists client_photos_read on storage.objects;
create policy client_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'client-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_my_client(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists client_photos_delete on storage.objects;
create policy client_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2) Index sur les clés étrangères (recommandés par Supabase pour garder l'app rapide quand les données grossissent)
create index if not exists client_measurements_client_idx on public.client_measurements(client_id, measured_at desc);
create index if not exists exercise_logs_exercise_idx on public.exercise_logs(exercise_id);
create index if not exists exercise_logs_library_idx on public.exercise_logs(library_exercise_id);
create index if not exists messages_receiver_idx on public.messages(receiver_id, read_at);
create index if not exists nutrition_foods_meal_idx on public.nutrition_foods(meal_id);
create index if not exists nutrition_meals_plan_idx on public.nutrition_meals(plan_id);
create index if not exists nutrition_plans_client_idx on public.nutrition_plans(client_id);
create index if not exists nutrition_plans_coach_idx on public.nutrition_plans(coach_id);
create index if not exists program_blocks_program_idx on public.program_blocks(program_id);
create index if not exists program_exercises_exercise_idx on public.program_exercises(exercise_id);
create index if not exists program_exercises_session_idx on public.program_exercises(session_id);
create index if not exists program_sessions_block_idx on public.program_sessions(block_id);
create index if not exists program_sessions_program_idx on public.program_sessions(program_id);
create index if not exists programs_coach_idx on public.programs(coach_id);
create index if not exists session_completions_psession_idx on public.session_completions(program_session_id);
create index if not exists session_logs_session_idx on public.session_logs(session_id);
create index if not exists sessions_client_idx on public.sessions(client_id);
create index if not exists weekly_checkins_client_idx on public.weekly_checkins(client_id, week_start desc);
