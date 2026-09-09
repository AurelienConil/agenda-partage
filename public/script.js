const API_URL = "/api/events";

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const catColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
};

const state = { events: [], sort: "date", active: new Set() };

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

function buildFilters() {
  const all = new Set();
  state.events.forEach(e => e.categories.forEach(c => all.add(c)));
  const box = document.getElementById("filters");
  box.innerHTML = "";
  [...all].sort((a,b)=>a.localeCompare(b,"fr")).forEach(cat => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = cat;
    b.style.setProperty("--cat", catColor(cat));
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      if (state.active.has(cat)) { state.active.delete(cat); b.setAttribute("aria-pressed","false"); }
      else { state.active.add(cat); b.setAttribute("aria-pressed","true"); }
      render();
    });
    box.appendChild(b);
  });
}

function card(ev) {
  const f = ev.start ? fmtDate(ev.start, ev.allDay) : null;
  const el = document.createElement("article");
  el.className = "card" + (ev.image ? "" : " no-thumb");

  let html = "";
  if (ev.image) {
    html += `<img class="thumb" src="${ev.image}" alt="" loading="lazy" onerror="this.remove();this.closest('.card')?.classList.add('no-thumb')">`;
  }
  html += `<div class="body">`;
  if (f) {
    html += `<span class="date-tag"><span class="d">${f.day}</span><span class="my">${f.monthYear}</span><span class="time">· ${f.time}</span></span>`;
  }
  html += `<h3>${escapeHtml(ev.title)}</h3>`;
  if (ev.location) html += `<div class="loc">↳ ${escapeHtml(ev.location)}</div>`;
  if (ev.description) html += `<div class="desc">${renderMarkdown(ev.description)}</div>`;
  const link = ev.url ? safeUrl(ev.url) : null;
  if (link) html += `<a class="more" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">En savoir plus →</a>`;
  if (ev.categories.length) {
    html += `<div class="cats">` + ev.categories.map(c =>
      `<span class="tag" style="--cat:${catColor(c)}">${escapeHtml(c)}</span>`).join("") + `</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
  return el;
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

function filtered() {
  if (state.active.size === 0) return state.events;
  return state.events.filter(e => e.categories.some(c => state.active.has(c)));
}

function render() {
  const main = document.getElementById("main");
  main.innerHTML = "";
  const list = filtered();

  if (list.length === 0) {
    main.innerHTML = `<div class="state">Aucun événement ne correspond à ce filtre.</div>`;
    return;
  }

  if (state.sort === "date") {
    const groups = new Map();
    list.forEach(e => {
      const key = e.start ? fmtDate(e.start, e.allDay).monthKey : "zzz";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
    [...groups.keys()].sort().forEach(key => {
      const evs = groups.get(key);
      const band = document.createElement("div");
      band.className = "month-band";
      const label = evs[0].start ? fmtDate(evs[0].start, evs[0].allDay).monthFull : "À programmer";
      band.innerHTML = `<h2>${label}</h2><span class="count">${evs.length} événement${evs.length>1?"s":""}</span>`;
      main.appendChild(band);
      const grid = document.createElement("div");
      grid.className = "grid";
      evs.forEach(e => grid.appendChild(card(e)));
      main.appendChild(grid);
    });
  } else {
    const groups = new Map();
    list.forEach(e => {
      const cats = e.categories.length ? e.categories : ["Sans genre"];
      cats.forEach(c => { if (!groups.has(c)) groups.set(c, []); groups.get(c).push(e); });
    });
    [...groups.keys()].sort((a,b)=>a.localeCompare(b,"fr")).forEach(cat => {
      const evs = groups.get(cat);
      const band = document.createElement("div");
      band.className = "month-band";
      band.innerHTML = `<h2 style="color:${catColor(cat)}">${escapeHtml(cat)}</h2><span class="count">${evs.length} événement${evs.length>1?"s":""}</span>`;
      main.appendChild(band);
      const grid = document.createElement("div");
      grid.className = "grid";
      evs.forEach(e => grid.appendChild(card(e)));
      main.appendChild(grid);
    });
  }
}

document.querySelectorAll("#sort button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#sort button").forEach(b => b.setAttribute("aria-pressed","false"));
    btn.setAttribute("aria-pressed","true");
    state.sort = btn.dataset.sort;
    render();
  });
});

async function load() {
  try {
    const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    state.events = (data.events || []).filter(e => e.start);

    document.getElementById("loading").hidden = true;

    if (state.events.length === 0) {
      document.getElementById("error").hidden = false;
      document.getElementById("error").innerHTML = "<strong>Agenda vide.</strong><br>Aucun événement n'a été trouvé sur la période.";
      return;
    }

    buildFilters();
    document.getElementById("controls").hidden = false;
    document.getElementById("main").hidden = false;
    document.getElementById("footer").hidden = false;
    document.getElementById("meta").textContent =
      `${state.events.length} événement${state.events.length>1?"s":""}` + (data.stale ? " · données en cache" : "");
    render();
  } catch (err) {
    document.getElementById("loading").hidden = true;
    const e = document.getElementById("error");
    e.hidden = false;
    e.innerHTML = `<strong>Impossible de charger l'agenda.</strong><br>${escapeHtml(err.message)}<br><br>Vérifie que l'API <code>${API_URL}</code> répond et que les variables d'environnement Nextcloud sont configurées.`;
  }
}

load();
