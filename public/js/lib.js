export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

export function photoSrc(foto) {
  if (!foto) {
    return "";
  }

  if (foto.startsWith("http://") || foto.startsWith("https://")) {
    return foto;
  }

  return "/img/" + encodeURIComponent(foto);
}

export function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function getServices(model) {
  return String(model.servicios ?? "")
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}

export function formatModelCount(total) {
  if (total === null || total === undefined) {
    return "Cargando catálogo...";
  }

  return (
    total +
    " perfil" +
    (total === 1 ? "" : "es") +
    " disponible" +
    (total === 1 ? "" : "s")
  );
}

export const WHATSAPP_LEAD_MESSAGE = "Hola, te vi en placeresvip.cl";

export function whatsAppUrl(phone, message = WHATSAPP_LEAD_MESSAGE) {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const params = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${params}`;
}
