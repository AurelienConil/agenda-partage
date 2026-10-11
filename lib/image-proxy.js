import crypto from "node:crypto";

// Les images de l'agenda passent par /api/image, qui les renvoie avec le bon
// type MIME (certains sites, comme l'Hexagone, servent leurs .avif en
// "text/plain" + nosniff : le navigateur refuse alors de les afficher).
// Pour que ce relais ne serve pas à télécharger n'importe quoi, chaque URL
// est signée par /api/events : /api/image n'accepte que les URLs signées.

function secret() {
  return process.env.IMAGE_PROXY_SECRET || process.env.CALDAV_PASSWORD || "";
}

export function signImageUrl(url) {
  return crypto.createHmac("sha256", secret()).update(url).digest("hex").slice(0, 32);
}

export function isValidSignature(url, sig) {
  if (!secret() || typeof sig !== "string" || sig.length !== 32) return false;
  return crypto.timingSafeEqual(Buffer.from(signImageUrl(url)), Buffer.from(sig));
}

export function proxiedImageUrl(url) {
  return `/api/image?url=${encodeURIComponent(url)}&sig=${signImageUrl(url)}`;
}
