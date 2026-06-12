import { escapeHtml } from "./seo.js";

const INDEPENDENT_CASA = "independiente";

function replaceMarker(html, marker, content) {
  const token = `<!-- ${marker} -->`;

  if (html.includes(token)) {
    return html.replace(token, content);
  }

  return html;
}

function profileUrl(origin, casaSlug, modelId) {
  if (!casaSlug) {
    return `${origin}/perfil/${encodeURIComponent(modelId)}`;
  }

  return `${origin}/${encodeURIComponent(casaSlug)}/perfil/${encodeURIComponent(modelId)}`;
}

export function injectIndexCrawlables(html, origin, casas, ciudades = []) {
  const cards = casas
    .map((casa) => {
      const city = casa.ciudad ? escapeHtml(casa.ciudad) : "Chile";
      const href = `${origin}/${encodeURIComponent(casa.slug)}`;

      return (
        `<a class="casa-card" href="${escapeHtml(href)}">` +
        '<span class="casa-card-eyebrow">Casa</span>' +
        `<h3>${escapeHtml(casa.nombre)}</h3>` +
        `<p class="casa-card-meta">${city}</p>` +
        '<span class="casa-card-cta">Ver catálogo</span>' +
        "</a>"
      );
    })
    .join("");

  const independent =
    `<a class="casa-card casa-card-independent" href="${escapeHtml(origin)}/?casa=${INDEPENDENT_CASA}">` +
    '<span class="casa-card-eyebrow">Catálogo</span>' +
    "<h3>Independientes</h3>" +
    '<p class="casa-card-meta">Ver perfiles disponibles</p>' +
    '<span class="casa-card-cta">Ver perfiles</span>' +
    "</a>";

  const cityLinks = ciudades
    .map((ciudad) => {
      const href = `${origin}/?ciudad=${encodeURIComponent(ciudad)}`;
      return `<li><a href="${escapeHtml(href)}">Escorts en ${escapeHtml(ciudad)}</a></li>`;
    })
    .join("");

  const cityNav = cityLinks
    ? `<nav class="seo-city-nav" aria-label="Ciudades"><ul>${cityLinks}</ul></nav>`
    : "";

  return replaceMarker(html, "CRAWL_CASA_CARDS", cards + independent + cityNav);
}

export function injectCasaModelLinks(html, origin, casa, models) {
  if (!Array.isArray(models) || !models.length) {
    return replaceMarker(
      html,
      "CRAWL_MODEL_LINKS",
      '<p class="seo-empty">No hay perfiles publicados en esta casa.</p>'
    );
  }

  const links = models
    .map((model) => {
      const href = profileUrl(origin, casa.slug, model.id);
      const name = escapeHtml(model.nombre || "Perfil");
      const city = model.ciudad || casa.ciudad || "";

      return (
        `<article class="seo-model-link">` +
        `<h3><a href="${escapeHtml(href)}">${name}</a></h3>` +
        (city ? `<p>${escapeHtml(city)}</p>` : "") +
        (model.descripcion
          ? `<p>${escapeHtml(String(model.descripcion).slice(0, 200))}</p>`
          : "") +
        "</article>"
      );
    })
    .join("");

  return replaceMarker(html, "CRAWL_MODEL_LINKS", links);
}

export function injectModelPreview(html, origin, casa, model) {
  const href = profileUrl(origin, casa?.slug || null, model.id);
  const city = model.ciudad || casa?.ciudad || "Chile";
  const casaLabel = casa?.nombre || "Independientes";
  const description = model.descripcion ? escapeHtml(String(model.descripcion).slice(0, 400)) : "";

  const preview =
    '<article class="profile-preview">' +
    `<h1>${escapeHtml(model.nombre || "Perfil")}</h1>` +
    `<p><strong>${escapeHtml(casaLabel)}</strong> · Escort ${escapeHtml(city)}</p>` +
    (description ? `<p>${description}</p>` : "") +
    `<p><a href="${escapeHtml(href)}">Ver perfil completo</a></p>` +
    "</article>";

  return replaceMarker(html, "CRAWL_MODEL_PROFILE", preview);
}
