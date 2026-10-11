const API_URL = "/api/events";
const LIEUX_URL = "/api/lieux";

const state = { events: [], venues: new Set(), sort: "date", active: new Set() };

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
    byMonth(list).forEach(g => section(main, g.label, g.events, state.venues));
  } else {
    const groups = new Map();
    list.forEach(e => {
      const cats = e.categories.length ? e.categories : ["Sans genre"];
      cats.forEach(c => { if (!groups.has(c)) groups.set(c, []); groups.get(c).push(e); });
    });
    [...groups.keys()].sort((a,b)=>a.localeCompare(b,"fr")).forEach(cat => {
      const band = section(main, escapeHtml(cat), groups.get(cat), state.venues);
      band.querySelector("h2").style.color = catColor(cat);
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
    // Les lieux sont un bonus : s'ils ne chargent pas, l'agenda s'affiche
    // quand même, avec les lieux en texte simple.
    const [data, lieux] = await Promise.all([
      fetchJson(API_URL),
      fetchJson(LIEUX_URL).catch(() => ({ lieux: [] })),
    ]);
    state.events = (data.events || []).filter(e => e.start);
    state.venues = new Set((lieux.lieux || []).map(l => l.slug));

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
