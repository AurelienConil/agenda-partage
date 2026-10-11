// Page des structures partenaires :
//   lieux.html            → liste des lieux
//   lieux.html?lieu=ciel  → fiche d'un lieu + ses événements
const API_URL = "/api/events";
const LIEUX_URL = "/api/lieux";

// Premières lignes de la description, en texte brut, pour la liste.
function excerpt(markdown, max = 180) {
  const tmp = document.createElement("div");
  tmp.innerHTML = renderMarkdown(markdown);
  // Espace entre paragraphes / lignes, sinon "grenoblois.Le point fort".
  tmp.querySelectorAll("p, br, li, h1, h2, h3, h4").forEach(el => el.after(" "));
  const text = tmp.textContent.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

function countLabel(n) {
  return n ? `${n} événement${n>1?"s":""}` : "Aucun événement";
}

function renderList(main, lieux, events) {
  if (lieux.length === 0) {
    main.innerHTML = `<div class="state">Aucune structure pour le moment.</div>`;
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  lieux.forEach(l => {
    const n = events.filter(e => e.venue === l.slug).length;
    const a = document.createElement("a");
    a.className = "card venue-card no-thumb";
    a.href = lieuUrl(l.slug);
    a.innerHTML = `<div class="body">
      <h3>${escapeHtml(l.name)}</h3>
      <p class="desc">${escapeHtml(excerpt(l.description))}</p>
      <span class="count">${countLabel(n)} →</span>
    </div>`;
    grid.appendChild(a);
  });
  main.appendChild(grid);
}

function renderLieu(main, lieu, events, known) {
  document.title = `${lieu.name} — ALT GR`;
  document.getElementById("title").textContent = lieu.name;
  document.getElementById("sub").hidden = true;
  const back = document.getElementById("back");
  back.href = "lieux.html";
  back.textContent = "← Toutes les structures";

  const desc = document.createElement("article");
  desc.className = "lieu-desc";
  desc.innerHTML = renderMarkdown(lieu.description);
  main.appendChild(desc);

  const evs = events.filter(e => e.venue === lieu.slug);
  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = evs.length ? "À l'agenda" : "Aucun événement prévu ici pour le moment";
  main.appendChild(heading);
  byMonth(evs).forEach(g => section(main, g.label, g.events, known));
}

async function load() {
  const main = document.getElementById("main");
  try {
    const [lieuxData, eventsData] = await Promise.all([
      fetchJson(LIEUX_URL),
      fetchJson(API_URL).catch(() => ({ events: [] })),
    ]);
    const lieux = lieuxData.lieux || [];
    const events = (eventsData.events || []).filter(e => e.start);
    const known = new Set(lieux.map(l => l.slug));

    document.getElementById("loading").hidden = true;
    main.hidden = false;

    const wanted = new URLSearchParams(location.search).get("lieu");
    if (!wanted) {
      renderList(main, lieux, events);
      return;
    }
    const lieu = lieux.find(l => l.slug === wanted);
    if (lieu) {
      renderLieu(main, lieu, events, known);
    } else {
      main.innerHTML = `<div class="state"><strong>Structure introuvable.</strong><br><a href="lieux.html">Voir toutes les structures</a></div>`;
    }
  } catch (err) {
    document.getElementById("loading").hidden = true;
    const e = document.getElementById("error");
    e.hidden = false;
    e.innerHTML = `<strong>Impossible de charger les structures.</strong><br>${escapeHtml(err.message)}`;
  }
}

load();
