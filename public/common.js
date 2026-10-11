// Code partagé entre l'agenda (index.html) et les structures (lieux.html).

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const catColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
};

function fmtDate(iso, allDay) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    monthYear: `${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`,
    monthFull: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    monthKey: `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`,
    time: allDay ? "Toute la journée" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function renderMarkdown(src) {
  if (!src) return "";
  const raw = marked.parse(src, { breaks: true });
  return DOMPurify.sanitize(raw);
}

function safeUrl(u) {
  try {
    const parsed = new URL(u, location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {}
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function lieuUrl(slug) {
  return `lieux.html?lieu=${encodeURIComponent(slug)}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function dateTag(ev) {
  if (!ev.start) return "";
  const f = fmtDate(ev.start, ev.allDay);
  return `<span class="date-tag"><span class="d">${f.day}</span><span class="my">${f.monthYear}</span><span class="time">· ${f.time}</span></span>`;
}

// knownVenues : Set des slugs qui ont une fiche lieu. Le lieu de l'événement
// devient alors un lien vers cette fiche ; sinon il reste en texte simple.
function locationHtml(ev, knownVenues) {
  if (!ev.location) return "";
  return ev.venue && knownVenues.has(ev.venue)
    ? `<a class="loc" href="${lieuUrl(ev.venue)}">↳ ${escapeHtml(ev.location)}</a>`
    : `<div class="loc">↳ ${escapeHtml(ev.location)}</div>`;
}

function moreLinkHtml(ev) {
  const link = ev.url ? safeUrl(ev.url) : null;
  return link ? `<a class="more" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">En savoir plus →</a>` : "";
}

function catsHtml(ev) {
  if (!ev.categories.length) return "";
  return `<div class="cats">` + ev.categories.map(c =>
    `<span class="tag" style="--cat:${catColor(c)}">${escapeHtml(c)}</span>`).join("") + `</div>`;
}

// Une image qui ne charge pas (site source en panne, lien mort…) disparaît
// au lieu de laisser une icône cassée.
function dropBrokenImages(root) {
  root.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
    const card = img.closest(".card");
    img.remove();
    if (card && img.classList.contains("thumb")) card.classList.add("no-thumb");
  }));
}

function card(ev, knownVenues = new Set()) {
  const el = document.createElement("article");
  el.className = "card" + (ev.image ? "" : " no-thumb");
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `Voir le détail : ${ev.title}`);

  let html = "";
  if (ev.image) html += `<img class="thumb" src="${escapeHtml(ev.image)}" alt="" loading="lazy">`;
  html += `<div class="body">`;
  html += dateTag(ev);
  html += `<h3>${escapeHtml(ev.title)}</h3>`;
  html += locationHtml(ev, knownVenues);
  // Aperçu du texte seulement : les images sont pour la fenêtre de détail.
  if (ev.description) html += `<div class="desc">${renderMarkdown(ev.description)}</div>`;
  html += moreLinkHtml(ev);
  html += catsHtml(ev);
  html += `</div>`;
  el.innerHTML = html;
  el.querySelectorAll(".desc img").forEach(img => img.remove());
  el.querySelectorAll(".desc p").forEach(p => { if (!p.textContent.trim()) p.remove(); });
  dropBrokenImages(el);

  // Un clic sur la carte ouvre le détail, sauf sur un lien (lieu, « En savoir plus »).
  el.addEventListener("click", e => {
    if (e.target.closest("a")) return;
    openEvent(ev, knownVenues);
  });
  el.addEventListener("keydown", e => {
    if (e.target === el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openEvent(ev, knownVenues);
    }
  });
  return el;
}

// ---------- Fenêtre de détail d'un événement ----------
function eventDialog() {
  let dialog = document.getElementById("event-modal");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "event-modal";
  dialog.className = "modal";
  // Clic sur le fond (hors du contenu) → fermeture.
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
  return dialog;
}

function openEvent(ev, knownVenues = new Set()) {
  const dialog = eventDialog();
  // Une image fournie seulement via la propriété IMAGE (pas dans le texte)
  // s'affiche en tête.
  const hero = ev.image && !(ev.images || []).length
    ? `<img class="modal-hero" src="${escapeHtml(ev.image)}" alt="">` : "";
  dialog.innerHTML = `
    <div class="modal-inner">
      <button class="modal-close" type="button" aria-label="Fermer">×</button>
      ${hero}
      <div class="modal-body">
        ${dateTag(ev)}
        <h2>${escapeHtml(ev.title)}</h2>
        ${locationHtml(ev, knownVenues)}
        ${ev.description ? `<div class="modal-desc">${renderMarkdown(ev.description)}</div>` : ""}
        ${moreLinkHtml(ev)}
        ${catsHtml(ev)}
      </div>
    </div>`;
  dialog.querySelector(".modal-close").addEventListener("click", () => dialog.close());
  // L'image est en bloc : le retour à la ligne qui l'entoure ferait un trou.
  dialog.querySelectorAll(".modal-desc img").forEach(img => {
    [img.previousSibling, img.nextSibling].forEach(n => { if (n?.nodeName === "BR") n.remove(); });
  });
  dropBrokenImages(dialog);
  dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector(".modal-close").focus();
}

// Bandeau de section (mois, genre…) suivi de sa grille de cartes.
function section(parent, titleHtml, events, knownVenues) {
  const band = document.createElement("div");
  band.className = "month-band";
  band.innerHTML = `<h2>${titleHtml}</h2><span class="count">${events.length} événement${events.length>1?"s":""}</span>`;
  parent.appendChild(band);
  const grid = document.createElement("div");
  grid.className = "grid";
  events.forEach(e => grid.appendChild(card(e, knownVenues)));
  parent.appendChild(grid);
  return band;
}

// Regroupe des événements (déjà triés) par mois, dans l'ordre chronologique.
function byMonth(events) {
  const groups = new Map();
  events.forEach(e => {
    const key = fmtDate(e.start, e.allDay).monthKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return [...groups.keys()].sort().map(key => {
    const evs = groups.get(key);
    return { label: fmtDate(evs[0].start, evs[0].allDay).monthFull, events: evs };
  });
}
