import { escapeHtml, formatModelCount } from "./lib.js";
import { bindCatalogCards, createCardRenderer } from "./catalog.js";

const INDEPENDENT_CASA = "independiente";

function getCasa() {
  return window.__CASA__ || { slug: "", nombre: "Selección exclusiva", ciudad: null };
}

function getSelectedCasaSlug() {
  return document.getElementById("casaFilter")?.value || "";
}

function getSelectedCiudad() {
  return document.getElementById("ciudadFilter")?.value || "";
}

function isIndependentSelection() {
  return getSelectedCasaSlug() === INDEPENDENT_CASA;
}

function normalizeCity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function catalogApi(path) {
  const params = new URLSearchParams();
  const casa = getSelectedCasaSlug();

  if (casa) {
    params.set("casa", casa);
  }

  const query = params.toString();
  return "/api/catalog" + path + (query ? "?" + query : "");
}

function casaProfileUrl(slug) {
  return "/" + encodeURIComponent(slug);
}

function profileUrlForModel(model) {
  if (!model?.casa_slug) {
    return "/perfil/" + encodeURIComponent(model.id);
  }

  return (
    casaProfileUrl(model.casa_slug) + "/perfil/" + encodeURIComponent(model.id)
  );
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
const pickerFiltersEl = document.getElementById("pickerFilters");
const catalogNavEl = document.getElementById("catalogNav");
const backToMenuBtnInline = document.getElementById("backToMenuBtnInline");
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
    return profileUrlForModel(model);
  },
  showCasaTag: () => false,
  casaLabel,
  casaProfileUrl
});

function syncUrl() {
  const slug = getSelectedCasaSlug();
  const ciudad = getSelectedCiudad();
  const url = new URL(window.location.href);

  if (slug) {
    url.searchParams.set("casa", slug);
  } else {
    url.searchParams.delete("casa");
  }

  if (!slug && ciudad) {
    url.searchParams.set("ciudad", ciudad);
  } else {
    url.searchParams.delete("ciudad");
  }

  window.history.replaceState({}, "", url);
}

function applyCasaBranding() {
  const selected = getSelectedCasaSlug();
  const badge = document.getElementById("casaBadge");
  const heroTitle = document.getElementById("heroTitle");
  const heroIntro = document.getElementById("heroIntro");
  const catalogTitle = document.getElementById("catalogTitle");
  const ciudad = getSelectedCiudad();

  if (badge) {
    badge.textContent = selected ? casaLabel(selected) : ciudad ? ciudad : "Catálogo";
  }

  if (heroTitle) {
    heroTitle.textContent = selected ? casaLabel(selected) : "Selección exclusiva";
  }

  if (catalogTitle) {
    catalogTitle.textContent = selected
      ? isIndependentSelection()
        ? "Independientes"
        : "Perfiles de " + casaLabel(selected)
      : "Perfiles disponibles";
  }

  const navContext = document.getElementById("navContext");

  if (navContext) {
    navContext.textContent = selected ? casaLabel(selected) : "";
  }

  if (heroIntro) {
    if (selected) {
      if (isIndependentSelection()) {
        heroIntro.textContent = "Catálogo de independientes.";
      } else {
        heroIntro.textContent =
          "Catálogo de " +
          casaLabel(selected) +
          ". Escorts, cariñosas y acompañantes en Chile.";
      }
    } else if (ciudad) {
      heroIntro.textContent = "Casas y perfiles en " + ciudad + ".";
    } else {
      heroIntro.textContent =
        "Elige una ciudad o explora perfiles por casa e independientes.";
    }
  }
}

function setCatalogNavVisible(visible) {
  if (catalogNavEl) {
    catalogNavEl.hidden = !visible;
  }

  if (backToMenuBtnInline) {
    backToMenuBtnInline.hidden = !visible;
  }
}

function setPickerFiltersVisible(visible) {
  if (pickerFiltersEl) {
    pickerFiltersEl.hidden = !visible;
  }

  document.querySelector(".shell")?.classList.toggle("catalog-open", !visible);
}

function showPicker() {
  casaPickerEl.hidden = false;
  catalogSectionEl.hidden = true;
  setPickerFiltersVisible(true);
  setCatalogNavVisible(false);
  casaFilterInput.value = "";
  allModels = [];
  catalogEl.innerHTML =
    '<div class="empty">Selecciona una casa arriba para explorar su catálogo.</div>';
  updateModelCount(null);
  renderCatalogFooter("");
  renderCasaPicker();
  applyCasaBranding();
  syncUrl();
}

async function showCatalog(slug) {
  casaFilterInput.value = slug;
  casaPickerEl.hidden = true;
  catalogSectionEl.hidden = false;
  setPickerFiltersVisible(false);
  setCatalogNavVisible(true);
  applyCasaBranding();
  syncUrl();
}

function renderModels() {
  if (!allModels.length) {
    updateModelCount(0);
    catalogEl.innerHTML = '<div class="empty">No hay perfiles publicados en esta selección.</div>';
    renderCatalogFooter(renderMiCasaLink());
    return;
  }

  updateModelCount(allModels.length);
  catalogEl.innerHTML = allModels.map(renderCard).join("");
  renderCatalogFooter(renderMiCasaLink());
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

function getCasaCiudades() {
  return [
    ...new Set(casas.map((casa) => String(casa.ciudad ?? "").trim()).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "es"));
}

function casasForPicker() {
  const ciudad = getSelectedCiudad();

  if (!ciudad) {
    return casas;
  }

  const target = normalizeCity(ciudad);
  return casas.filter((casa) => normalizeCity(casa.ciudad) === target);
}

async function refreshCasasFromApi() {
  try {
    const res = await fetch("/api/casas", { cache: "no-store" });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    casas = Array.isArray(data) ? data : [];
    return true;
  } catch (error) {
    console.error("Error refrescando casas:", error);
    return false;
  }
}

async function fetchCasaCiudades() {
  try {
    const res = await fetch("/api/casas/ciudades", { cache: "no-store" });

    if (!res.ok) {
      return [];
    }

    const ciudades = await res.json();
    return Array.isArray(ciudades) ? ciudades : [];
  } catch (error) {
    console.error("Error cargando ciudades de casas:", error);
    return [];
  }
}

function renderCiudadSelect(ciudades) {
  const select = document.getElementById("ciudadFilter");
  const current = select?.value || "";
  const options = ['<option value="">Todas las ciudades</option>'].concat(
    ciudades.map(
      (ciudad) =>
        '<option value="' + escapeHtml(ciudad) + '">' + escapeHtml(ciudad) + "</option>"
    )
  );

  select.innerHTML = options.join("");

  if (current && ciudades.includes(current)) {
    select.value = current;
  }
}

async function updateCiudadOptions() {
  await refreshCasasFromApi();
  let ciudades = getCasaCiudades();

  if (!ciudades.length) {
    ciudades = await fetchCasaCiudades();
  }

  renderCiudadSelect(ciudades);
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
    '<span class="casa-card-eyebrow">Catálogo</span>' +
    "<h3>Independientes</h3>" +
    '<p class="casa-card-meta">Ver perfiles disponibles</p>' +
    '<span class="casa-card-cta">Ver perfiles →</span>' +
    "</button>"
  );
}

function renderCasaPicker() {
  const root = document.getElementById("casaCards");
  const visibleCasas = casasForPicker();
  const ciudad = getSelectedCiudad();

  if (!casas.length) {
    root.innerHTML =
      renderIndependentCard() +
      '<div class="empty casa-picker-empty">Todavía no hay casas registradas.</div>';
    return;
  }

  const cards = visibleCasas.map(renderCasaCard).join("");
  const emptyMessage = ciudad
    ? '<div class="empty casa-picker-empty">No hay casas en ' +
      escapeHtml(ciudad) +
      ".</div>"
    : "";

  root.innerHTML = cards + renderIndependentCard() + emptyMessage;
}

async function loadCasas() {
  try {
    await refreshCasasFromApi();
    await updateCiudadOptions();
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
  await showCatalog(slug);
  await loadModels();
}

document.getElementById("ciudadFilter").addEventListener("change", () => {
  renderCasaPicker();
  applyCasaBranding();
  syncUrl();
});

document.getElementById("backToMenuBtn").addEventListener("click", () => {
  showPicker();
});

if (backToMenuBtnInline) {
  backToMenuBtnInline.addEventListener("click", () => {
    showPicker();
  });
}

document.getElementById("casaCards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-casa]");

  if (!card) {
    return;
  }

  selectCasa(card.dataset.casa);
});

function readInitialCiudad() {
  return new URLSearchParams(window.location.search).get("ciudad") || "";
}

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

  const initialCiudad = readInitialCiudad();
  const ciudadSelect = document.getElementById("ciudadFilter");

  if (initialCiudad && ciudadSelect) {
    const ciudades = getCasaCiudades();

    if (ciudades.includes(initialCiudad)) {
      ciudadSelect.value = initialCiudad;
    }
  }

  renderCasaPicker();

  const initial = readInitialCasa();

  if (initial) {
    await selectCasa(initial);
    return;
  }

  showPicker();
}

bootCatalog();
