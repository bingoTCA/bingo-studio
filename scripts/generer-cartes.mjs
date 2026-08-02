// =====================================================================
//  Générateur de cartes de bingo — ta propre base, à toi.
//
//  Produit N cartes valides, toutes différentes, au format du logiciel
//  (JSON) et au format des imprimeurs (CSV, identique à A09036original).
//
//  REPRODUCTIBLE : à graine égale, la base produite est rigoureusement
//  identique. Note ta graine quelque part — elle te permet de régénérer
//  le fichier s'il est perdu, et de montrer à la Régie que la base n'a
//  pas été bricolée après coup.
//
//  Exemples :
//    node scripts/generer-cartes.mjs --graine="ma graine"
//    node scripts/generer-cartes.mjs --debut=1 --fin=10000 --graine=42
//    node scripts/generer-cartes.mjs --graine="ma graine" --installer
// =====================================================================

import { writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------
//  Arguments
// ---------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [cle, ...reste] = a.replace(/^--/, "").split("=");
    return [cle, reste.length ? reste.join("=") : true];
  })
);

if (args.aide || args.h) {
  console.log(`
Générateur de cartes de bingo

  --debut=N       premier numéro de carte           (défaut 1)
  --fin=N         dernier numéro de carte           (défaut 10000)
  --graine=TEXTE  graine, mot ou nombre — À NOTER   (défaut "bingo-studio")
  --sortie=CHEMIN fichier JSON produit              (défaut data/cartes-nouvelles.json)
  --sans-csv      ne pas produire le CSV pour l'imprimeur
  --installer     remplace data/cartes.json après avoir sauvegardé l'ancien
`);
  process.exit(0);
}

const DEBUT = Number(args.debut ?? 1);
const FIN = Number(args.fin ?? 10000);
const GRAINE = String(args.graine ?? "bingo-studio");
const SORTIE = resolve(RACINE, String(args.sortie ?? "data/cartes-nouvelles.json"));

if (!Number.isInteger(DEBUT) || !Number.isInteger(FIN) || DEBUT < 0 || FIN < DEBUT) {
  console.error(`Plage invalide : --debut=${args.debut} --fin=${args.fin}`);
  process.exit(1);
}

// ---------------------------------------------------------------------
//  Hasard reproductible
// ---------------------------------------------------------------------

/** Transforme une graine texte en entier 32 bits (FNV-1a). */
function grainEntier(texte) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — court, rapide, et surtout : même graine, même suite. */
function generateur(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasard = generateur(grainEntier(GRAINE));

/** Tire `combien` valeurs distinctes dans [min, max], dans un ordre au hasard. */
function tirerDistincts(min, max, combien) {
  const urne = [];
  for (let n = min; n <= max; n++) urne.push(n);
  // Fisher-Yates partiel : seuls les `combien` premiers nous intéressent.
  for (let i = 0; i < combien; i++) {
    const j = i + Math.floor(hasard() * (urne.length - i));
    [urne[i], urne[j]] = [urne[j], urne[i]];
  }
  return urne.slice(0, combien);
}

// ---------------------------------------------------------------------
//  Une carte
// ---------------------------------------------------------------------

// Plages de chaque colonne : B 1-15, I 16-30, N 31-45, G 46-60, O 61-75.
const PLAGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

function fabriquerCarte() {
  const grille = [[], [], [], [], []];
  for (let c = 0; c < 5; c++) {
    const [min, max] = PLAGES[c];
    // La colonne du centre n'a que 4 numéros : la case du milieu est libre.
    const combien = c === 2 ? 4 : 5;
    const nums = tirerDistincts(min, max, combien);
    for (let r = 0; r < 5; r++) {
      if (c === 2 && r === 2) grille[r][c] = 0;          // case libre
      else grille[r][c] = nums.pop();
    }
  }
  return grille;
}

// ---------------------------------------------------------------------
//  Validation — ce qui part chez l'imprimeur doit être irréprochable
// ---------------------------------------------------------------------

function valider(catalogue) {
  const problemes = [];
  const vues = new Map();

  for (const [numero, grille] of Object.entries(catalogue)) {
    const ou = `carte ${numero}`;

    if (grille.length !== 5 || grille.some((l) => l.length !== 5)) {
      problemes.push(`${ou} : la grille n'est pas 5×5`);
      continue;
    }
    if (grille[2][2] !== 0) problemes.push(`${ou} : la case centrale doit être libre`);

    for (let c = 0; c < 5; c++) {
      const [min, max] = PLAGES[c];
      for (let r = 0; r < 5; r++) {
        const n = grille[r][c];
        if (n === 0) {
          if (!(r === 2 && c === 2)) problemes.push(`${ou} : case libre hors du centre en [${r}][${c}]`);
          continue;
        }
        if (!Number.isInteger(n) || n < min || n > max) {
          problemes.push(`${ou} : ${n} en [${r}][${c}] est hors de la plage ${min}-${max}`);
        }
      }
    }

    const nums = grille.flat().filter((n) => n !== 0);
    if (nums.length !== 24) problemes.push(`${ou} : ${nums.length} numéros au lieu de 24`);
    if (new Set(nums).size !== nums.length) problemes.push(`${ou} : contient un numéro en double`);

    // Deux cartes identiques = deux gagnants simultanés. Interdit.
    const signature = JSON.stringify(grille);
    if (vues.has(signature)) problemes.push(`${ou} : identique à la carte ${vues.get(signature)}`);
    else vues.set(signature, numero);
  }
  return problemes;
}

// ---------------------------------------------------------------------
//  Formats de sortie
// ---------------------------------------------------------------------

/** CSV au format de l'imprimeur : colonnes B,I,N,G,O à la suite, sans la case libre. */
function versCsv(catalogue) {
  const entetes = ["Card"];
  for (let p = 1; p <= 25; p++) if (p !== 13) entetes.push(`POS${p}`);

  const lignes = [entetes.map((e) => `"${e}"`).join(",")];
  for (const [numero, grille] of Object.entries(catalogue)) {
    const valeurs = [numero];
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        if (c === 2 && r === 2) continue;               // la case libre n'est pas écrite
        valeurs.push(grille[r][c]);
      }
    }
    lignes.push(valeurs.join(","));
  }
  return lignes.join("\n") + "\n";
}

// ---------------------------------------------------------------------
//  Exécution
// ---------------------------------------------------------------------

const total = FIN - DEBUT + 1;
console.log(`Génération de ${total.toLocaleString("fr-CA")} cartes (${DEBUT} à ${FIN})`);
console.log(`Graine : « ${GRAINE} » — note-la, elle permet de tout régénérer à l'identique.\n`);

const catalogue = {};
const signatures = new Set();
let collisions = 0;

for (let numero = DEBUT; numero <= FIN; numero++) {
  let grille, signature;
  do {
    grille = fabriquerCarte();
    signature = JSON.stringify(grille);
    if (signatures.has(signature)) collisions++;
  } while (signatures.has(signature));
  signatures.add(signature);
  catalogue[numero] = grille;
}

const problemes = valider(catalogue);
if (problemes.length) {
  console.error(`✗ ${problemes.length} problème(s) — rien n'a été écrit :\n`);
  for (const p of problemes.slice(0, 20)) console.error("  " + p);
  if (problemes.length > 20) console.error(`  … et ${problemes.length - 20} autres`);
  process.exit(1);
}

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, JSON.stringify(catalogue), "utf8");
console.log(`✓ ${total.toLocaleString("fr-CA")} cartes validées`);
console.log(`  toutes différentes, 24 numéros distincts chacune, case centrale libre`);
if (collisions) console.log(`  (${collisions} doublon(s) écarté(s) et retiré(s) au passage)`);
console.log(`\nJSON  → ${SORTIE}`);

if (!args["sans-csv"]) {
  const cheminCsv = SORTIE.replace(/\.json$/, "") + ".csv";
  writeFileSync(cheminCsv, versCsv(catalogue), "utf8");
  console.log(`CSV   → ${cheminCsv}  (format imprimeur, identique à A09036original)`);
}

if (args.installer) {
  const actuel = join(RACINE, "data/cartes.json");
  if (existsSync(actuel)) {
    const sauvegarde = join(RACINE, "data/cartes-precedentes.json");
    copyFileSync(actuel, sauvegarde);
    console.log(`\nAncienne base sauvegardée → ${sauvegarde}`);
  }
  copyFileSync(SORTIE, actuel);
  console.log(`Nouvelle base installée   → ${actuel}`);
  console.log(`\n⚠️  Les cartes déjà imprimées ne correspondent plus. À n'utiliser`);
  console.log(`   qu'avec les cartes imprimées depuis le nouveau CSV.`);
} else {
  console.log(`\nPour l'utiliser dans le logiciel : relance avec --installer`);
  console.log(`(l'ancienne base est sauvegardée avant d'être remplacée)`);
}
