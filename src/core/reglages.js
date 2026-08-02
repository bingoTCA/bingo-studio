// =====================================================================
//  Export et import des réglages.
//
//  À quoi ça sert : une station réinstalle le logiciel — nouvel ordinateur,
//  disque changé, ordinateur de la salle remplacé — et retrouve son
//  habillage, ses parties et ses médias sans tout refaire à la main.
//
//  CE QUI VOYAGE : l'habillage, les parties, les textes, le logo, les pubs,
//  et les fichiers du magasin (musiques, image ou vidéo de fond).
//
//  CE QUI NE VOYAGE PAS : la soirée en cours — les numéros tirés, les
//  gagnants, l'horodatage. Ce sont les traces d'un bingo précis ; les
//  transporter ailleurs n'aurait aucun sens, et les réimporter par-dessus une
//  partie en cours effacerait le travail de la soirée.
// =====================================================================

import { fusionnerTheme, themeNeuf } from "./canal.js";

export const FORMAT = "bingo-studio/reglages";
export const VERSION = 1;

/** Les champs de l'état qui sont des RÉGLAGES, et non la soirée en cours. */
export const CHAMPS = ["titre", "telephones", "commanditaire", "parties", "theme"];

/**
 * Les clés du magasin de médias auxquelles un habillage fait référence.
 * Sans elles, un export ne rendrait que des renvois vers des fichiers
 * absents sur la nouvelle machine.
 */
export function clesMedias(theme) {
  const t = fusionnerTheme(theme);
  const cles = [];
  for (const m of t.generique.musiques || []) if (m?.cle) cles.push(m.cle);
  if (t.fondMedia?.image?.cle) cles.push(t.fondMedia.image.cle);
  if (t.fondMedia?.video?.cle) cles.push(t.fondMedia.video.cle);
  return [...new Set(cles)];
}

/**
 * Monte le dossier à écrire sur le disque.
 * `medias` : { cle → { nom, type, donnees } }, `donnees` étant une adresse
 * data: déjà encodée par l'appelant (seul le navigateur sait lire un fichier).
 */
export function monterDossier(etat, medias = {}, quand = "") {
  const reglages = {};
  for (const champ of CHAMPS) reglages[champ] = etat[champ];
  return {
    format: FORMAT,
    version: VERSION,
    cree: quand,
    reglages,
    medias
  };
}

/**
 * Relit un dossier et refuse tout ce qui n'en est pas un, avec un message
 * qu'une opératrice peut comprendre — pas une trace d'erreur technique.
 */
export function lireDossier(objet) {
  if (!objet || typeof objet !== "object") {
    throw new Error("Ce fichier ne contient pas de réglages Bingo Studio.");
  }
  if (objet.format !== FORMAT) {
    throw new Error(
      "Ce fichier n'a pas été produit par Bingo Studio. " +
      "Cherche un fichier dont le nom commence par « bingo-studio-reglages »."
    );
  }
  if (Number(objet.version) > VERSION) {
    throw new Error(
      `Ce fichier vient d'une version plus récente du logiciel (${objet.version}). ` +
      "Mets Bingo Studio à jour, puis réessaie."
    );
  }
  const r = objet.reglages;
  if (!r || typeof r !== "object") {
    throw new Error("Le fichier est incomplet : il ne contient aucun réglage.");
  }
  return { reglages: r, medias: objet.medias && typeof objet.medias === "object" ? objet.medias : {} };
}

/**
 * Pose les réglages importés sur l'état courant SANS toucher à la soirée.
 * `manquants` : les clés de médias que le dossier ne portait pas — leur
 * réglage est retiré plutôt que laissé pointer dans le vide.
 *
 * Renvoie { etat, retires } pour que la régie puisse dire ce qui a été
 * écarté : un import qui perd des choses en silence est pire qu'un import
 * qui échoue.
 */
export function appliquerReglages(etat, reglages, manquants = []) {
  const absente = new Set(manquants);
  const suivant = { ...etat };
  const retires = [];

  if (typeof reglages.titre === "string") suivant.titre = reglages.titre;
  if (Array.isArray(reglages.telephones)) suivant.telephones = reglages.telephones.slice();
  if (typeof reglages.commanditaire === "string") suivant.commanditaire = reglages.commanditaire;

  if (Array.isArray(reglages.parties) && reglages.parties.length) {
    suivant.parties = reglages.parties.map((p) => ({ ...p }));
  }

  const t = fusionnerTheme(reglages.theme);

  const musiques = (t.generique.musiques || []).filter((m) => {
    if (m?.cle && absente.has(m.cle)) { retires.push(m.nom || m.cle); return false; }
    return true;
  });
  t.generique = { ...t.generique, musiques };

  const fond = { ...t.fondMedia };
  for (const genre of ["image", "video"]) {
    if (fond[genre]?.cle && absente.has(fond[genre].cle)) {
      retires.push(fond[genre].nom || fond[genre].cle);
      fond[genre] = null;
    }
  }
  t.fondMedia = fond;
  suivant.theme = t;

  // Les parties importées peuvent être moins nombreuses que celles d'avant :
  // sans ce garde-fou, la régie pointerait sur une partie qui n'existe plus.
  const nb = suivant.parties?.length ?? 0;
  suivant.partieIndex = nb ? Math.min(suivant.partieIndex ?? 0, nb - 1) : 0;

  return { etat: suivant, retires };
}

/** Nom de fichier proposé, sans caractère qui fâche un système de fichiers. */
export function nomDeFichier(titre, date) {
  const propre = String(titre || "bingo")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // « Rocher-Percé » → « rocher-perce »
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "bingo";
  return `bingo-studio-reglages-${propre}-${date}.json`;
}

/** Un thème neuf, pour les tests et pour un dossier sans habillage. */
export { themeNeuf };
