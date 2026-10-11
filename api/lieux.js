import { venueSlug } from "../lib/venue.js";

// ---------------------------------------------------------------------------
// Lieux : un fichier Markdown par lieu, dans le dossier Nextcloud "Lieux",
// lu en WebDAV avec le compte du calendrier.
//   Lieux/Le Ciel.md      → { slug: "le-ciel", name: "Le Ciel", description }
// Le nom du fichier (sans .md) est le nom du lieu ; il doit correspondre au
// champ LOCATION des événements (voir lib/venue.js pour la comparaison).
// ---------------------------------------------------------------------------
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 300) * 1000;

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype />
    <d:getlastmodified />
  </d:prop>
</d:propfind>`;

// Liste les href des fichiers .md du dossier (réponse multistatus Depth: 1).
function extractMarkdownHrefs(xml) {
  const hrefs = [];
  const regex = /<(?:[a-z0-9]+:)?href>([\s\S]*?)<\/(?:[a-z0-9]+:)?href>/gi;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const href = m[1].trim().replace(/&amp;/g, "&");
    if (/\.md$/i.test(href)) hrefs.push(href);
  }
  return hrefs;
}

function nameFromHref(href) {
  const file = decodeURIComponent(href.split("/").pop());
  return file.replace(/\.md$/i, "").trim();
}

// Le dossier "Lieux" à la racine des fichiers du compte, déduit de CALDAV_URL :
//   https://host/remote.php/dav/calendars/jean/agenda/
//   → https://host/remote.php/dav/files/jean/Lieux/
// WEBDAV_LIEUX_URL permet de pointer ailleurs si besoin.
function lieuxFolderUrl() {
  if (process.env.WEBDAV_LIEUX_URL) return process.env.WEBDAV_LIEUX_URL;
  const m = (process.env.CALDAV_URL || "").match(/^(.*\/remote\.php\/dav\/)calendars\/([^/]+)\//);
  return m ? `${m[1]}files/${m[2]}/Lieux/` : null;
}

async function fetchLieux() {
  const base = lieuxFolderUrl();
  // Même compte que le calendrier : un mot de passe d'application Nextcloud
  // donne accès aux deux.
  const user = process.env.CALDAV_USERNAME;
  const pass = process.env.CALDAV_PASSWORD;

  if (!base || !user || !pass) {
    throw new Error(
      "Configuration manquante : CALDAV_URL (au format .../remote.php/dav/calendars/UTILISATEUR/...), CALDAV_USERNAME et CALDAV_PASSWORD doivent être définis."
    );
  }

  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const folder = base.endsWith("/") ? base : base + "/";

  const res = await fetch(folder, {
    method: "PROPFIND",
    headers: { Authorization: auth, "Content-Type": "application/xml; charset=utf-8", Depth: "1" },
    body: PROPFIND_BODY,
  });

  if (res.status === 401) {
    throw new Error("Authentification refusée (401). Vérifie l'app password Nextcloud et le nom d'utilisateur.");
  }
  if (res.status === 404) {
    throw new Error("Dossier des lieux introuvable (404). Il doit s'appeler « Lieux », à la racine des fichiers Nextcloud.");
  }
  if (!res.ok) {
    throw new Error(`Le serveur WebDAV a répondu ${res.status} ${res.statusText}.`);
  }

  const hrefs = extractMarkdownHrefs(await res.text());

  const lieux = await Promise.all(
    hrefs.map(async (href) => {
      const url = new URL(href, folder).href;
      try {
        const r = await fetch(url, { headers: { Authorization: auth } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const name = nameFromHref(href);
        return { slug: venueSlug(name), name, description: (await r.text()).trim() };
      } catch (e) {
        // Un fichier illisible ne doit pas faire échouer toute la liste.
        console.error(`Lieu ignoré (${href}) :`, e.message);
        return null;
      }
    })
  );

  return lieux
    .filter((l) => l && l.slug)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export default async function handler(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // ?slug=le-ciel → un seul lieu ; sans paramètre → tous les lieux.
  const slug = req.query?.slug ? venueSlug(String(req.query.slug)) : null;

  const send = (lieux, extra) => {
    if (!slug) {
      res.status(200).json({ lieux, ...extra });
      return;
    }
    const lieu = lieux.find((l) => l.slug === slug);
    if (!lieu) res.status(404).json({ error: `Lieu inconnu : ${slug}` });
    else res.status(200).json({ lieu, ...extra });
  };

  try {
    const fresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    if (cache.data && fresh) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=60");
      send(cache.data, { cached: true });
      return;
    }

    const lieux = await fetchLieux();
    cache = { data: lieux, fetchedAt: Date.now() };

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    send(lieux, { cached: false });
  } catch (err) {
    console.error(err);
    if (cache.data) {
      res.setHeader("X-Cache", "STALE");
      send(cache.data, { cached: true, stale: true });
      return;
    }
    res.status(500).json({ error: err.message });
  }
}
