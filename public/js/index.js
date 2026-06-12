import { escapeHtml, formatModelCount } from "./lib.js";
import { bindCatalogCards, createCardRenderer } from "./catalog.js";

function getCasa() {
  return window.__CASA__ || { slug: "", nombre: "Selección exclusiva", ciudad: null };
}

function getSelectedCasaSlug() {
  return document.getElementById("casaFilter")?.value || "";
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

function normalizeCity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function casasByCiudad(ciudad) {
  if (!ciudad) {
    return casas;
  }

  const target = normalizeCity(ciudad);
  const slugsWithModels = new Set(
    allModels
      .filter((model) => normalizeCity(model.ciudad) === target)
      .map((model) => model.casa_slug)
  );

  return casas.filter(
    (casa) => normalizeCity(casa.ciudad) === target || slugsWithModels.has(casa.slug)
  );
}

function casaProfileUrl(slug) {
  return "/" + encodeURIComponent(slug);
}

function profileBase(model) {
  const slug = model?.casa_slug || getSelectedCasaSlug() || getCasa().slug;
  return slug ? casaProfileUrl(slug) : "/";
}

function adminCasaUrl() {
  const slug = getSelectedCasaSlug() || getCasa().slug;
  return slug ? "/" + encodeURIComponent(slug) + "/admin-casa" : "/admin-casa";
}

function renderMiCasaLink() {
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

function casaLabel(slug) {
  const casa = casas.find((item) => item.slug === slug);
  return casa ? casa.nombre : slug;
}

const renderCard = createCardRenderer({
  profileUrl(model) {
    return profileBase(model) + "/perfil/" + encodeURIComponent(model.id);
  },
  showCasaTag: () => !getSelectedCasaSlug(),
  casaLabel,
  casaProfileUrl
});

function applyCasaBranding() {
  const selected = getSelectedCasaSlug();
  const badge = document.getElementById("casaBadge");
  const heroIntro = document.getElementById("heroIntro");
  const ciudad = document.getElementById("ciudadFilter")?.value || "";

  if (badge) {
    badge.textContent = selected ? casaLabel(selected) : "Todas las casas";
  }

  if (heroIntro) {
    heroIntro.textContent = selected
      ? "Catálogo de " +
        casaLabel(selected) +
        (ciudad ? " en " + ciudad : "") +
        ". Escorts, cariñosas y acompañantes en Chile."
      : ciudad
        ? "Escorts en " +
          ciudad +
          ". Putas, cariñosas y acompañantes verificadas en Chile."
        : "Catálogo de escorts en Chile: escort Santiago, escort Temuco, putas, cariñosas y acompañantes por ciudad.";
  }

  const profileLink = document.getElementById("casaProfileLink");

  if (profileLink) {
    if (selected) {
      profileLink.href = casaProfileUrl(selected);
      profileLink.textContent = "Ver perfil de " + casaLabel(selected) + " →";
      profileLink.hidden = false;
    } else {
      profileLink.hidden = true;
    }
  }
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
  if (el) {
    el.textContent = formatModelCount(total);
  }
}

function renderCatalogFooter(html) {
  document.getElementById("catalogFooter").innerHTML = html || "";
}

function renderModels() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const filtered = allModels.filter((model) => getSearchText(model).includes(query));

  if (!filtered.length) {
    updateModelCount(0);
    catalogEl.innerHTML =
      '<div class="empty">No hay perfiles que coincidan con esa búsqueda.</div>';
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
  const fromCasas = casas.map((casa) => String(casa.ciudad ?? "").trim()).filter(Boolean);
  const fromModels = allModels.map((model) => String(model.ciudad ?? "").trim()).filter(Boolean);
  const ciudades = [...new Set(fromCasas.concat(fromModels))].sort((left, right) =>
    left.localeCompare(right, "es")
  );

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

function renderCasaOptions() {
  const select = document.getElementById("casaFilter");
  const ciudad = document.getElementById("ciudadFilter").value;
  const current = select.value || "";
  const available = casasByCiudad(ciudad);

  select.innerHTML = ['<option value="">Todas las casas</option>']
    .concat(
      available.map(
        (casa) =>
          '<option value="' +
          escapeHtml(casa.slug) +
          '">' +
          escapeHtml(casa.nombre) +
          "</option>"
      )
    )
    .join("");

  if (current && available.some((casa) => casa.slug === current)) {
    select.value = current;
    return;
  }

  const injected = getCasa().slug;
  if (injected && available.some((casa) => casa.slug === injected)) {
    select.value = injected;
    return;
  }

  select.value = "";
}

async function loadCasas() {
  try {
    const res = await fetch("/api/casas", { cache: "no-store" });

    if (!res.ok) {
      casas = [];
      renderCiudadOptions();
      renderCasaOptions();
      return;
    }

    casas = await res.json();
    if (!Array.isArray(casas)) {
      casas = [];
    }

    renderCiudadOptions();
    renderCasaOptions();
    applyCasaBranding();
  } catch (error) {
    console.error("Error cargando casas:", error);
    casas = [];
    renderCasaOptions();
  }
}

async function loadModels() {
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
    renderCasaOptions();
    applyCasaBranding();
    renderModels();
  } catch (error) {
    updateModelCount(null);
    catalogEl.innerHTML = '<div class="loading">Error cargando perfiles</div>';
    renderCatalogFooter("");
    console.error(error);
  }
}

document.getElementById("search").addEventListener("input", renderModels);

document.getElementById("ciudadFilter").addEventListener("change", async () => {
  renderCasaOptions();
  applyCasaBranding();
  await loadModels();
});

document.getElementById("casaFilter").addEventListener("change", async () => {
  applyCasaBranding();
  await loadModels();
});

async function bootCatalog() {
  bindCatalogCards(catalogEl);
  await loadCasas();
  await loadModels();
}

bootCatalog();
