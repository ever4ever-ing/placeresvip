# Placeres VIP

Catálogo multi-casa de perfiles desplegado en **Cloudflare Workers**, con base de datos **D1**, imágenes en **R2** y sitio público en [placeresvip.cl](https://placeresvip.cl).

Cada **casa** tiene su propia página, catálogo de perfiles y panel de administración. El sitio incluye perfiles **independientes**, SEO server-side, sitemap dinámico y gestión de fotos.

---

## Stack

| Componente | Uso |
|------------|-----|
| [Cloudflare Workers](https://developers.cloudflare.com/workers/) | Backend, enrutamiento y SSR |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | SQLite — casas y perfiles |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Almacenamiento de imágenes |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | CLI de desarrollo y deploy |
| HTML + CSS + JS vanilla | Frontend (sin framework) |

---

## Estructura del proyecto

```
placeresvip/
├── worker.js              # Punto de entrada del Worker
├── wrangler.jsonc         # Configuración de Cloudflare
├── model.sql              # Esquema completo de la base de datos
├── migration-*.sql        # Migraciones incrementales
├── package.json
│
├── src/
│   ├── router.js          # Rutas HTTP, API y páginas HTML
│   ├── models.js          # Acceso a D1, normalización, auth de casas
│   ├── seo.js             # Meta tags, sitemap, robots.txt
│   └── crawlable.js       # HTML crawlable para buscadores
│
├── templates/             # Plantillas HTML (importadas en el Worker)
│   ├── index.html         # Menú principal / selector de casas
│   ├── casa.html          # Página pública de una casa
│   ├── model.html         # Perfil individual
│   ├── admin.html         # Admin general (super admin)
│   └── admin-casa.html    # Admin de cada casa
│
└── public/                # Assets estáticos (servidos vía binding ASSETS)
    ├── css/
    └── js/
```

---

## Funcionalidades

### Sitio público

- **Menú principal** (`/`) — listado de casas con foto de perfil y filtro por ciudad.
- **Página de casa** (`/{slug}`) — catálogo de perfiles, búsqueda y datos de contacto.
- **Perfil** (`/{slug}/perfil/{id}`) — carrusel de fotos, datos y enlace a WhatsApp con mensaje predefinido.
- **Independientes** (`/independientes`) — perfiles sin casa asignada.
- **URLs limpias** — redirección 301 desde `/?casa=slug` hacia `/{slug}`.
- **Icono discreto** al pie de cada casa para acceder al panel de admin (`/{slug}/admin-casa`).

### Administración

| Panel | URL | Acceso |
|-------|-----|--------|
| Super admin | `/admin` | `SUPER_ADMIN_SECRET` |
| Admin de casa | `/{slug}/admin-casa` | Clave `admin_secret` de la casa |

**Super admin** puede:

- Crear y editar casas (nombre, ciudad, teléfonos, activa/inactiva, foto de perfil).
- Gestionar todos los perfiles (crear, eliminar, fotos, activo/inactivo).
- Asignar perfiles a una casa o como independientes.

**Admin de casa** puede:

- Subir o cambiar la foto de perfil de la casa.
- Crear perfiles con múltiples fotos.
- Agregar o eliminar fotos del carrusel de cada chica.
- Activar o desactivar perfiles en el catálogo público.
- Filtrar perfiles por ciudad.

Los perfiles **inactivos** no aparecen en el sitio público ni en el sitemap, pero siguen visibles en el admin.

### SEO

- Meta tags, Open Graph y JSON-LD inyectados en el servidor.
- `sitemap.xml` y `robots.txt` generados dinámicamente.
- Enlaces crawlables en HTML para indexación (Google).
- Variable `SITE_URL` como origen canónico; redirección 301 desde `*.workers.dev`.
- Soporte opcional para `GOOGLE_SITE_VERIFICATION`.

### Imágenes

- Subida a R2 con clave UUID.
- Servidas en `/img/{clave}`.
- Al eliminar un perfil o una foto, se borra el objeto en R2 (excepto URLs externas `http(s)://`).

---

## Rutas públicas

| Ruta | Descripción |
|------|-------------|
| `/` | Menú de casas |
| `/independientes` | Catálogo independientes |
| `/{slug}` | Página de la casa |
| `/{slug}/perfil/{id}` | Perfil dentro de una casa |
| `/perfil/{id}` | Perfil legacy (redirige lógica según casa) |
| `/sitemap.xml` | Sitemap |
| `/robots.txt` | Robots |
| `/img/{key}` | Imagen desde R2 |

---

## API

### Catálogo (público)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/casas` | Casas activas |
| GET | `/api/casas/ciudades` | Ciudades de casas |
| GET | `/api/catalog/models?casa=&ciudad=&casa_ciudad=` | Perfiles activos |
| GET | `/api/catalog/models/ciudades?casa=` | Ciudades con perfiles |
| GET | `/api/catalog/model/{id}` | Perfil activo por ID |

### Autenticación

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| POST | `/api/login/super` | `{ "secret": "..." }` | Token para super admin |
| POST | `/api/login/casa` | `{ "slug": "...", "secret": "..." }` | Token de sesión casa |

El token se envía en el header `Authorization` en las peticiones protegidas.

### Super admin — `/api/admin/*`

Requiere header `Authorization: {SUPER_ADMIN_SECRET}`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/casas` | Todas las casas |
| POST | `/api/admin/casas` | Crear casa |
| PUT | `/api/admin/casas/{slug}` | Actualizar casa |
| POST | `/api/admin/casas/{slug}/foto` | Foto de perfil de casa |
| GET | `/api/admin/models?casa=&ciudad=` | Todos los perfiles |
| GET | `/api/admin/models/ciudades?casa=` | Ciudades |
| POST | `/api/admin/model` | Crear perfil (multipart) |
| POST | `/api/admin/model/{id}/fotos` | Agregar fotos |
| DELETE | `/api/admin/model/{id}/fotos` | Eliminar foto `{ "index": 0 }` |
| PATCH | `/api/admin/model/{id}` | `{ "activa": true/false }` |
| DELETE | `/api/admin/model/{id}` | Eliminar perfil |

### Admin de casa — `/api/{slug}/*`

Requiere header `Authorization: {admin_secret de la casa}` (o super admin).

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/{slug}/login` | Login (mismo body que `/api/login/casa`) |
| POST | `/api/{slug}/casa/foto` | Foto de perfil de la casa |
| GET | `/api/{slug}/models?ciudad=` | Perfiles de la casa (incluye inactivos) |
| GET | `/api/{slug}/models/ciudades` | Ciudades |
| POST | `/api/{slug}/model` | Crear perfil |
| POST | `/api/{slug}/model/{id}/fotos` | Agregar fotos |
| DELETE | `/api/{slug}/model/{id}/fotos` | Eliminar foto |
| PATCH | `/api/{slug}/model/{id}` | Activar/desactivar perfil |
| DELETE | `/api/{slug}/model/{id}` | Eliminar perfil |

---

## Base de datos (D1)

### Tabla `casas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `slug` | TEXT PK | Identificador URL (`casa-rocio`) |
| `nombre` | TEXT | Nombre visible |
| `ciudad` | TEXT | Ciudad principal |
| `telefonos` | TEXT | JSON array de teléfonos |
| `admin_secret` | TEXT | Clave del admin de casa |
| `activa` | INTEGER | 1 = visible en el menú |
| `foto` | TEXT | Clave R2 o URL |
| `created_at` | TEXT | Fecha de creación |

### Tabla `models`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | ID autoincremental |
| `casa_slug` | TEXT | Casa (NULL = independiente) |
| `nombre`, `edad`, `altura`, `pelo`, `ciudad` | | Datos del perfil |
| `whatsapp` | TEXT | Contacto WhatsApp |
| `descripcion`, `servicios` | TEXT | Texto y servicios (coma) |
| `foto` | TEXT | Miniatura (primera del carrusel) |
| `fotos` | TEXT | JSON array de claves/URLs |
| `activa` | INTEGER | 1 = visible en catálogo público |
| `created_at` | TEXT | Fecha de creación |

---

## Configuración

### Variables en `wrangler.jsonc`

| Variable | Descripción |
|----------|-------------|
| `SITE_URL` | URL canónica del sitio (ej. `https://placeresvip.cl`) |
| `DEFAULT_CASA_SLUG` | Slug por defecto para rutas legacy |
| `USE_MOCK_DB` | `"true"` para desarrollo sin D1 |

### Secrets (Wrangler)

```bash
npx wrangler secret put SUPER_ADMIN_SECRET
npx wrangler secret put GOOGLE_SITE_VERIFICATION   # opcional, SEO
```

| Secret | Descripción |
|--------|-------------|
| `SUPER_ADMIN_SECRET` | Clave del panel `/admin` |
| `ADMIN_SECRET` | Alias alternativo del super admin |
| `CASA_ADMIN_SECRET` | Fallback global si una casa no tiene `admin_secret` |
| `GOOGLE_SITE_VERIFICATION` | Meta tag de verificación de Search Console |

---

## Desarrollo local

### Requisitos

- Node.js 18+
- Cuenta Cloudflare con D1 y R2 configurados
- Wrangler autenticado (`npx wrangler login`)

### Instalación

```bash
npm install
```

### Base de datos local

```bash
npm run db:local
# equivalente a:
# npx wrangler d1 execute casa-rocio --local --file=./model.sql
```

### Servidor de desarrollo

```bash
npm run dev
```

Wrangler expone el Worker en `http://localhost:8787` con bindings locales de D1 y R2.

### Modo mock (sin D1)

En `wrangler.jsonc` o `.dev.vars`:

```
USE_MOCK_DB=true
```

---

## Despliegue

```bash
npm run deploy
# equivalente a:
# npx wrangler deploy
```

### Migraciones en producción

Ejecutar en orden si la base ya existía antes de una actualización:

```bash
npx wrangler d1 execute casa-rocio --remote --file=./migration-nullable-casa.sql
npx wrangler d1 execute casa-rocio --remote --file=./migration-casa-foto.sql
npx wrangler d1 execute casa-rocio --remote --file=./migration-model-activa.sql
```

Para una instalación nueva, basta con:

```bash
npm run db:remote
```

---

## Bindings de Cloudflare

Definidos en `wrangler.jsonc`:

| Binding | Tipo | Uso |
|---------|------|-----|
| `DB` | D1 | Base de datos `casa-rocio` |
| `IMAGES` | R2 | Bucket `casa-rocio` |
| `ASSETS` | Static Assets | Carpeta `public/` |

---

## Flujo de autenticación (admin casa)

1. El admin entra a `/{slug}/admin-casa` (o usa el icono discreto al pie de la casa).
2. Ingresa slug y clave (`admin_secret` generada al crear la casa).
3. El frontend guarda el token en `localStorage` (`casaAdminToken:{slug}`).
4. Las peticiones API incluyen `Authorization: {token}`.
5. Si la sesión expira (401), se cierra sesión automáticamente.

---

## SEO post-despliegue

1. Verificar dominio en [Google Search Console](https://search.google.com/search-console).
2. Enviar sitemap: `https://placeresvip.cl/sitemap.xml`.
3. Opcional: configurar `GOOGLE_SITE_VERIFICATION` como secret.

---

## Scripts npm

| Script | Acción |
|--------|--------|
| `npm run dev` | Servidor local con Wrangler |
| `npm run deploy` | Despliegue a Cloudflare |
| `npm run db:local` | Aplicar esquema en D1 local |
| `npm run db:remote` | Aplicar esquema en D1 remoto |

---

## Notas

- El Worker se llama `casa-rocio` en Cloudflare (nombre histórico del proyecto).
- Las plantillas HTML se importan como módulos ES en el bundle del Worker; no se sirven como archivos sueltos.
- Los perfiles independientes usan `casa_slug` NULL y el filtro `casa=independiente` en la API de catálogo.
- WhatsApp abre con mensaje: *"Hola, te vi en placeresvip.cl"* (configurable en `public/js/lib.js`).
