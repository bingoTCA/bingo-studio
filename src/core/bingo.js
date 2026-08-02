// =====================================================================
//  Logique pure du bingo — aucune dépendance, aucun accès réseau.
//  Onze figures, détection de gagnant, validation de la saisie et
//  vérification d'une carte contre le catalogue.
//
//  Convention de grille : tableau 5x5 en lignes (rows-major).
//  grille[r][c] — la case centrale grille[2][2] vaut 0 = case libre.
// =====================================================================

/** Lettre de colonne B/I/N/G/O d'un numéro tiré (1-75). */
export function lettre(n) {
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
}

/** Les 15 numéros d'une colonne : rangee("B") -> [1..15] */
export function rangee(col) {
  const base = { B: 0, I: 15, N: 30, G: 45, O: 60 }[col];
  return Array.from({ length: 15 }, (_, i) => base + i + 1);
}

export const COLONNES = ["B", "I", "N", "G", "O"];

// ---------------------------------------------------------------------
//  Figures de jeu
// ---------------------------------------------------------------------
//  `cases` décrit la forme quand elle est fixe. Les figures « au choix »
//  (n'importe quelle ligne, colonne ou diagonale) sont marquées
//  `variantes` : on retient la meilleure des variantes.
// ---------------------------------------------------------------------

function toutes() {
  const c = [];
  for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) c.push([r, k]);
  return c;
}
function ligneH(r) { return Array.from({ length: 5 }, (_, c) => [r, c]); }
function ligneV(c) { return Array.from({ length: 5 }, (_, r) => [r, c]); }
function diagonale(sens) {
  return Array.from({ length: 5 }, (_, i) => (sens === "\\" ? [i, i] : [i, 4 - i]));
}

export const FIGURES = {
  LIGNE_H:   { nom: "Une ligne",            aide: "N'importe quelle ligne horizontale",  variantes: [0, 1, 2, 3, 4].map(ligneH) },
  LIGNE_V:   { nom: "Une colonne",          aide: "N'importe quelle colonne",            variantes: [0, 1, 2, 3, 4].map(ligneV) },
  DIAGONALE: { nom: "Une diagonale",        aide: "L'une ou l'autre des diagonales",     variantes: [diagonale("\\"), diagonale("/")] },
  LIGNE:     { nom: "Ligne au choix",       aide: "Ligne, colonne ou diagonale",         variantes: [...[0,1,2,3,4].map(ligneH), ...[0,1,2,3,4].map(ligneV), diagonale("\\"), diagonale("/")] },
  X:         { nom: "Le X",                 aide: "Les deux diagonales",                 cases: [...diagonale("\\"), ...diagonale("/").filter(([r, c]) => r !== c)] },
  QUATRE_COINS: { nom: "Les 4 coins",       aide: "Les quatre coins de la carte",        cases: [[0,0],[0,4],[4,0],[4,4]] },
  T:         { nom: "Le T",                 aide: "Ligne du haut + colonne centrale",    cases: [...ligneH(0), ...[1,2,3,4].map(r => [r, 2])] },
  L:         { nom: "Le L",                 aide: "Colonne gauche + ligne du bas",       cases: [...ligneV(0), ...[1,2,3,4].map(c => [4, c])] },
  H:         { nom: "Le H",                 aide: "Deux colonnes + ligne du milieu",     cases: [...ligneV(0), ...ligneV(4), ...[1,2,3].map(c => [2, c])] },
  TOUR:      { nom: "Le tour",              aide: "Le cadre extérieur",                  cases: [...ligneH(0), ...ligneH(4), ...[1,2,3].flatMap(r => [[r,0],[r,4]])] },
  PLEINE:    { nom: "Carte pleine",         aide: "Toutes les cases",                    cases: toutes() }
};

export const ORDRE_FIGURES = [
  "LIGNE_H", "LIGNE_V", "DIAGONALE", "LIGNE", "X",
  "QUATRE_COINS", "T", "L", "H", "TOUR", "PLEINE"
];

/** Une case est marquée si elle est la case libre (0) ou si son numéro est sorti. */
export function caseEstMarquee(num, tirage) {
  return num === 0 || tirage.has(num);
}

/**
 * Nombre de cases qu'il reste à marquer pour compléter la figure.
 * 0 = carte gagnante. Une figure inconnue renvoie 999 pour ne jamais
 * déclarer un gagnant par accident (leçon apprise en ondes).
 */
export function compteRestants(grille, tirage, forme) {
  const f = FIGURES[forme];
  if (!f) return 999;

  const evalue = (cases) => {
    let restants = 0;
    for (const [r, c] of cases) if (!caseEstMarquee(grille[r][c], tirage)) restants++;
    return restants;
  };

  if (f.variantes) {
    let min = Infinity;
    for (const v of f.variantes) min = Math.min(min, evalue(v));
    return min === Infinity ? 999 : min;
  }
  return evalue(f.cases);
}

/**
 * Les cases effectivement retenues pour la figure — pour surligner la
 * grille à l'écran. Pour une figure à variantes, on montre la variante
 * la plus avancée (celle qui a le moins de cases restantes).
 */
export function casesRetenues(grille, tirage, forme) {
  const f = FIGURES[forme];
  if (!f) return [];
  if (!f.variantes) return f.cases;

  let best = f.variantes[0], bestScore = Infinity;
  for (const v of f.variantes) {
    let restants = 0;
    for (const [r, c] of v) if (!caseEstMarquee(grille[r][c], tirage)) restants++;
    if (restants < bestScore) { bestScore = restants; best = v; }
  }
  return best;
}

export function carteEstGagnante(grille, tirage, forme) {
  return compteRestants(grille, tirage, forme) === 0;
}

// ---------------------------------------------------------------------
//  Vérification d'une carte du catalogue
// ---------------------------------------------------------------------

/**
 * Vérifie la carte `numero` du catalogue contre les numéros sortis.
 * Renvoie un verdict complet, prêt à afficher — jamais d'exception.
 *
 *   { statut: "GAGNANTE" | "PAS_ENCORE" | "INTROUVABLE",
 *     numero, grille, restants, cases, marquees }
 */
export function verifierCarte(catalogue, numero, tirageArr, forme) {
  const n = Number(numero);
  const grille = Number.isInteger(n) ? catalogue[String(n)] : null;

  if (!grille) {
    return { statut: "INTROUVABLE", numero: n, grille: null, restants: null, cases: [], marquees: [] };
  }

  const tirage = new Set(tirageArr);
  const restants = compteRestants(grille, tirage, forme);
  const cases = casesRetenues(grille, tirage, forme);
  const marquees = [];
  for (let r = 0; r < 5; r++) {
    marquees.push(grille[r].map((num) => caseEstMarquee(num, tirage)));
  }

  return {
    statut: restants === 0 ? "GAGNANTE" : "PAS_ENCORE",
    numero: n, grille, restants, cases, marquees
  };
}

// ---------------------------------------------------------------------
//  Saisie du boulier — validation à l'épreuve des fautes de frappe
// ---------------------------------------------------------------------

/**
 * Valide un numéro saisi au clavier avant de l'envoyer à l'antenne.
 *   { ok: true,  numero, lettre }
 *   { ok: false, raison: "VIDE" | "HORS_PLAGE" | "DEJA_SORTI", message }
 */
export function validerSaisie(saisie, tirageArr) {
  const brut = String(saisie ?? "").trim();
  if (brut === "") return { ok: false, raison: "VIDE", message: "Aucun numéro saisi." };

  const n = Number(brut);
  if (!Number.isInteger(n) || n < 1 || n > 75) {
    return { ok: false, raison: "HORS_PLAGE", message: `« ${brut} » n'est pas un numéro de 1 à 75.` };
  }
  if (tirageArr.includes(n)) {
    const rang = tirageArr.indexOf(n) + 1;
    const ordinal = rang === 1 ? "1re" : `${rang}e`;
    return { ok: false, raison: "DEJA_SORTI", message: `${lettre(n)}-${n} est déjà sorti (${ordinal} boule).` };
  }
  return { ok: true, numero: n, lettre: lettre(n) };
}

/** Numéros encore dans le boulier. */
export function restantsDansBoulier(tirageArr) {
  return 75 - tirageArr.length;
}
