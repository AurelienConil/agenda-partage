# Agenda partagé — Nextcloud + Vercel

Un site web qui affiche, **en lecture seule et de manière stylée**, le contenu
d'un calendrier **partagé Nextcloud (CalDAV)**.

- Le **mot de passe CalDAV n'est jamais exposé** au navigateur : il reste dans
  une variable d'environnement, côté serveur (fonction Vercel).
- Le front interroge une petite **API JSON** (`/api/events`) et l'affiche :
  tri **par date** ou **par genre**, filtres par catégorie, **photo**
  d'événement, **description en Markdown**.
- Front et API peuvent être sur le **même projet Vercel**, ou **séparés**
  (API sur Vercel, page hébergée ailleurs comme GitHub Pages).

---

## 1. Préparer Nextcloud

1. **Le calendrier partagé** : dans l'app Agenda de Nextcloud, à côté du
   calendrier voulu → menu `…` → récupère le **lien CalDAV**. Il ressemble à :
   ```
   https://VOTRE-NEXTCLOUD.tld/remote.php/dav/calendars/UTILISATEUR/NOM-CALENDRIER/
   ```
2. **Un mot de passe d'application** (ne donne jamais le vrai mot de passe) :
   `Paramètres` → `Sécurité` → **Créer un nouveau mot de passe d'application**.
   Copie-le tout de suite (il ne s'affiche qu'une fois). Il est révocable à tout
   moment et fonctionne même avec la double authentification activée.

### Comment alimenter les champs « stylés »

Dans chaque événement Nextcloud :
- **Genre / catégorie** → mets un ou plusieurs **hashtags dans la
  description** (ex. `#Théâtre #Concert`). On n'utilise pas le champ
  « Catégories » CalDAV : il est invisible dans l'app Calendrier de
  macOS/iOS, alors que la description reste éditable partout. Les hashtags
  sont retirés de l'affichage — ils ne sont pas montrés au public.
- **Description en Markdown** → écris simplement du Markdown dans la
  **Description** (`**gras**`, listes `- …`, liens `[texte](url)`), hashtags
  de genre inclus n'importe où dans le texte.
- **Photo** → ajoute une propriété image. Le plus simple : une **pièce jointe**
  (`ATTACH`) qui pointe vers une URL d'image (`.jpg/.png/.webp`), ou une
  propriété `X-IMAGE` / `IMAGE` si ton client le permet. Un **lien de partage
  public Nextcloud** (`https://.../s/TOKEN`) marche aussi : il est converti
  automatiquement en lien de téléchargement direct (`/download`) par l'API.
- **Lien "en savoir plus"** → champ **URL** de l'événement (propriété
  standard `URL`). Affiché comme lien cliquable sur la carte s'il est en
  `http://` ou `https://`.
- **Brouillon / privé** → ajoute le hashtag **`#Brouillon`** ou **`#Privé`**
  dans la description (`#Draft` / `#Private` marchent aussi, insensible à la
  casse et aux accents) : l'événement reste dans ton calendrier Nextcloud
  mais n'est **jamais renvoyé par l'API** ni affiché sur le site. Pratique
  pour préparer un événement à l'avance ou en garder un hors ligne. Retire le
  hashtag quand il est prêt à publier.

---

## 2. Déployer sur Vercel

```bash
npm i -g vercel        # si pas déjà installé
vercel                 # première fois : lie le projet
```

Puis dans **Vercel → ton projet → Settings → Environment Variables**, ajoute
(voir `.env.example` pour le détail) :

| Variable            | Exemple                                                          |
|---------------------|------------------------------------------------------------------|
| `CALDAV_URL`        | `https://cloud.exemple.fr/remote.php/dav/calendars/jean/agenda/` |
| `CALDAV_USERNAME`   | `jean`                                                            |
| `CALDAV_PASSWORD`   | *(le mot de passe d'application)*                                |
| `CACHE_TTL_SECONDS` | `300` *(optionnel)*                                              |
| `ALLOWED_ORIGIN`    | `*` *(ou l'URL du front si séparé)*                              |

Déploie :

```bash
vercel --prod
```

Ton site est en ligne. L'API répond sur `/api/events`, le site sur `/`.

---

## 3. (Optionnel) Front hébergé ailleurs

Si tu veux garder **uniquement l'API sur Vercel** et héberger la page autre part
(GitHub Pages, Netlify, ton propre serveur) :

1. Dans `public/index.html`, change :
   ```js
   const API_URL = "https://TON-PROJET.vercel.app/api/events";
   ```
2. Dans Vercel, mets `ALLOWED_ORIGIN` sur l'URL exacte de ton front
   (ex. `https://moncompte.github.io`) pour autoriser le CORS.
3. Déploie `public/index.html` où tu veux.

---

## Comment ça marche (en bref)

```
Navigateur ──GET /api/events──▶  Fonction Vercel
                                   │  (détient le secret CalDAV)
                                   │  cache mémoire (TTL configurable)
                                   ▼
                              Nextcloud CalDAV  ──REPORT──▶ VEVENT…
                                   │
                                   ▼
                          JSON normalisé { events: [...] }
```

- Le **cache** évite d'interroger Nextcloud à chaque visiteur : un seul appel
  toutes les `CACHE_TTL_SECONDS`. Les visiteurs lisent une réponse déjà prête.
- Si Nextcloud est temporairement injoignable mais qu'un cache existe, l'API
  sert les **dernières données connues** plutôt qu'une erreur.

## Personnalisation rapide

- **Couleurs / typo** : tout est en variables CSS en haut de `public/index.html`
  (`:root { … }`).
- **Fenêtre temporelle** : `RANGE_PAST_DAYS` / `RANGE_FUTURE_DAYS`.
- **Titre / sous-titre** : dans le `<header class="masthead">` de l'HTML.

## Sécurité

- Ne committe **jamais** ton vrai `.env` (déjà dans `.gitignore`).
- L'API est en lecture seule : elle n'expose aucune méthode d'écriture.
- Le mot de passe d'application Nextcloud est **révocable** indépendamment.
