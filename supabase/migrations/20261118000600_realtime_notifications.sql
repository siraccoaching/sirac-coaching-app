-- Notifications en temps réel côté client : programme et plan nutritionnel mis à jour par le coach.
do $$
begin
  begin alter publication supabase_realtime add table public.programs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.nutrition_plans; exception when others then null; end;
end $$;
