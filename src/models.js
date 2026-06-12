export const CASA_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MODEL_SELECT = `
  SELECT id, casa_slug, nombre, edad, altura, pelo, ciudad, whatsapp, descripcion, servicios, foto, fotos, created_at
  FROM models
`;

let mockModels = [];
let mockCasas = [];
let mockNextId = 1;

function useMockDb(env) {
  return env.USE_MOCK_DB === "true" || !env.DB;
}

function parseFotosJson(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseTelefonosJson(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function normalizeTelefonosInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeTelefonos(telefonos) {
  return JSON.stringify(normalizeTelefonosInput(telefonos));
}

function requireTelefonos(telefonos) {
  if (!normalizeTelefonosInput(telefonos).length) {
    throw new Error("La casa debe tener al menos un teléfono.");
  }
}

export function generateCasaAdminSecret() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function isCasaActiva(casa) {
  return casa?.activa !== 0 && casa?.activa !== false;
}

export function normalizeCasa(casa, { admin = false } = {}) {
  const normalized = {
    slug: casa.slug,
    nombre: casa.nombre,
    ciudad: casa.ciudad ?? null,
    telefonos: parseTelefonosJson(casa.telefonos),
    activa: isCasaActiva(casa),
    created_at: casa.created_at
  };

  if (admin) {
    normalized.has_admin_secret = Boolean(casa.admin_secret);
  }

  return normalized;
}

async function getCasaRow(env, slug) {
  if (!isValidCasaSlug(slug)) {
    return null;
  }

  if (useMockDb(env)) {
    return mockCasas.find((item) => item.slug === slug) ?? null;
  }

  return env.DB.prepare(
    "SELECT slug, nombre, ciudad, telefonos, admin_secret, activa, created_at FROM casas WHERE slug = ?"
  )
    .bind(slug)
    .first();
}

export async function getCasaAdminSecret(env, slug) {
  const row = await getCasaRow(env, slug);

  if (!row) {
    return null;
  }

  return row.admin_secret || env.CASA_ADMIN_SECRET || null;
}

export async function verifyCasaAdminSecret(env, slug, secret) {
  if (!secret) {
    return false;
  }

  const expected = await getCasaAdminSecret(env, slug);
  return Boolean(expected) && secret === expected;
}

export async function authenticateCasaAdmin(env, { casaSlug, secret, expectedSlug }) {
  const slugInput = String(casaSlug ?? "")
    .trim()
    .toLowerCase();
  const secretInput = String(secret ?? "").trim();

  if (!isValidCasaSlug(slugInput) || !secretInput) {
    return null;
  }

  if (expectedSlug && slugInput !== expectedSlug) {
    return null;
  }

  const casa = await getCasaRow(env, slugInput);

  if (!casa || !isCasaActiva(casa)) {
    return null;
  }

  const valid = await verifyCasaAdminSecret(env, casa.slug, secretInput);

  if (!valid) {
    return null;
  }

  return {
    casa: normalizeCasa(casa),
    token: secretInput
  };
}

export function isValidCasaSlug(slug) {
  return typeof slug === "string" && CASA_SLUG_PATTERN.test(slug);
}

export function getDefaultCasaSlug(env) {
  const slug = env.DEFAULT_CASA_SLUG || "casa-rocio";
  return isValidCasaSlug(slug) ? slug : "casa-rocio";
}

export async function listCasas(env, { activeOnly = true, admin = false } = {}) {
  if (useMockDb(env)) {
    const casas = activeOnly ? mockCasas.filter((casa) => casa.activa) : [...mockCasas];
    return casas.map((casa) => normalizeCasa(casa, { admin }));
  }

  const query = activeOnly
    ? "SELECT slug, nombre, ciudad, telefonos, admin_secret, activa, created_at FROM casas WHERE activa = 1 ORDER BY nombre ASC"
    : "SELECT slug, nombre, ciudad, telefonos, admin_secret, activa, created_at FROM casas ORDER BY nombre ASC";

  const { results } = await env.DB.prepare(query).all();
  return results.map((casa) => normalizeCasa(casa, { admin }));
}

export async function getCasa(env, slug) {
  const row = await getCasaRow(env, slug);
  return row ? normalizeCasa(row) : null;
}

export async function createCasa(env, fields) {
  const slug = String(fields.slug ?? "").trim().toLowerCase();
  const nombre = String(fields.nombre ?? "").trim();
  const ciudad = fields.ciudad ? String(fields.ciudad).trim() : null;

  if (!isValidCasaSlug(slug)) {
    throw new Error("Slug inválido. Usa minúsculas, números y guiones (ej: casa-rocio).");
  }

  if (!nombre) {
    throw new Error("El nombre de la casa es obligatorio.");
  }

  if (!ciudad) {
    throw new Error("La ciudad de la casa es obligatoria.");
  }

  const telefonos = normalizeTelefonosInput(fields.telefonos);
  requireTelefonos(telefonos);

  const adminSecret = String(fields.admin_secret ?? "").trim() || generateCasaAdminSecret();

  if (useMockDb(env)) {
    if (mockCasas.some((casa) => casa.slug === slug)) {
      throw new Error("Ya existe una casa con ese slug.");
    }

    const casa = {
      slug,
      nombre,
      ciudad,
      telefonos: serializeTelefonos(telefonos),
      admin_secret: adminSecret,
      activa: 1,
      created_at: new Date().toISOString()
    };

    mockCasas.push(casa);
    return { ...normalizeCasa(casa), admin_secret: adminSecret };
  }

  const existing = await getCasa(env, slug);

  if (existing) {
    throw new Error("Ya existe una casa con ese slug.");
  }

  await env.DB.prepare(
    "INSERT INTO casas (slug, nombre, ciudad, telefonos, admin_secret, activa, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))"
  )
    .bind(slug, nombre, ciudad, serializeTelefonos(telefonos), adminSecret)
    .run();

  return { ...(await getCasa(env, slug)), admin_secret: adminSecret };
}

export async function updateCasa(env, slug, fields) {
  const casa = await getCasa(env, slug);

  if (!casa) {
    throw new Error("Casa no encontrada.");
  }

  const nombre = fields.nombre !== undefined ? String(fields.nombre).trim() : casa.nombre;
  const ciudad =
    fields.ciudad !== undefined ? (fields.ciudad ? String(fields.ciudad).trim() : null) : casa.ciudad;
  const telefonos =
    fields.telefonos !== undefined ? normalizeTelefonosInput(fields.telefonos) : casa.telefonos;
  const activa =
    fields.activa !== undefined ? (fields.activa ? 1 : 0) : casa.activa ? 1 : 0;
  const nextSecret =
    fields.admin_secret !== undefined ? String(fields.admin_secret).trim() : null;
  const rotateSecret = fields.rotate_admin_secret === true;

  if (!nombre) {
    throw new Error("El nombre de la casa es obligatorio.");
  }

  requireTelefonos(telefonos);

  if (useMockDb(env)) {
    const stored = mockCasas.find((item) => item.slug === slug);

    if (!stored) {
      throw new Error("Casa no encontrada.");
    }

    stored.nombre = nombre;
    stored.ciudad = ciudad;
    stored.telefonos = serializeTelefonos(telefonos);
    stored.activa = activa === 1;

    if (rotateSecret) {
      stored.admin_secret = generateCasaAdminSecret();
    } else if (nextSecret) {
      stored.admin_secret = nextSecret;
    }

    const result = normalizeCasa(stored, { admin: true });

    if (rotateSecret || nextSecret) {
      return { ...result, admin_secret: stored.admin_secret };
    }

    return result;
  }

  let adminSecret = null;

  const telefonosJson = serializeTelefonos(telefonos);

  if (rotateSecret) {
    adminSecret = generateCasaAdminSecret();
    await env.DB.prepare(
      "UPDATE casas SET nombre = ?, ciudad = ?, telefonos = ?, activa = ?, admin_secret = ? WHERE slug = ?"
    )
      .bind(nombre, ciudad, telefonosJson, activa, adminSecret, slug)
      .run();
  } else if (nextSecret) {
    adminSecret = nextSecret;
    await env.DB.prepare(
      "UPDATE casas SET nombre = ?, ciudad = ?, telefonos = ?, activa = ?, admin_secret = ? WHERE slug = ?"
    )
      .bind(nombre, ciudad, telefonosJson, activa, adminSecret, slug)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE casas SET nombre = ?, ciudad = ?, telefonos = ?, activa = ? WHERE slug = ?"
    )
      .bind(nombre, ciudad, telefonosJson, activa, slug)
      .run();
  }

  const updated = await getCasa(env, slug);

  if (adminSecret) {
    return { ...updated, admin_secret: adminSecret };
  }

  return updated;
}

export function normalizeModel(model) {
  let fotos = Array.isArray(model.fotos) ? model.fotos.filter(Boolean) : parseFotosJson(model.fotos);

  if (fotos.length === 0 && model.foto) {
    fotos = [model.foto];
  }

  return {
    id: model.id,
    casa_slug: model.casa_slug || getDefaultCasaSlug({}),
    nombre: model.nombre,
    edad: model.edad,
    altura: model.altura,
    pelo: model.pelo,
    ciudad: model.ciudad,
    whatsapp: model.whatsapp,
    descripcion: model.descripcion,
    servicios: model.servicios,
    fotos,
    foto: fotos[0] ?? null,
    created_at: model.created_at
  };
}

function sortModels(models) {
  return [...models].sort((left, right) => {
    const leftDate = Date.parse(left.created_at || "") || 0;
    const rightDate = Date.parse(right.created_at || "") || 0;

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return Number(right.id || 0) - Number(left.id || 0);
  });
}

function matchesCasa(model, casaSlug) {
  return !casaSlug || model.casa_slug === casaSlug;
}

function matchesCiudad(model, ciudad) {
  if (!ciudad) {
    return true;
  }

  return String(model.ciudad ?? "").trim().toLowerCase() === String(ciudad).trim().toLowerCase();
}

function normalizeModelFilters(filters) {
  if (!filters) {
    return { casa: null, ciudad: null, casaCiudad: null };
  }

  if (typeof filters === "string") {
    return { casa: filters, ciudad: null, casaCiudad: null };
  }

  return {
    casa: filters.casa || null,
    ciudad: filters.ciudad || null,
    casaCiudad: filters.casaCiudad || null
  };
}

function matchesCasaCiudad(model, casaCiudad, casasBySlug) {
  if (!casaCiudad) {
    return true;
  }

  const casa = casasBySlug.get(model.casa_slug);

  if (!casa) {
    return false;
  }

  return (
    String(casa.ciudad ?? "").trim().toLowerCase() === String(casaCiudad).trim().toLowerCase()
  );
}

export async function listModels(env, casaSlug, ciudad) {
  const slug = casaSlug || getDefaultCasaSlug(env);
  return listAllModels(env, { casa: slug, ciudad: ciudad || null });
}

export async function listAllModels(env, filters) {
  const { casa, ciudad, casaCiudad } = normalizeModelFilters(filters);

  if (useMockDb(env)) {
    const casasBySlug = new Map(mockCasas.map((item) => [item.slug, item]));
    const models = mockModels.filter(
      (model) =>
        matchesCasa(model, casa) &&
        matchesCiudad(model, ciudad) &&
        matchesCasaCiudad(model, casaCiudad, casasBySlug)
    );

    return sortModels(models);
  }

  const conditions = [];
  const binds = [];

  if (casa) {
    conditions.push("casa_slug = ?");
    binds.push(casa);
  }

  if (ciudad) {
    conditions.push("LOWER(TRIM(ciudad)) = LOWER(TRIM(?))");
    binds.push(ciudad);
  }

  if (casaCiudad) {
    conditions.push(
      "casa_slug IN (SELECT slug FROM casas WHERE activa = 1 AND LOWER(TRIM(ciudad)) = LOWER(TRIM(?)))"
    );
    binds.push(casaCiudad);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `${MODEL_SELECT} ${where} ORDER BY created_at DESC, id DESC`;
  const statement = env.DB.prepare(query);

  const { results } = binds.length ? await statement.bind(...binds).all() : await statement.all();

  return results.map(normalizeModel);
}

export async function listModelCiudades(env, casaSlug) {
  if (useMockDb(env)) {
    const ciudades = new Set();

    for (const model of mockModels) {
      if (!matchesCasa(model, casaSlug)) {
        continue;
      }

      const ciudad = String(model.ciudad ?? "").trim();

      if (ciudad) {
        ciudades.add(ciudad);
      }
    }

    return [...ciudades].sort((left, right) => left.localeCompare(right, "es"));
  }

  const query = casaSlug
    ? `SELECT DISTINCT TRIM(ciudad) AS ciudad FROM models WHERE casa_slug = ? AND ciudad IS NOT NULL AND TRIM(ciudad) != '' ORDER BY ciudad ASC`
    : `SELECT DISTINCT TRIM(ciudad) AS ciudad FROM models WHERE ciudad IS NOT NULL AND TRIM(ciudad) != '' ORDER BY ciudad ASC`;

  const { results } = casaSlug
    ? await env.DB.prepare(query).bind(casaSlug).all()
    : await env.DB.prepare(query).all();

  return results.map((row) => row.ciudad).filter(Boolean);
}

export async function getModel(env, id, casaSlug) {
  if (useMockDb(env)) {
    const model = mockModels.find((item) => String(item.id) === String(id));
    return model && matchesCasa(model, casaSlug) ? model : null;
  }

  const query = casaSlug
    ? `${MODEL_SELECT} WHERE id = ? AND casa_slug = ?`
    : `${MODEL_SELECT} WHERE id = ?`;

  const row = casaSlug
    ? await env.DB.prepare(query).bind(id, casaSlug).first()
    : await env.DB.prepare(query).bind(id).first();

  return row ? normalizeModel(row) : null;
}

export async function createModel(env, fields) {
  const fotos = fields.fotos ?? [];
  const casaSlug = fields.casa_slug || getDefaultCasaSlug(env);
  const payload = {
    ...fields,
    casa_slug: casaSlug,
    fotos,
    foto: fotos[0] ?? null
  };

  if (useMockDb(env)) {
    const model = normalizeModel({
      id: mockNextId++,
      ...payload,
      created_at: new Date().toISOString()
    });

    mockModels.push(model);
    return model;
  }

  await env.DB.prepare(`
    INSERT INTO models
    (
      casa_slug,
      nombre,
      edad,
      altura,
      pelo,
      ciudad,
      whatsapp,
      descripcion,
      servicios,
      foto,
      fotos,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
    .bind(
      payload.casa_slug,
      payload.nombre,
      payload.edad,
      payload.altura,
      payload.pelo,
      payload.ciudad,
      payload.whatsapp,
      payload.descripcion,
      payload.servicios,
      payload.foto,
      fotos.length ? JSON.stringify(fotos) : null
    )
    .run();
}

export async function appendModelPhotos(env, id, newKeys, casaSlug) {
  if (!newKeys.length) {
    return getModel(env, id, casaSlug);
  }

  const model = await getModel(env, id, casaSlug);

  if (!model) {
    return null;
  }

  const fotos = [...model.fotos, ...newKeys];
  const foto = fotos[0] ?? null;

  if (useMockDb(env)) {
    const stored = mockModels.find((item) => String(item.id) === String(id));

    if (!stored) {
      return null;
    }

    stored.fotos = fotos;
    stored.foto = foto;
    return normalizeModel(stored);
  }

  const query = casaSlug
    ? "UPDATE models SET foto = ?, fotos = ? WHERE id = ? AND casa_slug = ?"
    : "UPDATE models SET foto = ?, fotos = ? WHERE id = ?";

  if (casaSlug) {
    await env.DB.prepare(query).bind(foto, JSON.stringify(fotos), id, casaSlug).run();
  } else {
    await env.DB.prepare(query).bind(foto, JSON.stringify(fotos), id).run();
  }

  return getModel(env, id, casaSlug);
}

export async function deleteModel(env, id, casaSlug) {
  if (useMockDb(env)) {
    const index = mockModels.findIndex(
      (model) => String(model.id) === String(id) && matchesCasa(model, casaSlug)
    );

    if (index === -1) {
      return null;
    }

    const [removed] = mockModels.splice(index, 1);
    return removed;
  }

  const selectQuery = casaSlug
    ? "SELECT foto, fotos, casa_slug FROM models WHERE id = ? AND casa_slug = ?"
    : "SELECT foto, fotos, casa_slug FROM models WHERE id = ?";

  const row = casaSlug
    ? await env.DB.prepare(selectQuery).bind(id, casaSlug).first()
    : await env.DB.prepare(selectQuery).bind(id).first();

  if (!row) {
    return null;
  }

  const deleteQuery = casaSlug
    ? "DELETE FROM models WHERE id = ? AND casa_slug = ?"
    : "DELETE FROM models WHERE id = ?";

  if (casaSlug) {
    await env.DB.prepare(deleteQuery).bind(id, casaSlug).run();
  } else {
    await env.DB.prepare(deleteQuery).bind(id).run();
  }

  return normalizeModel(row);
}

export function readModelFields(form) {
  return {
    nombre: form.get("nombre"),
    edad: form.get("edad") || null,
    altura: form.get("altura") || null,
    pelo: form.get("pelo") || null,
    ciudad: form.get("ciudad") || null,
    whatsapp: form.get("whatsapp") || null,
    descripcion: form.get("descripcion") || null,
    servicios: form.get("servicios") || null,
    fotos: []
  };
}

export function isStoredImage(foto) {
  return Boolean(foto) && !/^https?:\/\//i.test(foto);
}

export function getStoredPhotos(model) {
  const fotos = model?.fotos ?? (model?.foto ? [model.foto] : []);
  return fotos.filter(isStoredImage);
}
