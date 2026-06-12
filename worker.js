import { handleRequest } from "./src/router.js";

export default {
  async fetch(request, env) {
    try {
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
