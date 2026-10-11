// Identifiant stable d'un lieu, partagé entre /api/events et /api/lieux.
// Il n'y a qu'une poignée de lieux, on peut donc être tolérant : la casse,
// les accents, la ponctuation et l'article initial ne comptent pas.
//   "Le Ciel", "ciel", "le-ciel", "Ciel.md" → "ciel"
//   "L'Hexagone", "hexagone"               → "hexagone"
export function venueSlug(name) {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(le|la|les|l)-(?=.)/, "");
}

// Les clients de calendrier (Apple notamment) collent souvent l'adresse
// complète dans LOCATION : "Le Ciel, 2 rue Général Marchand, Grenoble".
// On ne garde que la partie avant la première virgule / ligne pour
// retrouver le nom du lieu.
export function venueNameFromLocation(location) {
  if (!location) return "";
  return location.split(/[,\n]/)[0].trim();
}
