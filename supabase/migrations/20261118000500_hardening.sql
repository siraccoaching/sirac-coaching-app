-- Durcissement : les fonctions internes ne sont pas appelables par les visiteurs non connectés,
-- et les fonctions de trigger ne sont appelables par personne via l'API.
revoke execute on function public.is_coach(), public.my_coach_id(), public.is_my_client(uuid),
  public.can_read_program(uuid), public.owns_program(uuid), public.session_program(uuid),
  public.completion_client(uuid), public.legacy_session_client(uuid),
  public.plan_coach(uuid), public.plan_client(uuid), public.meal_plan(uuid)
  from public, anon;
grant execute on function public.is_coach(), public.my_coach_id(), public.is_my_client(uuid),
  public.can_read_program(uuid), public.owns_program(uuid), public.session_program(uuid),
  public.completion_client(uuid), public.legacy_session_client(uuid),
  public.plan_coach(uuid), public.plan_client(uuid), public.meal_plan(uuid)
  to authenticated;
revoke execute on function public.handle_new_user(), public.protect_profile_fields() from public, anon, authenticated;
