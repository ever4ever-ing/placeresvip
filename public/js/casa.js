import { escapeHtml, formatModelCount, whatsAppUrl } from "./lib.js";
import { bindCatalogCards, createCardRenderer } from "./catalog.js";

function getCasa() {
  return window.__CASA__ || { slug: "", nombre: "", ciudad: null, telefonos: [] };
}

function phoneDigits(phone) {
  return String(phone).replace(/\D/g, "");
}

function renderPhoneLinks(telefonos) {
  if (!Array.isArray(telefonos) || !telefonos.length) {
    return '<span class="casa-meta">Sin teléfonos publicados.</span>';
  }

  return telefonos
    .map((phone) => {
      const digits = phoneDigits(phone);
      const label = escapeHtml(phone);
      const wa = digits
        ? '<a class="whatsapp-link" href="' +
          escapeHtml(whatsAppUrl(phone)) +
          '" target="_blank" rel="noopener">WhatsApp ' +
          label +
          "</a>"
        : "";
      const tel = digits
        ? '<a class="phone-link" href="tel:+' + escapeHtml(digits) + '">Llamar ' + label + "</a>"
        : '<span class="phone-link">' + label + "</span>";
      return wa + tel;
    })
    .join("");
}

function applyCasaBranding() {
  const casa = getCasa();
  const label = casa.nombre || casa.slug || "Casa";
  const city = casa.ciudad ? String(casa.ciudad).trim() : "Chile";

  document.getElementById("casaEyebrow").textContent = "Escort " + city;
  document.getElementById("casaNombre").textContent = label;
  document.getElementById("casaSeoLine").textContent =
    "Escort " +
    city +
    ", putas y cariñosas. Catálogo de acompañantes en " +
    city +
    ", Chile.";
  document.getElementById("casaCiudad").textContent = casa.ciudad
    ? "Ciudad: " + casa.ciudad
    : "";
  document.getElementById("casaPhones").innerHTML = renderPhoneLinks(casa.telefonos);
}

const renderCard = createCardRenderer({
  profileUrl(model) {
    return (
      "/" + encodeURIComponent(getCasa().slug) + "/perfil/" + encodeURIComponent(model.id)
    );
  }
});

let allModels = [];

function getSearchText(model) {
  return [
    model.id,
    model.nombre,
    model.edad,
    model.altura,
    model.pelo,
    model.ciudad,
    model.descripcion,
    model.servicios
  ]
    .join(" ")
    .toLowerCase();
}

function renderModels() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const filtered = allModels.filter((model) => getSearchText(model).includes(query));
  document.getElementById("modelCount").textContent = formatModelCount(filtered.length);

  if (!filtered.length) {
    document.getElementById("models").innerHTML =
      '<div class="empty">No hay perfiles que coincidan con tu búsqueda.</div>';
    return;
  }

  document.getElementById("models").innerHTML = filtered.map(renderCard).join("");
}

async function loadModels() {
  const casa = getCasa().slug;
  const params = new URLSearchParams({ casa });

  document.getElementById("models").innerHTML = '<div class="loading">Cargando perfiles...</div>';

  const res = await fetch("/api/catalog/models?" + params.toString(), { cache: "no-store" });

  if (!res.ok) {
    document.getElementById("models").innerHTML =
      '<div class="empty">No se pudo cargar el catálogo.</div>';
    return;
  }

  const models = await res.json();
  allModels = Array.isArray(models) ? models : [];
  renderModels();
}

document.getElementById("search").addEventListener("input", renderModels);

async function boot() {
  bindCatalogCards(document.getElementById("models"));
  applyCasaBranding();
  await loadModels();
}

boot();
