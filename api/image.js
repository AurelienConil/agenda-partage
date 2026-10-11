import { isValidSignature } from "../lib/image-proxy.js";

// Relais d'images : /api/image?url=…&sig=… (URL signée par /api/events).
// Le type est déterminé d'après le contenu réel du fichier, pas d'après ce
// qu'annonce le site d'origine.

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 8000;

// Signatures binaires des formats acceptés. Pas de SVG : il peut contenir
// du script.
function sniffImageType(buf) {
  const ascii = (start, end) => buf.subarray(start, end).toString("latin1");
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return "image/avif";
  return null;
}

export default async function handler(req, res) {
  const url = String(req.query?.url || "");
  const sig = String(req.query?.sig || "");

  if (!/^https?:\/\//i.test(url) || !isValidSignature(url, sig)) {
    res.status(403).json({ error: "URL d'image non autorisée." });
    return;
  }

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/avif,image/webp,image/*;q=0.8" },
    });
    if (!upstream.ok) throw new Error(`le site source a répondu ${upstream.status}`);
    if (Number(upstream.headers.get("content-length")) > MAX_BYTES) throw new Error("image trop lourde");

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("image trop lourde");

    const type = sniffImageType(buf);
    if (!type) throw new Error("le fichier n'est pas une image reconnue");

    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    // Une URL d'image change rarement de contenu : le CDN de Vercel la garde
    // une semaine, le navigateur un jour.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.status(200).end(buf);
  } catch (err) {
    console.error(`Image ${url} :`, err.message);
    res.status(502).json({ error: `Image indisponible : ${err.message}` });
  }
}
