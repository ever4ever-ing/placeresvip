import {
  escapeHtml,
  valueOrDash,
  photoSrc,
  formatDate,
  getServices
} from "./lib.js";

export function bindCatalogCards(root) {
  if (!root) {
    return;
  }

  root.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) {
      return;
    }

    const card = event.target.closest(".card[data-href]");

    if (card) {
      window.location.href = card.dataset.href;
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.target.closest("a, button, input, select, textarea")) {
      return;
    }

    const card = event.target.closest(".card[data-href]");

    if (card) {
      event.preventDefault();
      window.location.href = card.dataset.href;
    }
  });
}

export function createCardRenderer(options) {
  const {
    profileUrl,
    showCasaTag = () => false,
    casaLabel = () => "",
    casaProfileUrl = () => "/"
  } = options;

  return function renderCard(model) {
    const services = getServices(model);
    const src = photoSrc(model.foto);
    const photoMarkup = src
      ? '<img src="' +
        escapeHtml(src) +
        '" alt="' +
        escapeHtml(valueOrDash(model.nombre)) +
        '" loading="lazy" decoding="async">'
      : '<div class="card-placeholder">Sin foto</div>';
    const tagItems = [];

    if (showCasaTag()) {
      if (model.casa_slug) {
        tagItems.push(
          '<a class="tag" href="' +
            casaProfileUrl(model.casa_slug) +
            '">' +
            escapeHtml(casaLabel(model.casa_slug)) +
            "</a>"
        );
      } else {
        tagItems.push('<span class="tag">Independiente</span>');
      }
    }

    services.forEach((service) => {
      tagItems.push('<span class="tag">' + escapeHtml(service) + "</span>");
    });

    if (!tagItems.length) {
      tagItems.push('<span class="tag">Sin servicios</span>');
    }

    const href = profileUrl(model);

    return (
      '<article class="card" data-href="' +
      escapeHtml(href) +
      '" tabindex="0" role="link" aria-label="Ver perfil de ' +
      escapeHtml(valueOrDash(model.nombre)) +
      '">' +
      '<div class="card-media">' +
      photoMarkup +
      '<div class="card-overlay">' +
      '<span class="id-badge">#' +
      escapeHtml(model.id) +
      "</span>" +
      '<span class="date-chip">' +
      escapeHtml(formatDate(model.created_at)) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="card-body">' +
      "<h2>" +
      escapeHtml(valueOrDash(model.nombre)) +
      "</h2>" +
      '<div class="meta">' +
      "<div><label>Edad</label><strong>" +
      escapeHtml(valueOrDash(model.edad)) +
      "</strong></div>" +
      "<div><label>Altura</label><strong>" +
      escapeHtml(valueOrDash(model.altura)) +
      " cm</strong></div>" +
      "<div><label>Pelo</label><strong>" +
      escapeHtml(valueOrDash(model.pelo)) +
      "</strong></div>" +
      "<div><label>Ciudad</label><strong>" +
      escapeHtml(valueOrDash(model.ciudad)) +
      "</strong></div>" +
      "</div>" +
      '<p class="card-desc">' +
      escapeHtml(model.descripcion || "") +
      "</p>" +
      '<div class="tags">' +
      tagItems.join("") +
      "</div>" +
      '<div class="card-cta">Ver perfil completo</div>' +
      "</div>" +
      "</article>"
    );
  };
}
