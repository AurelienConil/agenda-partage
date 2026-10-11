# ALT GR

**ALT GR** réunit les structures culturelles grenobloises autour d'un
**agenda partagé** des arts numériques, arts hybrides, de la création
expérimentale et des nouveaux médias (*new media arts*).

Chaque structure ajoute ses événements dans un calendrier **Nextcloud**
partagé ; le site les affiche, en lecture seule :

- tri **par date** ou **par genre**, filtres par genre (hashtags) ;
- **fenêtre de détail** au clic sur un événement, texte complet et photos
  en pleine largeur ;
- page **Structures partenaires** : une fiche par lieu (Markdown stocké dans
  Nextcloud) avec les événements qui s'y déroulent ;
- photos reprises des sites des lieux, par simple copier-coller d'URL.

Côté technique : un front statique (`public/`) et trois petites fonctions
Vercel (`api/`). Les identifiants Nextcloud restent côté serveur et ne sont
**jamais exposés** au navigateur. Front et API peuvent être sur le **même
projet Vercel**, ou **séparés** (API sur Vercel, page hébergée ailleurs).

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
3. **Le dossier des lieux** : crée un dossier **`Lieux`** à la racine de tes
   fichiers Nextcloud (même compte que le calendrier). Mets-y **un fichier
   Markdown par lieu**, nommé comme le lieu : `ARCAN.md`, `Hexagone.md`…
   Aucune configuration supplémentaire : l'adresse est déduite de
   `CALDAV_URL`.

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
- **Photos** → ajoute dans la description une ligne `IMAGE=https://…` avec
  l'adresse d'une image hébergée sur un autre site (site du lieu, de
  l'artiste…). La ligne est retirée du texte. La **première image** sert de
  vignette sur la carte. Dans la **fenêtre de détail** (clic sur la carte),
  chaque image s'affiche **à sa place dans le texte, en pleine largeur** :
  on peut donc alterner texte et images :
  ```
  Présentation du spectacle.
  IMAGE=https://site-du-lieu.fr/photo-1.webp
  La suite du texte.
  IMAGE=https://site-du-lieu.fr/photo-2.jpg
  Fin du texte.
  ```
  Un clic droit → « Copier l'adresse de l'image » sur le site source suffit.
  Les images passent par le relais `/api/image`, qui les renvoie avec le bon
  format même quand le site d'origine l'annonce mal (cas des `.avif` de
  l'Hexagone). Le relais n'accepte que les images citées dans l'agenda.
  Une image qui ne charge pas est simplement masquée.
- **Lieu** → champ **Lieu** (`LOCATION`) de l'événement, avec le nom du
  fichier de la fiche (sans `.md`). La comparaison est tolérante : casse,
  accents, tirets, espaces et article initial ne comptent pas (« ciel »,
  « Le Ciel », « le-ciel » désignent le même lieu), et une adresse après une
  virgule est ignorée (« Le Ciel, 2 rue… »). Le lieu devient alors un lien
  vers sa fiche ; sinon il reste en texte simple.
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

Le projet est **relié à GitHub** : Vercel déploie tout seul à chaque push.
La mise en ligne se résume à `git push`.

### Première mise en place

```bash
npm i -g vercel        # si pas déjà installé
vercel link            # lie le dossier au projet Vercel
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

### Mettre en ligne (usage normal)

```bash
git add -A && git commit -m "message" && git push
```

- Push sur **`main`** → déploiement en **production**.
- Push sur **une autre branche** (ou une PR) → déploiement **Preview**, avec
  une URL de test unique qui ne touche pas la production.

Le site est servi sur `/`, les API sur `/api/events`, `/api/lieux` et
`/api/image`.

### Quelle commande pour quoi ?

| Besoin | Commande |
|---|---|
| Mettre en ligne | `git push` |
| Tester en local, sans Vercel | `npm run local` |
| Tester en local, avec le comportement Vercel | `npm run dev` (`vercel dev`) |
| Récupérer les variables d'environnement de Vercel | `vercel env pull .env` |
| Voir les logs d'un déploiement | `vercel logs <url>` |
| Revenir à un déploiement précédent | `vercel rollback` (ou le dashboard) |

- **`npm run local`** : serveur Node simple, rapide, sans compte Vercel. C'est
  l'outil de tous les jours.
- **`npm run dev`** (`vercel dev`) : émule Vercel (routes, `vercel.json`,
  fonctions `api/`). À utiliser seulement pour vérifier qu'un comportement
  propre à Vercel marchera une fois en ligne.
- **`vercel --prod`** : déploie le dossier local en production **sans passer
  par GitHub**. À éviter : la prod contiendrait du code absent du dépôt, et le
  prochain `git push` l'écraserait. Réservé aux vraies urgences (GitHub
  indisponible), d'où l'absence de script `npm` pour ça.

### Tester en local

Copie `.env.example` en `.env` (jamais commité) avec tes vraies valeurs, puis :

```bash
npm install
npm run local          # http://localhost:3000
```

En local, les caches sont désactivés : une modification dans Nextcloud est
visible au rechargement de la page.

---

## 3. (Optionnel) Front hébergé ailleurs

Si tu veux garder **uniquement l'API sur Vercel** et héberger la page autre part
(GitHub Pages, Netlify, ton propre serveur) :

1. Dans `public/script.js` **et** `public/lieux.js`, change les adresses
   d'API :
   ```js
   const API_URL = "https://TON-PROJET.vercel.app/api/events";
   const LIEUX_URL = "https://TON-PROJET.vercel.app/api/lieux";
   ```
2. Dans Vercel, mets `ALLOWED_ORIGIN` sur l'URL exacte de ton front
   (ex. `https://moncompte.github.io`) pour autoriser le CORS.
3. Déploie tout le dossier `public/` où tu veux.

⚠️ Limite actuelle : les photos sont servies par `/api/image` avec une
adresse relative, elles ne s'afficheront donc pas sur un front séparé sans
adapter `lib/image-proxy.js` (préfixer l'adresse du projet Vercel).

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

- **Couleurs / typo** : tout est en variables CSS en haut de
  `public/styles.css` (`:root { … }`).
- **Fenêtre temporelle** : `RANGE_PAST_DAYS` / `RANGE_FUTURE_DAYS`
  (défaut : 30 jours en arrière, 365 en avant).
- **Titre / sous-titre** : dans le `<header class="masthead">` de
  `public/index.html` et `public/lieux.html`.

## Sécurité

- Ne committe **jamais** ton vrai `.env` (déjà dans `.gitignore`).
- L'API est en lecture seule : elle n'expose aucune méthode d'écriture.
- Le mot de passe d'application Nextcloud est **révocable** indépendamment.



## Feuille de route

### Fait

- Renommage du projet en **ALT GR**.
- **Structures partenaires** : fiches des lieux en Markdown lues dans
  Nextcloud (WebDAV), lieu cliquable sur les événements, événements de chaque
  lieu sous sa fiche. Pas de tri « par lieu » dans l'agenda : la vue par lieu
  n'existe que sur la fiche.
- **Fenêtre de détail** d'un événement : texte complet, images en pleine
  largeur à leur place dans le texte, fermeture par Échap / clic à côté /
  croix. Un clic sur un lien de la carte suit le lien.
- **Photos par URL** (`IMAGE=…` dans la description) et relais `/api/image`
  qui corrige les formats mal annoncés par les sites sources.

### Idées en réserve (pas prioritaires)

- **Filtre CSS sur les images** : une option de style graphique (bichromie,
  grain…) pour harmoniser les photos. Pas important.
- **Backoffice** : une 2e app pour ajouter des événements sans passer par un
  client de calendrier. Uniquement s'il reste vraiment du temps.
