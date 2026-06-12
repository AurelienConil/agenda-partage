import ICAL from "ical.js";

// ---------------------------------------------------------------------------
// Cache en mémoire (persiste tant que l'instance serverless reste "chaude").
// Évite de marteler Nextcloud : un seul appel CalDAV toutes les CACHE_TTL_MS.
// ---------------------------------------------------------------------------
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 300) * 1000;

// Requête CalDAV : on demande tous les VEVENT du calendrier sur une fenêtre.
function buildReportBody(rangeStart, rangeEnd) {
  return `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${rangeStart}" end="${rangeEnd}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

// Formate une date JS en timestamp CalDAV (UTC, format basique iCal).
function toCalDavStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Extrait les blocs <calendar-data> de la réponse XML multistatus.
// On reste volontairement tolérant : pas de parseur XML lourd, juste les
// sections calendar-data qui contiennent le VCALENDAR brut.
function extractCalendarData(xml) {
  const blocks = [];
  const regex = /<(?:[a-z0-9]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?calendar-data>/gi;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const decoded = m[1]
      // entités numériques décimales (&#13; &#233; …) et hexadécimales (&#x...;)
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    blocks.push(decoded.trim());
  }
  return blocks;
}

// Récupère une propriété custom X-... ou standard sur un VEVENT.
function getProp(vevent, name) {
  const p = vevent.getFirstProperty(name);
  return p ? p.getFirstValue() : null;
}

// Transforme un VEVENT ical.js en objet JSON propre pour le front.
function normalizeEvent(vevent) {
  const event = new ICAL.Event(vevent);

  // Catégories = notre "genre". Nextcloud les stocke dans CATEGORIES.
  const categoriesProp = vevent.getFirstProperty("categories");
  let categories = [];
  if (categoriesProp) {
    categories = categoriesProp.getValues().flatMap((v) =>
      String(v).split(",").map((s) => s.trim()).filter(Boolean)
    );
  }

  // Photo : on accepte plusieurs conventions, par ordre de priorité.
  //  1) propriété standard IMAGE (RFC 7986)
  //  2) X-IMAGE / X-PHOTO (custom)
  //  3) une URL d'image trouvée dans ATTACH
  let image =
    getProp(vevent, "image") ||
    getProp(vevent, "x-image") ||
    getProp(vevent, "x-photo") ||
    null;

  if (!image) {
    const attach = vevent.getFirstProperty("attach");
    if (attach) {
      const val = String(attach.getFirstValue() || "");
      if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(val)) image = val;
    }
  }

  const start = event.startDate ? event.startDate.toJSDate() : null;
  const end = event.endDate ? event.endDate.toJSDate() : null;
  const allDay = event.startDate ? event.startDate.isDate : false;

  return {
    uid: event.uid || null,
    title: event.summary || "(sans titre)",
    description: event.description || "", // contenu Markdown libre
    location: event.location || "",
    categories,
    image,
    url: getProp(vevent, "url") || null,
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
    allDay,
  };
}

// Interroge Nextcloud et renvoie la liste normalisée d'événements.
async function fetchEvents() {
  const base = process.env.CALDAV_URL;
  const user = process.env.CALDAV_USERNAME;
  const pass = process.env.CALDAV_PASSWORD;

  if (!base || !user || !pass) {
    throw new Error(
      "Configuration manquante : définis CALDAV_URL, CALDAV_USERNAME et CALDAV_PASSWORD dans les variables d'environnement Vercel."
    );
  }

  // Fenêtre temporelle : par défaut, 1 mois en arrière à 1 an en avant.
  const now = new Date();
  const pastDays = Number(process.env.RANGE_PAST_DAYS) || 30;
  const futureDays = Number(process.env.RANGE_FUTURE_DAYS) || 365;
  const rangeStart = new Date(now.getTime() - pastDays * 86400000);
  const rangeEnd = new Date(now.getTime() + futureDays * 86400000);

  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  const res = await fetch(base, {
    method: "REPORT",
    headers: {
      Authorization: auth,
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
    },
    body: buildReportBody(toCalDavStamp(rangeStart), toCalDavStamp(rangeEnd)),
  });

  if (res.status === 401) {
    throw new Error(
      "Authentification refusée (401). Vérifie l'app password Nextcloud et le nom d'utilisateur."
    );
  }
  if (!res.ok) {
    throw new Error(`Le serveur CalDAV a répondu ${res.status} ${res.statusText}.`);
  }

  const xml = await res.text();
  const calendarBlocks = extractCalendarData(xml);

  const events = [];
  for (const block of calendarBlocks) {
    try {
      const jcal = ICAL.parse(block);
      const comp = new ICAL.Component(jcal);
      const vevents = comp.getAllSubcomponents("vevent");
      for (const ve of vevents) {
        events.push(normalizeEvent(ve));
      }
    } catch (e) {
      // Un bloc malformé ne doit pas faire échouer tout l'agenda.
      console.error("Bloc iCal ignoré :", e.message);
    }
  }

  // Tri par date de début croissante par défaut.
  events.sort((a, b) => {
    if (!a.start) return 1;
    if (!b.start) return -1;
    return new Date(a.start) - new Date(b.start);
  });

  return events;
}

export default async function handler(req, res) {
  // CORS : la page front peut être hébergée ailleurs (GitHub Pages, etc.).
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const fresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    if (cache.data && fresh) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ events: cache.data, cached: true });
      return;
    }

    const events = await fetchEvents();
    cache = { data: events, fetchedAt: Date.now() };

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ events, cached: false });
  } catch (err) {
    console.error(err);
    // Si on a un cache, même périmé, mieux vaut le servir qu'une erreur.
    if (cache.data) {
      res.setHeader("X-Cache", "STALE");
      res.status(200).json({ events: cache.data, cached: true, stale: true });
      return;
    }
    res.status(500).json({ error: err.message });
  }
}
