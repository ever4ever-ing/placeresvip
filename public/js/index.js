import { escapeHtml, formatModelCount } from "./lib.js";
import { bindCatalogCards, createCardRenderer } from "./catalog.js";

const INDEPENDENT_CASA = "independiente";

function getCasa() {
  return window.__CASA__ || { slug: "", nombre: "Selección exclusiva", ciudad: null };
}

function getSelectedCasaSlug() {
  return document.getElementById("casaFilter")?.value || "";
}

function isIndependentSelection() {
  return getSelectedCasaSlug() === INDEPENDENT_CASA;
}

function catalogApi(path) {
  const params = new URLSearchParams();
  const casa = getSelectedCasaSlug();
  const ciudad = document.getElementById("ciudadFilter")?.value || "";

  if (casa) {
    params.set("casa", casa);
  }

  if (ciudad) {
    params.set("ciudad", ciudad);
  }

  const query = params.toString();
  return "/api/catalog" + path + (query ? "?" + query : "");
}

function casaProfileUrl(slug) {
  return "/" + encodeURIComponent(slug);
}

function profileBase(model) {
  if (!model?.casa_slug) {
    return "/perfil";
  }

  return casaProfileUrl(model.casa_slug);
}

function adminCasaUrl() {
  const slug = getSelectedCasaSlug();

  if (!slug || isIndependentSelection()) {
    return "/admin-casa";
  }

  return "/" + encodeURIComponent(slug) + "/admin-casa";
}

function renderMiCasaLink() {
  if (isIndependentSelection()) {
    return "";
  }

  return (
    '<div class="mi-casa-wrap">' +
    '<a class="mi-casa-link" href="' +
    escapeHtml(adminCasaUrl()) +
    '">' +
    '<span class="mi-casa-icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/>' +
    "</svg>" +
    "</span>" +
    "<strong>Mi casa</strong>" +
    "</a>" +
    "</div>"
  );
}

let casas = [];
let allModels = [];

const catalogEl = document.getElementById("models");
const casaPickerEl = document.getElementById("casaPicker");
const catalogSectionEl = document.getElementById("catalogSection");
const heroFiltersEl = document.getElementById("heroFilters");
const casaFilterInput = document.createElement("input");
casaFilterInput.type = "hidden";
casaFilterInput.id = "casaFilter";
document.body.appendChild(casaFilterInput);

function casaLabel(slug) {
  if (slug === INDEPENDENT_CASA) {
    return "Independientes";
  }

  const casa = casas.find((item) => item.slug === slug);
  return casa ? casa.nombre : slug;
}

const renderCard = createCardRenderer({
  profileUrl(model) {
    return profileBase(model) + "/" + encodeURIComponent(model.id);
  },
  showCasaTag: () => false,
  casaLabel,
  casaProfileUrl
});

function syncUrl() {
  const slug = getSelectedCasaSlug();
  const url = new URL(window.location.href);

  if (slug) {
    url.searchParams.set("casa", slug);
  } else {
    url.searchParams.delete("casa");
  }

  window.history.replaceState({}, "", url);
}

function applyCasaBranding() {
  const selected = getSelectedCasaSlug();
  const badge = document.getElementById("casaBadge");
  const heroTitle = document.getElementById("heroTitle");
  const heroIntro = document.getElementById("heroIntro");
  const catalogTitle = document.getElementById("catalogTitle");
  const ciudad = document.getElementById("ciudadFilter")?.value || "";

  if (badge) {
    badge.textContent = selected ? casaLabel(selected) : "Catálogo";
  }

  if (heroTitle) {
    heroTitle.textContent = selected ? casaLabel(selected) : "Selección exclusiva";
  }

  if (catalogTitle) {
    catalogTitle.textContent = selected
      ? isIndependentSelection()
        ? "Perfiles independientes"
        : "Perfiles de " + casaLabel(selected)
      : "Perfiles disponibles";
  }

  if (heroIntro) {
    if (!selected) {
      heroIntro.textContent =
        "Explora perfiles por casa o revisa las chicas independientes.";
    } else if (isIndependentSelection()) {
      heroIntro.textContent =
        "Perfiles sin casa asociada" + (ciudad ? " en " + ciudad : "") + ".";
    } else {
      heroIntro.textContent =
        "Catálogo de " +
        casaLabel(selected) +
        (ciudad ? " en " + ciudad : "") +
        ". Escorts, cariñosas y acompañantes en Chile.";
    }
  }

  const profileLink = document.getElementById("casaProfileLink");

  if (profileLink) {
    if (selected && !isIndependentSelection()) {
      profileLink.href = casaProfileUrl(selected);
      profileLink.textContent = "Ver perfil de " + casaLabel(selected) + " →";
      profileLink.hidden = false;
    } else {
      profileLink.hidden = true;
    }
  }
}

function showPicker() {
  casaPickerEl.hidden = false;
  catalogSectionEl.hidden = true;
  heroFiltersEl.hidden = true;
  casaFilterInput.value = "";
  document.getElementById("search").value = "";
  document.getElementById("ciudadFilter").value = "";
  allModels = [];
  catalogEl.innerHTML =
    '<div class="empty">Selecciona una casa arriba para explorar su catálogo.</div>';
  updateModelCount(null);
  renderCatalogFooter("");
  applyCasaBranding();
  syncUrl();
}

function showCatalog(slug) {
  casaFilterInput.value = slug;
  casaPickerEl.hidden = true;
  catalogSectionEl.hidden = false;
  heroFiltersEl.hidden = false;
  applyCasaBranding();
  syncUrl();
}

function getSearchText(model) {
  return [
    model.id,
    model.nombre,
    model.edad,
    model.altura,
    model.pelo,
    model.ciudad,
    model.whatsapp,
    model.descripcion,
    model.servicios,
    model.created_at
  ]
    .join(" ")
    .toLowerCase();
}

function updateModelCount(total) {
  const el = document.getElementById("modelCount");

  if (!el) {
    return;
  }

  if (total === null && !getSelectedCasaSlug()) {
    el.textContent = "Selecciona una casa para ver perfiles.";
    return;
  }

  el.textContent = formatModelCount(total);
}

function renderCatalogFooter(html) {
  document.getElementById("catalogFooter").innerHTML = html || "";
}

function renderModels() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const filtered = allModels.filter((model) => getSearchText(model).includes(query));

  if (!filtered.length) {
    updateModelCount(0);
    catalogEl.innerHTML = query
      ? '<div class="empty">No hay perfiles que coincidan con esa búsqueda.</div>'
      : '<div class="empty">No hay perfiles publicados en esta selección.</div>';
    renderCatalogFooter(renderMiCasaLink());
    return;
  }

  updateModelCount(filtered.length);
  catalogEl.innerHTML = filtered.map(renderCard).join("");
  renderCatalogFooter(renderMiCasaLink());
}

function renderCiudadOptions() {
  const select = document.getElementById("ciudadFilter");
  const current = select.value || "";
  const ciudades = [
    ...new Set(allModels.map((model) => String(model.ciudad ?? "").trim()).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "es"));

  select.innerHTML = ['<option value="">Todas las ciudades</option>']
    .concat(
      ciudades.map(
        (ciudad) =>
          '<option value="' + escapeHtml(ciudad) + '">' + escapeHtml(ciudad) + "</option>"
      )
    )
    .join("");

  if (current && ciudades.includes(current)) {
    select.value = current;
  }
}

function renderCasaCard(casa) {
  const city = casa.ciudad ? escapeHtml(casa.ciudad) : "Chile";

  return (
    '<button type="button" class="casa-card" data-casa="' +
    escapeHtml(casa.slug) +
    '">' +
    '<span class="casa-card-eyebrow">Casa</span>' +
    "<h3>" +
    escapeHtml(casa.nombre) +
    "</h3>" +
    '<p class="casa-card-meta">' +
    city +
    "</p>" +
    '<span class="casa-card-cta">Ver catálogo →</span>' +
    "</button>"
  );
}

function renderIndependentCard() {
  return (
    '<button type="button" class="casa-card casa-card-independent" data-casa="' +
    INDEPENDENT_CASA +
    '">' +
    '<span class="casa-card-eyebrow">Sin casa</span>' +
    "<h3>Independientes</h3>" +
    '<p class="casa-card-meta">Perfiles sin casa asociada</p>' +
    '<span class="casa-card-cta">Ver perfiles →</span>' +
    "</button>"
  );
}

function renderCasaPicker() {
  const root = document.getElementById("casaCards");

  if (!casas.length) {
    root.innerHTML =
      renderIndependentCard() +
      '<div class="empty casa-picker-empty">Todavía no hay casas registradas.</div>';
    return;
  }

  root.innerHTML = casas.map(renderCasaCard).join("") + renderIndependentCard();
}

async function loadCasas() {
  try {
    const res = await fetch("/api/casas", { cache: "no-store" });

    if (!res.ok) {
      casas = [];
      renderCasaPicker();
      return;
    }

    casas = await res.json();

    if (!Array.isArray(casas)) {
      casas = [];
    }

    renderCasaPicker();
    applyCasaBranding();
  } catch (error) {
    console.error("Error cargando casas:", error);
    casas = [];
    renderCasaPicker();
  }
}

async function loadModels() {
  const selected = getSelectedCasaSlug();

  if (!selected) {
    showPicker();
    return;
  }

  try {
    updateModelCount(null);
    catalogEl.innerHTML = '<div class="loading">Cargando perfiles...</div>';
    renderCatalogFooter("");

    const res = await fetch(catalogApi("/models"), { cache: "no-store" });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const models = await res.json();
    allModels = Array.isArray(models) ? models : [];
    renderCiudadOptions();
    applyCasaBranding();
    renderModels();
  } catch (error) {
    updateModelCount(null);
    catalogEl.innerHTML = '<div class="loading">Error cargando perfiles</div>';
    renderCatalogFooter("");
    console.error(error);
  }
}

async function selectCasa(slug) {
  showCatalog(slug);
  await loadModels();
}

document.getElementById("search").addEventListener("input", renderModels);

document.getElementById("ciudadFilter").addEventListener("change", async () => {
  applyCasaBranding();
  await loadModels();
});

document.getElementById("changeCasaBtn").addEventListener("click", () => {
  showPicker();
});

document.getElementById("casaCards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-casa]");

  if (!card) {
    return;
  }

  selectCasa(card.dataset.casa);
});

function readInitialCasa() {
  const fromQuery = new URLSearchParams(window.location.search).get("casa");

  if (fromQuery === INDEPENDENT_CASA) {
    return INDEPENDENT_CASA;
  }

  if (fromQuery && casas.some((casa) => casa.slug === fromQuery)) {
    return fromQuery;
  }

  const injected = getCasa().slug;

  if (injected && casas.some((casa) => casa.slug === injected)) {
    return injected;
  }

  return "";
}

async function bootCatalog() {
  bindCatalogCards(catalogEl);
  await loadCasas();

  const initial = readInitialCasa();

  if (initial) {
    await selectCasa(initial);
    return;
  }

  showPicker();
}

bootCatalog();
