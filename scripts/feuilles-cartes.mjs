// =====================================================================
//  Monte les feuilles imprimables à partir de la base scellée.
//
//  Chaque feuille porte N grilles (« faces »). Les numéros de série sont
//  RÉPARTIS AU HASARD sur l'ensemble du tirage : une feuille ne porte
//  jamais 1-2-3, mais par exemple 4821, 193, 7702. Deux raisons :
//    - un acheteur ne peut pas deviner ce qu'il aura ;
//    - les grilles voisines ne se retrouvent pas dans la même main.
//
//  Reproductible : à graine égale, la répartition est identique. On peut
//  donc réimprimer un lot perdu à l'identique.
//
//    node scripts/feuilles-cartes.mjs --par-feuille=3
//    node scripts/feuilles-cartes.mjs --par-feuille=6 --pdf
//    node scripts/feuilles-cartes.mjs --par-feuille=9 --de=1 --a=900 --pdf
// =====================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { monterHtml, DISPOSITIONS, FORMATS } from "../src/core/feuilles.js";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [cle, ...reste] = a.replace(/^--/, "").split("=");
    return [cle, reste.length ? reste.join("=") : true];
  })
);

if (args.aide || args.h) {
  console.log(`
Monteur de feuilles de bingo

  --par-feuille=N   grilles par feuille : 1, 2, 3, 4, 6, 9, 12 ou 18  (défaut 3)
  --de=N --a=N      ne monter qu'une tranche de la base       (défaut : toute)
  --graine=TEXTE    graine de répartition — À NOTER           (défaut "feuilles")
  --format=NOM      Letter, Legal ou A4                        (défaut Letter)
  --couleur=#HEX    teinte de la série (papier de couleur)     (défaut aucune)
  --sortie=CHEMIN   fichier HTML produit
  --pdf             produit aussi le PDF (via Electron, déjà installé)
`);
  process.exit(0);
}

// ---------------------------------------------------------------------
//  Réglages — la mise en page vit dans src/core/feuilles.js, partagée
//  avec le logiciel. Ici on ne fait que lire les arguments et écrire.
// ---------------------------------------------------------------------

const PAR_FEUILLE = Number(args["par-feuille"] ?? 3);
const GRAINE = String(args.graine ?? "feuilles");
const FORMAT = String(args.format ?? "Letter");
const COULEUR = args.couleur ? String(args.couleur) : null;

if (!DISPOSITIONS[PAR_FEUILLE]) {
  console.error(`--par-feuille=${PAR_FEUILLE} : choisis parmi ${Object.keys(DISPOSITIONS).join(", ")}`);
  process.exit(1);
}
if (!FORMATS[FORMAT]) {
  console.error(`--format=${FORMAT} : choisis parmi ${Object.keys(FORMATS).join(", ")}`);
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(join(RACINE, "data/cartes.json"), "utf8"));
const cheminManifeste = join(RACINE, "data/cartes.manifeste.json");
const manifeste = existsSync(cheminManifeste)
  ? JSON.parse(readFileSync(cheminManifeste, "utf8"))
  : { droits: "" };

let montage;
try {
  montage = monterHtml(catalogue, {
    parFeuille: PAR_FEUILLE,
    de: args.de ? Number(args.de) : null,
    a: args.a ? Number(args.a) : null,
    graine: GRAINE,
    format: FORMAT,
    couleur: COULEUR,
    droits: manifeste.droits
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (!montage.grilles) {
  console.error("Aucune carte dans la tranche demandée.");
  process.exit(1);
}

const { html, page } = montage;
const feuilles = { length: montage.feuilles };
const numeros = montage.numeros;
const derniereIncomplete = montage.derniereIncomplete;

const SORTIE = resolve(RACINE, String(args.sortie ?? `data/feuilles-${PAR_FEUILLE}-grilles.html`));
mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, html, "utf8");

console.log(`Feuilles de ${PAR_FEUILLE} grilles — format ${FORMAT} (${page.l} × ${page.h} mm)\n`);
console.log(`  grilles montées : ${numeros.length.toLocaleString("fr-CA")} (n° ${numeros[0]} à ${numeros.at(-1)})`);
console.log(`  feuilles        : ${feuilles.length.toLocaleString("fr-CA")}`);
if (derniereIncomplete) {
  console.log(`  ⚠️  la dernière feuille ne porte que ${derniereIncomplete} grille(s) sur ${PAR_FEUILLE}`);
}
console.log(`  graine          : « ${GRAINE} » — même graine, même répartition`);
console.log(`\nHTML  → ${SORTIE}`);

// ---------------------------------------------------------------------
//  PDF — rendu par Electron, déjà installé : aucune dépendance de plus
// ---------------------------------------------------------------------

if (args.pdf) {
  const cheminPdf = SORTIE.replace(/\.html$/, "") + ".pdf";
  const electron = join(RACINE, "node_modules/.bin/electron");
  if (!existsSync(electron)) {
    console.error(`\nElectron introuvable — lance « npm install », puis réessaie.`);
    process.exit(1);
  }
  console.log(`\nRendu du PDF…`);
  try {
    execFileSync(electron, [join(RACINE, "scripts/pdf.cjs"), SORTIE, cheminPdf, String(page.l), String(page.h)],
      { stdio: ["ignore", "inherit", "inherit"] });
    console.log(`PDF   → ${cheminPdf}`);
  } catch {
    console.error(`\nLe rendu PDF a échoué. Repli : ouvre le HTML dans un navigateur,`);
    console.error(`puis Fichier → Imprimer → Enregistrer en PDF (marges : aucune).`);
    process.exit(1);
  }
}
