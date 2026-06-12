import indexHtml from "../templates/index.html";
import adminHtml from "../templates/admin.html";
import adminCasaHtml from "../templates/admin-casa.html";
import modelHtml from "../templates/model.html";
import casaHtml from "../templates/casa.html";
import {
  injectSeo,
  seoForCatalog,
  seoForCasa,
  seoForModel,
  seoNoIndex,
  renderRobotsTxt,
  renderSitemapXml,
  getRequestOrigin,
  injectCasaVisibleDefaults
} from "./seo.js";
import {
  listModels,
  listAllModels,
  listModelCiudades,
  listCasaCiudades,
  getModel,
  createModel,
  appendModelPhotos,
  deleteModel,
  readModelFields,
  getStoredPhotos,
  listCasas,
  getCasa,
  createCasa,
  updateCasa,
  authenticateCasaAdmin,
  verifyCasaAdminSecret,
  getDefaultCasaSlug,
  isValidCasaSlug,
  isIndependentCasaFilter
} from "./models.js";

async function uploadImages(env, files) {
  const keys = [];

  for (const file of files) {
    if (!file || file.size <= 0) {
      continue;
    }

    const imageKey = crypto.randomUUID() + "-" + String(file.name).replace(/[^\w.\-]+/g, "_");

    await env.IMAGES.put(imageKey, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    keys.push(imageKey);
  }

  return keys;
}

async function deleteStoredPhotos(env, model) {
  if (!env.IMAGES || !model) {
    return;
  }

  for (const key of getStoredPhotos(model)) {
    await env.IMAGES.delete(key);
  }
}

const HTML_HEADERS = {
  "Content-Type": "text/html;charset=UTF-8"
};

const JSON_NO_STORE = {
  headers: {
    "Cache-Control": "no-store"
  }
};

const RESERVED_TOP_LEVEL = new Set(["api", "img", "admin", "css", "js"]);

function htmlResponse(content) {
  return new Response(content, { headers: HTML_HEADERS });
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function notFound() {
  return new Response("Not Found", { status: 404 });
}

function getSuperAdminSecret(env) {
  return env.SUPER_ADMIN_SECRET || env.ADMIN_SECRET;
}

function requireSuper(request, env) {
  const token = request.headers.get("Authorization");
  return Boolean(token) && token === getSuperAdminSecret(env);
}

async function canManageCasa(request, env, casaSlug) {
  if (requireSuper(request, env)) {
    return true;
  }

  const token = request.headers.get("Authorization");

  if (!token || !casaSlug) {
    return false;
  }

  return verifyCasaAdminSecret(env, casaSlug, token);
}

function injectCasaContext(html, casa) {
  const payload = JSON.stringify({
    slug: casa.slug,
    nombre: casa.nombre,
    ciudad: casa.ciudad ?? null,
    telefonos: casa.telefonos ?? []
  });

  return html.replace("</head>", `<script>window.__CASA__=${payload};</script></head>`);
}

function injectCatalogContext(html) {
  const payload = JSON.stringify({
    slug: "",
    nombre: "Selección exclusiva",
    ciudad: null
  });

  return html.replace("</head>", `<script>window.__CASA__=${payload};</script></head>`);
}

function withSeo(html, seoHead) {
  return injectSeo(html, seoHead);
}

async function resolveActiveCasa(env, slug) {
  const casa = await getCasa(env, slug);

  if (!casa || !casa.activa) {
    return null;
  }

  return casa;
}

async function serveCasaProfile(request, casa) {
  const { seoHead } = seoForCasa(request, casa);
  let html = injectCasaContext(casaHtml, casa);
  html = injectCasaVisibleDefaults(html, casa);
  html = withSeo(html, seoHead);
  return htmlResponse(html);
}

async function serveAdminCasa(request, casa) {
  const html = withSeo(
    injectCasaContext(adminCasaHtml, casa),
    seoNoIndex(`${casa.nombre} · Administración`)
  );
  return htmlResponse(html);
}

async function serveSuperAdmin() {
  return htmlResponse(withSeo(adminHtml, seoNoIndex("Administración general")));
}

async function serveIndependentModelProfile(request, env, model) {
  const { seoHead } = seoForModel(request, { slug: "", nombre: "Independientes", ciudad: null }, model);
  const html = withSeo(injectCatalogContext(modelHtml), seoHead);
  return htmlResponse(html);
}

async function serveModelProfile(request, env, casa, modelId) {
  const model = await getModel(env, modelId, casa.slug);

  if (!model) {
    return notFound();
  }

  const { seoHead } = seoForModel(request, casa, model);
  const html = withSeo(injectCasaContext(modelHtml, casa), seoHead);
  return htmlResponse(html);
}

async function handleModelApi(request, env, casaSlug, id, action) {
  if (action === "fotos" && request.method === "POST") {
    if (!(await canManageCasa(request, env, casaSlug))) {
      return unauthorized();
    }

    const form = await request.formData();
    const files = form.getAll("foto").filter((file) => file && file.size > 0);

    if (files.length === 0) {
      return Response.json({ ok: false, error: "Selecciona al menos una foto." }, { status: 400 });
    }

    if (!env.IMAGES) {
      return Response.json({ ok: false, error: "No hay binding R2 (IMAGES)." }, { status: 500 });
    }

    const newKeys = await uploadImages(env, files);
    const model = await appendModelPhotos(env, id, newKeys, casaSlug);

    if (!model) {
      return notFound();
    }

    return Response.json({ ok: true, fotos: model.fotos });
  }

  if (!action && request.method === "GET") {
    const model = await getModel(env, id, casaSlug);

    if (!model) {
      return notFound();
    }

    return Response.json(model, JSON_NO_STORE);
  }

  if (!action && request.method === "DELETE") {
    if (!(await canManageCasa(request, env, casaSlug))) {
      return unauthorized();
    }

    const row = await deleteModel(env, id, casaSlug);
    await deleteStoredPhotos(env, row);

    return Response.json({ ok: true });
  }

  return notFound();
}

async function handleCreateModel(request, env, casaSlug) {
  if (!(await canManageCasa(request, env, casaSlug))) {
    return unauthorized();
  }

  const casa = await resolveActiveCasa(env, casaSlug);

  if (!casa) {
    return notFound();
  }

  const form = await request.formData();
  const fields = readModelFields(form);
  const files = form.getAll("foto").filter((file) => file && file.size > 0);

  fields.casa_slug = casa.slug;

  if (files.length > 0) {
    if (!env.IMAGES) {
      return Response.json(
        {
          ok: false,
          error: "No hay binding R2 (IMAGES). En modo simulado puedes guardar sin fotos."
        },
        { status: 500 }
      );
    }

    fields.fotos = await uploadImages(env, files);
  }

  await createModel(env, fields);

  return Response.json({ ok: true });
}

async function handleCasaScopedApi(request, env, casaSlug, segments) {
  const resource = segments[2];

  if (resource === "login" && request.method === "POST") {
    const body = await request.json();
    const auth = await authenticateCasaAdmin(env, {
      casaSlug: body.slug,
      secret: body.secret,
      expectedSlug: casaSlug
    });

    if (!auth) {
      return unauthorized();
    }

    return Response.json({
      ok: true,
      role: "casa",
      casa: auth.casa.slug,
      nombre: auth.casa.nombre,
      token: auth.token
    });
  }

  if (resource === "models" && segments[3] === "ciudades" && request.method === "GET") {
    const casa = await resolveActiveCasa(env, casaSlug);

    if (!casa) {
      return notFound();
    }

    const ciudades = await listModelCiudades(env, casa.slug);
    return Response.json(ciudades, JSON_NO_STORE);
  }

  if (resource === "models" && request.method === "GET" && segments.length === 3) {
    const casa = await resolveActiveCasa(env, casaSlug);

    if (!casa) {
      return notFound();
    }

    const url = new URL(request.url);
    const ciudad = url.searchParams.get("ciudad");
    const results = await listModels(env, casa.slug, ciudad);
    return Response.json(results, JSON_NO_STORE);
  }

  if (resource === "model") {
    const id = segments[3];
    const action = segments[4];

    if (!id && request.method === "POST") {
      return handleCreateModel(request, env, casaSlug);
    }

    if (id) {
      return handleModelApi(request, env, casaSlug, id, action);
    }
  }

  return notFound();
}

async function handleSuperAdminApi(request, env, segments) {
  if (!requireSuper(request, env)) {
    return unauthorized();
  }

  const resource = segments[2];

  if (resource === "casas" && request.method === "GET" && segments.length === 3) {
    const casas = await listCasas(env, { activeOnly: false, admin: true });
    return Response.json(casas, JSON_NO_STORE);
  }

  if (resource === "casas" && request.method === "POST" && segments.length === 3) {
    try {
      const body = await request.json();
      const casa = await createCasa(env, body);
      return Response.json({
        ok: true,
        casa,
        admin_secret: casa.admin_secret
      });
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la casa." },
        { status: 400 }
      );
    }
  }

  const casaUpdate = segments[2] === "casas" && segments[3] && segments.length === 4;

  if (casaUpdate && request.method === "PUT") {
    try {
      const body = await request.json();
      const casa = await updateCasa(env, segments[3], body);
      return Response.json({
        ok: true,
        casa,
        admin_secret: casa.admin_secret ?? null
      });
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar la casa." },
        { status: 400 }
      );
    }
  }

  if (resource === "models" && segments[3] === "ciudades" && request.method === "GET") {
    const url = new URL(request.url);
    const casaFilter = url.searchParams.get("casa");
    const ciudades = await listModelCiudades(env, casaFilter || null);
    return Response.json(ciudades, JSON_NO_STORE);
  }

  if (resource === "models" && request.method === "GET" && segments.length === 3) {
    const url = new URL(request.url);
    const casaFilter = url.searchParams.get("casa");
    const ciudadFilter = url.searchParams.get("ciudad");
    const results = await listAllModels(env, {
      casa: casaFilter || null,
      ciudad: ciudadFilter || null
    });
    return Response.json(results, JSON_NO_STORE);
  }

  if (resource === "model") {
    const id = segments[3];
    const action = segments[4];

    if (!id && request.method === "POST") {
      const form = await request.formData();
      const fields = readModelFields(form);
      const casaSlug = String(form.get("casa_slug") ?? "").trim().toLowerCase();
      const files = form.getAll("foto").filter((file) => file && file.size > 0);

      if (isIndependentCasaFilter(casaSlug)) {
        fields.casa_slug = null;
      } else if (isValidCasaSlug(casaSlug)) {
        const casa = await getCasa(env, casaSlug);

        if (!casa) {
          return Response.json({ ok: false, error: "La casa no existe." }, { status: 400 });
        }

        fields.casa_slug = casa.slug;
      } else {
        return Response.json(
          { ok: false, error: "Selecciona una casa válida o la opción independiente." },
          { status: 400 }
        );
      }

      if (files.length > 0) {
        if (!env.IMAGES) {
          return Response.json({ ok: false, error: "No hay binding R2 (IMAGES)." }, { status: 500 });
        }

        fields.fotos = await uploadImages(env, files);
      }

      await createModel(env, fields);
      return Response.json({ ok: true });
    }

    if (id && action === "fotos" && request.method === "POST") {
      const form = await request.formData();
      const files = form.getAll("foto").filter((file) => file && file.size > 0);

      if (files.length === 0) {
        return Response.json({ ok: false, error: "Selecciona al menos una foto." }, { status: 400 });
      }

      if (!env.IMAGES) {
        return Response.json({ ok: false, error: "No hay binding R2 (IMAGES)." }, { status: 500 });
      }

      const newKeys = await uploadImages(env, files);
      const model = await appendModelPhotos(env, id, newKeys);

      if (!model) {
        return notFound();
      }

      return Response.json({ ok: true, fotos: model.fotos });
    }

    if (id && !action && request.method === "DELETE") {
      const row = await deleteModel(env, id);
      await deleteStoredPhotos(env, row);
      return Response.json({ ok: true });
    }
  }

  return notFound();
}

async function handleLegacyApi(request, env, pathname) {
  const defaultCasa = getDefaultCasaSlug(env);

  if (pathname === "/api/models" && request.method === "GET") {
    const results = await listModels(env, defaultCasa);
    return Response.json(results, JSON_NO_STORE);
  }

  if (pathname === "/api/model" && request.method === "POST") {
    return handleCreateModel(request, env, defaultCasa);
  }

  const modelRoute = pathname.match(/^\/api\/model\/([^/]+)(?:\/(fotos))?$/);

  if (modelRoute) {
    return handleModelApi(request, env, defaultCasa, modelRoute[1], modelRoute[2]);
  }

  return null;
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const defaultCasaSlug = getDefaultCasaSlug(env);

  if (pathname === "/api/login/casa" && request.method === "POST") {
    const body = await request.json();
    const auth = await authenticateCasaAdmin(env, {
      casaSlug: body.slug,
      secret: body.secret
    });

    if (!auth) {
      return unauthorized();
    }

    return Response.json({
      ok: true,
      role: "casa",
      casa: auth.casa.slug,
      nombre: auth.casa.nombre,
      token: auth.token
    });
  }

  if (pathname === "/api/login/super" && request.method === "POST") {
    const body = await request.json();

    if (body.secret === getSuperAdminSecret(env)) {
      return Response.json({
        ok: true,
        role: "super",
        token: getSuperAdminSecret(env)
      });
    }

    return unauthorized();
  }

  if (pathname === "/api/login" && request.method === "POST") {
    const body = await request.json();

    if (body.secret === getSuperAdminSecret(env)) {
      return Response.json({
        ok: true,
        role: "super",
        token: getSuperAdminSecret(env)
      });
    }

    return unauthorized();
  }

  if (pathname === "/api/casas" && request.method === "GET") {
    const casas = await listCasas(env);
    return Response.json(casas, JSON_NO_STORE);
  }

  if (segments[0] === "api" && segments[1] === "catalog" && segments[2] === "casas") {
    const catalogUrl = new URL(request.url);

    if (segments[3] === "ciudades" && request.method === "GET" && segments.length === 4) {
      const casaFilter = catalogUrl.searchParams.get("casa");
      const ciudades = await listCasaCiudades(env, casaFilter || null);
      return Response.json(ciudades, JSON_NO_STORE);
    }
  }

  if (segments[0] === "api" && segments[1] === "catalog" && segments[2] === "models") {
    const catalogUrl = new URL(request.url);

    if (segments[3] === "ciudades" && request.method === "GET" && segments.length === 4) {
      const casaFilter = catalogUrl.searchParams.get("casa");
      const ciudades = await listModelCiudades(env, casaFilter || null);
      return Response.json(ciudades, JSON_NO_STORE);
    }

    if (request.method === "GET" && segments.length === 3) {
      const casaFilter = catalogUrl.searchParams.get("casa");
      const ciudadFilter = catalogUrl.searchParams.get("ciudad");
      const casaCiudadFilter = catalogUrl.searchParams.get("casa_ciudad");
      const results = await listAllModels(env, {
        casa: casaFilter || null,
        ciudad: ciudadFilter || null,
        casaCiudad: casaCiudadFilter || null
      });
      return Response.json(results, JSON_NO_STORE);
    }
  }

  if (
    segments[0] === "api" &&
    segments[1] === "catalog" &&
    segments[2] === "model" &&
    segments[3] &&
    request.method === "GET" &&
    segments.length === 4
  ) {
    const model = await getModel(env, segments[3], null);

    if (!model) {
      return notFound();
    }

    return Response.json(model, JSON_NO_STORE);
  }

  if (segments[0] === "api" && segments[1] === "admin") {
    const response = await handleSuperAdminApi(request, env, segments);

    if (response) {
      return response;
    }
  }

  if (segments[0] === "api" && segments.length >= 3 && isValidCasaSlug(segments[1])) {
    const response = await handleCasaScopedApi(request, env, segments[1], segments);

    if (response) {
      return response;
    }
  }

  const legacyApi = await handleLegacyApi(request, env, pathname);

  if (legacyApi) {
    return legacyApi;
  }

  if (pathname.startsWith("/img/")) {
    const key = pathname.replace("/img/", "");
    const object = await env.IMAGES.get(key);

    if (!object) {
      return notFound();
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg"
      }
    });
  }

  if (pathname === "/robots.txt") {
    return new Response(renderRobotsTxt(getRequestOrigin(request)), {
      headers: { "Content-Type": "text/plain; charset=UTF-8" }
    });
  }

  if (pathname === "/sitemap.xml") {
    const xml = await renderSitemapXml(request, env, { listCasas, listAllModels });
    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=UTF-8" }
    });
  }

  if (pathname === "/") {
    const { seoHead } = seoForCatalog(request);
    return htmlResponse(withSeo(injectCatalogContext(indexHtml), seoHead));
  }

  if (pathname === "/admin") {
    return serveSuperAdmin();
  }

  if (pathname === "/admin-casa") {
    return htmlResponse(withSeo(adminCasaHtml, seoNoIndex("Administración de casa")));
  }

  const legacyProfile = pathname.match(/^\/perfil\/([^/]+)$/);

  if (legacyProfile) {
    const model = await getModel(env, legacyProfile[1], null);

    if (!model) {
      return notFound();
    }

    if (model.casa_slug) {
      const casa = await resolveActiveCasa(env, model.casa_slug);

      if (!casa) {
        return notFound();
      }

      return serveModelProfile(request, env, casa, legacyProfile[1]);
    }

    return serveIndependentModelProfile(request, env, model);
  }

  if (segments.length >= 1 && !RESERVED_TOP_LEVEL.has(segments[0]) && isValidCasaSlug(segments[0])) {
    const casaSlug = segments[0];
    const rest = segments.slice(1);
    const casa = await resolveActiveCasa(env, casaSlug);

    if (!casa) {
      return notFound();
    }

    if (rest.length === 0) {
      return serveCasaProfile(request, casa);
    }

    if (rest.length === 1 && (rest[0] === "admin-casa" || rest[0] === "admin")) {
      return serveAdminCasa(request, casa);
    }

    if (rest.length === 2 && rest[0] === "perfil") {
      return serveModelProfile(request, env, casa, rest[1]);
    }
  }

  return notFound();
}
