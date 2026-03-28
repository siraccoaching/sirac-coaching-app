# 🚀 Guide de déploiement – Sirac Coaching App

## Ce que tu vas avoir
Une application installable sur ton téléphone (comme une vraie app)
avec notifications push en temps réel quand tes athlètes terminent leur séance.

---

## Étape 1 – Créer ton compte Supabase (10 min)

1. Va sur **https://supabase.com** → "Start for free"
2. Crée un compte avec ton email
3. Clique **"New Project"** → Nomme le "sirac-coaching"
4. Choisis un mot de passe fort pour la BDD → **Garde-le précieusement**
5. Région → Europe (West)
6. Attends ~2 minutes que le projet se crée

### Configurer la base de données
1. Dans Supabase → **SQL Editor** → **New Query**
2. Copie tout le contenu du fichier `supabase/schema.sql`
3. Colle-le et clique **Run**

### Récupérer tes clés API
Dans Supabase → **Project Settings** → **API** :
- Copie **Project URL** → c'est `VITE_SUPABASE_URL`
- Copie **anon / public key** → c'est `VITE_SUPABASE_ANON_KEY`

---

## Étape 2 – Configurer l'application (5 min)

1. Dans le dossier de l'app, copie le fichier d'exemple :
   ```
   cp .env.example .env
   ```
2. Ouvre `.env` et remplis avec tes clés Supabase :
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

---

## Étape 3 – Créer ton compte coach

1. Dans Supabase → **Authentication** → **Users** → **Invite user**
2. Entre ton email : sirac.coaching@gmail.com
3. Tu recevras un email pour définir ton mot de passe
4. Dans **SQL Editor**, execute :
   ```sql
   insert into public.profiles (id, name, email, role)
   select id, 'Sirac', email, 'coach'
   from auth.users
   where email = 'sirac.coaching@gmail.com';
   ```

---

## Étape 4 – Déployer sur Vercel (gratuit, 5 min)

### Installer Node.js (si pas déjà fait)
Télécharge sur https://nodejs.org → version LTS

### Déployer
```bash
# Dans le dossier coaching-app :
npm install
npm run build

# Installer Vercel CLI
npm install -g vercel

# Déployer (suit les instructions)
vercel --prod
```

Tu obtiendras une URL du type : `https://sirac-coaching.vercel.app`

### Ajouter les variables d'environnement sur Vercel
Dans le dashboard Vercel → ton projet → **Settings** → **Environment Variables** :
- Ajoute `VITE_SUPABASE_URL`
- Ajoute `VITE_SUPABASE_ANON_KEY`

---

## Étape 5 – Activer les notifications push (optionnel mais recommandé)

Les notifications push nécessitent des **clés VAPID**.

1. Génère les clés sur https://vapidkeys.com
2. Ajoute `VITE_VAPID_PUBLIC_KEY` dans ton `.env` et sur Vercel
3. La clé privée sera utilisée dans une Supabase Edge Function (étape avancée)

**Pour l'instant**, les notifications fonctionnent quand l'app est ouverte dans le navigateur.

---

## Étape 6 – Installer l'app sur ton téléphone

### iPhone (Safari)
1. Ouvre ton URL sur Safari
2. Icône **Partager** (carré avec flèche) → **"Sur l'écran d'accueil"**

### Android (Chrome)
1. Ouvre ton URL sur Chrome
2. Menu **⋮** → **"Ajouter à l'écran d'accueil"**

---

## Ajouter un client

1. Connecte-toi avec ton compte coach
2. Dashboard → **"Ajouter"** en haut à droite
3. Remplis les infos du client (email + mot de passe temporaire)
4. Le client se connecte avec ces identifiants sur la même URL

---

## Support

Des questions ? Reviens vers moi dans Cowork et je t'aide à déployer étape par étape.
