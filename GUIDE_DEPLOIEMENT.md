# 🚀 Guide de déploiement – Sirac Coaching App

## Ce que tu vas avoir
Une application installable sur téléphone (comme une vraie app) pour toi et tes clients :

- **Coach** : clients, programmes (blocs ou simples), bibliothèque de **876 exercices avec démonstrations**
  (dont 191 traduits en français avec consignes), modèles de programmes, plans nutritionnels, suivi
  des séances / mensurations / bilans / **alimentation** de chaque client, messagerie, agenda.
- **Client** : programme du jour, saisie des séances (charges, reps, RPE, minuteur de récup, records),
  démo de chaque exercice, séance libre, **journal alimentaire avec compteur de calories**
  (recherche d'aliments, **scan de code-barre**, aliments récents, plan du coach, « reprendre hier »),
  mensurations + photos, bilan hebdo, messages.

---

## Étape 1 – Créer ton projet Supabase (10 min)

1. Va sur **https://supabase.com** → « Start for free », crée un compte.
2. **New Project** → nom « sirac-coaching », mot de passe fort (garde-le), région **Europe (West)**.
3. Attends ~2 minutes.

### Créer la base de données
Dans Supabase → **SQL Editor** → **New query**, exécute **dans cet ordre** le contenu de ces 5 fichiers
(ouvrir le fichier → tout copier → coller → **Run**, puis nouvelle requête pour le suivant) :

1. `supabase/migrations/20261118000000_schema.sql` – tables, sécurité, stockage photos
2. `supabase/migrations/20261118000100_seed_exercises_1.sql` – exercices (partie 1/3)
3. `supabase/migrations/20261118000200_seed_exercises_2.sql` – exercices (partie 2/3)
4. `supabase/migrations/20261118000300_seed_exercises_3.sql` – exercices (partie 3/3)
5. `supabase/migrations/20261118000400_seed_foods.sql` – 120 aliments de base

> Alternative en ligne de commande (plus simple pour le gros fichier) :
> ```bash
> npx supabase login
> npx supabase link --project-ref <ref-du-projet>
> npx supabase db push
> ```

### Récupérer tes clés API
Supabase → **Project Settings** → **API** :
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secrète : uniquement sur Vercel, jamais dans le code)

### Réglage de l'URL du site
Supabase → **Authentication** → **URL Configuration** → **Site URL** : mets l'adresse Vercel de l'app
(ex. `https://sirac-coaching.vercel.app`) pour que les liens des emails pointent au bon endroit.

---

## Étape 2 – Configurer l'application (5 min)

```bash
cp .env.example .env
```
Ouvre `.env` et remplis `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

---

## Étape 3 – Créer ton compte coach

1. Supabase → **Authentication** → **Users** → **Add user** → ton email + un mot de passe
   (coche « Auto Confirm User »).
2. **SQL Editor** :
   ```sql
   update public.profiles
   set role = 'coach', name = 'Sirac', invite_code = 'SIRAC'
   where email = 'TON_EMAIL_ICI';
   ```
   (pour des raisons de sécurité, personne ne peut devenir coach depuis l'app : c'est la seule façon)

---

## Étape 4 – Déployer sur Vercel (gratuit, 5 min)

```bash
npm install
npm run build
npm install -g vercel
vercel --prod
```

Dans Vercel → ton projet → **Settings** → **Environment Variables** :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sert à l'ajout de client par email depuis l'app)

Redéploie après avoir ajouté les variables.

---

## Étape 5 – Ajouter tes clients

Deux possibilités :

- **Lien d'invitation** (recommandé) : Réglages → génère ton code → copie le lien
  `https://ton-app/join?code=XXXX` et envoie-le. Le client crée son compte et est rattaché automatiquement.
- **Par email** : Tableau de bord → **Ajouter** → le client reçoit un email pour choisir son mot de passe.

---

## Étape 6 – Installer l'app sur téléphone

- **iPhone (Safari)** : ouvre l'URL → **Partager** → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu **⋮** → « Ajouter à l'écran d'accueil ».

Le scan de code-barre utilise la caméra : il faut ouvrir l'app en **https** (c'est le cas sur Vercel).

---

## Bon à savoir

- **Démos d'exercices** : photos début / fin du mouvement animées (base libre de droits *free-exercise-db*,
  domaine public). Tu peux **personnaliser** n'importe quel exercice (bouton ✏️) pour mettre **ta propre
  vidéo** YouTube / Vimeo / .mp4 et tes consignes : tes clients verront ta version.
- **Calories** : aliments de base intégrés + produits du commerce via **Open Food Facts** (gratuit).
  Si tu n'as pas fixé d'objectif dans un plan nutritionnel, l'app estime les besoins du client
  à partir de son profil (taille, poids, âge, sexe, activité).
- **Notifications push** (optionnel) : génère des clés sur https://vapidkeys.com et ajoute
  `VITE_VAPID_PUBLIC_KEY`. Pour l'instant les alertes fonctionnent quand l'app est ouverte.

## Développement local (optionnel)

```bash
npx supabase start          # base locale (Docker requis), applique les migrations
cp .env.example .env.local  # puis URL http://127.0.0.1:54321 + clé anon affichée
npm run dev
```

La base d'exercices est régénérable avec `python3 scripts/build_exercise_seed.py exercises.json`
(fichier `dist/exercises.json` du dépôt free-exercise-db).
