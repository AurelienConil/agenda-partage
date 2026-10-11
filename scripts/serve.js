// Serveur de développement local, sans la CLI Vercel :
//   npm run local   → http://localhost:3000
// Sert public/ et exécute les fonctions api/*.js avec les variables du .env.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// En local, on veut voir tout de suite les modifications faites dans
// Nextcloud : cache serveur réduit à 1 s (prioritaire sur le .env).
process.env.CACHE_TTL_SECONDS = "1";
process.loadEnvFile(path.join(root, ".env"));

const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

// Reproduit les helpers req.query / res.status / res.json de Vercel.
function vercelify(req, res, url) {
  req.query = Object.fromEntries(url.searchParams);
  // Pas de cache navigateur en local.
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) =>
    setHeader(name, name.toLowerCase() === "cache-control" ? "no-store" : value);
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const api = url.pathname.match(/^\/api\/([a-z0-9-]+)$/);
    if (api) {
      const { default: handler } = await import(path.join(root, "api", `${api[1]}.js`));
      vercelify(req, res, url);
      await handler(req, res);
      return;
    }

    const file = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(path.join(root, "public"))) throw Object.assign(new Error(), { code: "ENOENT" });
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ERR_MODULE_NOT_FOUND") {
      res.writeHead(404).end("Introuvable");
    } else {
      console.error(err);
      res.writeHead(500).end("Erreur serveur");
    }
  }
  console.log(req.method, url.pathname, res.statusCode);
}).listen(PORT, () => console.log(`ALT GR en local : http://localhost:${PORT}`));
