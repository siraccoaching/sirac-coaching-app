-- ─────────────────────────────────────────────────────────────────────
-- 1. Notifications « app fermée » (Web Push)
-- ─────────────────────────────────────────────────────────────────────
-- Un abonnement par appareil (et plus un seul par utilisateur)
alter table public.push_subscriptions add column if not exists endpoint text;
update public.push_subscriptions set endpoint = (subscription::jsonb ->> 'endpoint') where endpoint is null;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_key;
create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Réglages privés (adresse et secret de la fonction d'envoi) : invisibles pour l'app
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;

-- À chaque événement utile, la base prévient /api/push qui envoie la notification au bon téléphone
create or replace function private.notify_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  push_url text;
  push_secret text;
begin
  select value into push_url from private.settings where key = 'push_url';
  select value into push_secret from private.settings where key = 'push_secret';
  if push_url is null or push_secret is null then return new; end if;
  if tg_table_name = 'nutrition_plans' then
    if new.client_id is null then return new; end if; -- (test séparé : les autres tables n'ont pas client_id)
  end if;
  perform net.http_post(
    url := push_url,
    body := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', push_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new; -- une notification ratée ne doit jamais bloquer l'enregistrement
end $$;
revoke all on function private.notify_push() from public, anon, authenticated;

do $$ begin
  create trigger push_messages after insert on public.messages for each row execute function private.notify_push();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger push_completions after insert on public.session_completions for each row execute function private.notify_push();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger push_assignments after insert or update on public.program_assignments for each row execute function private.notify_push();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger push_nutrition_plans after insert or update on public.nutrition_plans for each row execute function private.notify_push();
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Messagerie : photos, vidéos et messages vocaux
-- ─────────────────────────────────────────────────────────────────────
alter table public.messages alter column content set default '';
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists attachment_type text;
do $$ begin
  alter table public.messages add constraint messages_attachment_type_check check (attachment_type in ('image', 'video', 'audio'));
exception when duplicate_object then null; end $$;

-- Espace privé : dossier {expéditeur}/{destinataire}/fichier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-media', 'message-media', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy message_media_read on storage.objects for select to authenticated
    using (bucket_id = 'message-media' and (
      (storage.foldername(name))[1] = (select auth.uid())::text or (storage.foldername(name))[2] = (select auth.uid())::text));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy message_media_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'message-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (public.is_my_client(((storage.foldername(name))[2])::uuid) or ((storage.foldername(name))[2])::uuid = public.my_coach_id()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy message_media_delete on storage.objects for delete to authenticated
    using (bucket_id = 'message-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Vidéos de démonstration du coach (fichiers envoyés depuis le téléphone)
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-videos', 'exercise-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy exercise_videos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'exercise-videos' and public.is_coach() and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy exercise_videos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'exercise-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Consentement (CGU + données de santé)
-- ─────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Programme partagé personnalisé pour un client : son planning suit la copie
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.remap_client_schedule(p_client uuid, p_map jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_client(p_client) then raise exception 'Client non rattaché'; end if;
  update public.scheduled_sessions s
     set program_session_id = (p_map ->> s.program_session_id::text)::uuid
   where s.client_id = p_client and p_map ? s.program_session_id::text;
end $$;
revoke all on function public.remap_client_schedule(uuid, jsonb) from public, anon;
grant execute on function public.remap_client_schedule(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Secret d'appel de /api/push : créé par la base, jamais affiché ; la fonction serveur le vérifie ici
-- ─────────────────────────────────────────────────────────────────────
insert into private.settings (key, value) values ('push_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;
create or replace function public.push_secret_check(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from private.settings where key = 'push_secret' and value = s)
$$;
revoke all on function public.push_secret_check(text) from public, anon, authenticated;
grant execute on function public.push_secret_check(text) to service_role;
