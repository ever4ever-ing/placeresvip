import { handleRequest } from "./src/router.js";

function canonicalRedirect(request, env) {
  const siteUrl = String(env?.SITE_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  if (!siteUrl) {
    return null;
  }

  let canonicalOrigin;

  try {
    canonicalOrigin = new URL(siteUrl).origin;
  } catch {
    return null;
  }

  const url = new URL(request.url);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return null;
  }

  if (url.origin === canonicalOrigin) {
    return null;
  }

  url.protocol = new URL(canonicalOrigin).protocol;
  url.host = new URL(canonicalOrigin).host;

  return Response.redirect(url.toString(), 301);
}

export default {
  async fetch(request, env) {
    try {
      const redirect = canonicalRedirect(request, env);

      if (redirect) {
        return redirect;
      }

      const response = await handleRequest(request, env);

      if (response.status !== 404 || !env.ASSETS) {
        return response;
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);

      return new Response("Error interno del servidor", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
  }
};
