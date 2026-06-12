export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getRequestOrigin(request) {
  const url = new URL(request.url);
  return url.origin;
}

export function resolveSiteOrigin(request, env) {
  const configured = String(env?.SITE_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the request origin when SITE_URL is invalid.
    }
  }

  return getRequestOrigin(request);
}

function normalizeCity(ciudad) {
  return String(ciudad ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cityLabel(ciudad) {
  const value = String(ciudad ?? "").trim();
  return value || "Chile";
}

function buildKeywordList({ ciudad, nombre, extra = [] } = {}) {
  const city = cityLabel(ciudad);
  const cityNorm = normalizeCity(ciudad);
  const base = [
    "escort",
    "escorts",
    "escort chile",
    "escorts chile",
    "putas",
    "putas chile",
    "cariñosas",
    "cariñosas chile",
    "acompañantes",
    "acompañantes chile",
    "mujeres",
    "servicios escort",
    "catálogo escort"
  ];

  if (cityNorm && cityNorm !== "chile") {
    base.push(
      `escort ${city}`,
      `escorts ${city}`,
      `escort en ${city}`,
      `putas ${city}`,
      `putas en ${city}`,
      `cariñosas ${city}`,
      `cariñosas en ${city}`,
      `acompañantes ${city}`,
      `acompañantes en ${city}`
    );
  }

  if (nombre) {
    base.push(String(nombre).trim());
  }

  return [...new Set([...base, ...extra].map((item) => item.trim()).filter(Boolean))];
}

function renderMetaTag(name, content) {
  if (!content) {
    return "";
  }

  return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
}

function renderOgTag(property, content) {
  if (!content) {
    return "";
  }

  return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`;
}

export function renderSeoHead({
  title,
  description,
  keywords,
  canonical,
  robots = "index, follow",
  ogType = "website",
  ogImage = null,
  jsonLd = null,
  siteOrigin = null,
  googleSiteVerification = null
}) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    renderMetaTag("description", description),
    renderMetaTag("keywords", keywords?.join(", ")),
    renderMetaTag("robots", robots),
    renderMetaTag("googlebot", robots),
    googleSiteVerification
      ? renderMetaTag("google-site-verification", googleSiteVerification)
      : "",
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "",
    siteOrigin
      ? `<link rel="sitemap" type="application/xml" href="${escapeHtml(siteOrigin)}/sitemap.xml">`
      : "",
    renderOgTag("og:type", ogType),
    renderOgTag("og:title", title),
    renderOgTag("og:description", description),
    renderOgTag("og:url", canonical),
    renderOgTag("og:locale", "es_CL"),
    renderOgTag("og:site_name", "Escort Chile"),
    ogImage ? renderOgTag("og:image", ogImage) : "",
    renderMetaTag("twitter:card", ogImage ? "summary_large_image" : "summary"),
    renderMetaTag("twitter:title", title),
    renderMetaTag("twitter:description", description),
    ogImage ? renderMetaTag("twitter:image", ogImage) : ""
  ];

  if (jsonLd) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    );
  }

  return tags.filter(Boolean).join("\n");
}

export function injectSeo(html, seoHead) {
  if (html.includes("<!-- SEO_INJECT -->")) {
    return html.replace("<!-- SEO_INJECT -->", seoHead);
  }

  return html.replace("</head>", `${seoHead}\n</head>`);
}

export function injectCasaVisibleDefaults(html, casa) {
  const city = cityLabel(casa.ciudad);
  const label = casa.nombre || casa.slug || "Casa";

  return html
    .replace(
      'id="casaNombre">Cargando...<',
      `id="casaNombre">${escapeHtml(label)}<`
    )
    .replace(
      'id="casaSeoLine">Escorts, putas y cariñosas en Chile<',
      `id="casaSeoLine">Escort ${escapeHtml(city)}, putas y cariñosas. Catálogo de acompañantes en ${escapeHtml(city)}, Chile.<`
    )
    .replace(
      'id="casaCiudad"><',
      `id="casaCiudad">${casa.ciudad ? `Ciudad: ${escapeHtml(casa.ciudad)}` : ""}<`
    );
}

export function seoForCatalog(request, env) {
  const origin = resolveSiteOrigin(request, env);
  const canonical = `${origin}/`;
  const title = "Escort Chile · Putas, cariñosas y acompañantes por ciudad";
  const description =
    "Catálogo exclusivo de escorts en Chile. Encuentra escort Santiago, escort Temuco, putas, cariñosas y acompañantes verificadas por ciudad. Perfiles con fotos y contacto directo.";
  const keywords = buildKeywordList({
    extra: [
      "escort santiago",
      "escort temuco",
      "escort viña del mar",
      "escort concepción",
      "putas santiago",
      "cariñosas santiago"
    ]
  });

  const seoHead = renderSeoHead({
    title,
    description,
    keywords,
    canonical,
    siteOrigin: origin,
    googleSiteVerification: env?.GOOGLE_SITE_VERIFICATION || null,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Escort Chile",
      url: origin,
      description,
      inLanguage: "es-CL"
    }
  });

  return { seoHead, title, description };
}

export function seoForCasa(request, env, casa) {
  const origin = resolveSiteOrigin(request, env);
  const city = cityLabel(casa.ciudad);
  const canonical = `${origin}/${encodeURIComponent(casa.slug)}`;
  const title = `${casa.nombre} · Escort ${city} · Putas y cariñosas`;
  const description = `Escorts en ${city} con ${casa.nombre}. Catálogo de putas, cariñosas y acompañantes en ${city}, Chile. Perfiles con fotos reales y contacto por WhatsApp.`;
  const keywords = buildKeywordList({
    ciudad: city,
    nombre: casa.nombre,
    extra: [`${casa.nombre} escort`, `${casa.nombre} ${city}`]
  });

  const telefono = Array.isArray(casa.telefonos) ? casa.telefonos[0] : null;

  const seoHead = renderSeoHead({
    title,
    description,
    keywords,
    canonical,
    siteOrigin: origin,
    googleSiteVerification: env?.GOOGLE_SITE_VERIFICATION || null,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: casa.nombre,
      url: canonical,
      description,
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressCountry: "CL"
      },
      ...(telefono ? { telephone: telefono } : {}),
      areaServed: {
        "@type": "Country",
        name: "Chile"
      }
    }
  });

  return { seoHead, title, description };
}

export function seoForModel(request, env, casa, model) {
  const origin = resolveSiteOrigin(request, env);
  const city = cityLabel(model.ciudad || casa?.ciudad);
  const modelName = model.nombre || "Perfil";
  const casaSlug = casa?.slug || model?.casa_slug || "";
  const isIndependent = !casaSlug;
  const canonical = isIndependent
    ? `${origin}/perfil/${encodeURIComponent(model.id)}`
    : `${origin}/${encodeURIComponent(casaSlug)}/perfil/${encodeURIComponent(model.id)}`;
  const casaNombre = isIndependent ? "Independientes" : casa.nombre;
  const title = `${modelName} · Escort ${city} · ${casaNombre}`;
  const description = [
    `${modelName}, escort en ${city}.`,
    model.descripcion ? String(model.descripcion).trim() : "",
    isIndependent
      ? "Independientes. Escorts y cariñosas en Chile."
      : `Cariñosas y acompañantes de ${casaNombre}. Putas y escorts en Chile.`
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 320);
  const keywords = buildKeywordList({
    ciudad: city,
    nombre: modelName,
    extra: [
      `${modelName} escort`,
      `${modelName} ${city}`,
      `escort ${modelName}`,
      casaNombre
    ]
  });

  const foto = Array.isArray(model.fotos) && model.fotos.length ? model.fotos[0] : model.foto;
  const ogImage = foto ? `${origin}/img/${encodeURIComponent(foto)}` : null;

  const seoHead = renderSeoHead({
    title,
    description,
    keywords,
    canonical,
    ogType: "profile",
    ogImage,
    siteOrigin: origin,
    googleSiteVerification: env?.GOOGLE_SITE_VERIFICATION || null,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: title,
      url: canonical,
      description,
      mainEntity: {
        "@type": "Person",
        name: modelName,
        description: model.descripcion || description,
        ...(ogImage ? { image: ogImage } : {})
      }
    }
  });

  return { seoHead, title, description };
}

export function seoNoIndex(title) {
  return renderSeoHead({
    title,
    description: "Área privada.",
    keywords: [],
    canonical: null,
    robots: "noindex, nofollow"
  });
}

export function renderRobotsTxt(origin) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin-casa",
    "Disallow: /api/",
    `Sitemap: ${origin}/sitemap.xml`,
    ""
  ].join("\n");
}

export async function renderSitemapXml(request, env, { listCasas, listAllModels, listCasaCiudades }) {
  const origin = resolveSiteOrigin(request, env);
  const casas = await listCasas(env);
  const activeSlugs = new Set(casas.map((casa) => casa.slug));
  const models = await listAllModels(env, {});
  const ciudades = listCasaCiudades ? await listCasaCiudades(env) : [];
  const urls = [{ loc: `${origin}/`, changefreq: "daily", priority: "1.0" }];

  for (const ciudad of ciudades) {
    urls.push({
      loc: `${origin}/?ciudad=${encodeURIComponent(ciudad)}`,
      changefreq: "daily",
      priority: "0.85"
    });
  }

  for (const casa of casas) {
    urls.push({
      loc: `${origin}/${encodeURIComponent(casa.slug)}`,
      changefreq: "daily",
      priority: "0.9"
    });
  }

  for (const model of models) {
    if (!model.id) {
      continue;
    }

    if (model.casa_slug && !activeSlugs.has(model.casa_slug)) {
      continue;
    }

    if (!model.casa_slug) {
      urls.push({
        loc: `${origin}/perfil/${encodeURIComponent(model.id)}`,
        changefreq: "weekly",
        priority: "0.75",
        lastmod: model.created_at || null
      });
      continue;
    }

    urls.push({
      loc: `${origin}/${encodeURIComponent(model.casa_slug)}/perfil/${encodeURIComponent(model.id)}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: model.created_at || null
    });
  }

  const body = urls
    .map((entry) => {
      const parts = [
        "  <url>",
        `    <loc>${escapeHtml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${escapeHtml(entry.lastmod)}</lastmod>` : "",
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>"
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    "\n</urlset>\n"
  );
}
