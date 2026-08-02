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
import { generateur, melanger } from "./hasard.mjs";

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
//  Réglages
// ---------------------------------------------------------------------

const DISPOSITIONS = {
  1: { colonnes: 1, rangees: 1 },
  2: { colonnes: 1, rangees: 2 },
  3: { colonnes: 1, rangees: 3 },   // la bande classique
  4: { colonnes: 2, rangees: 2 },
  6: { colonnes: 2, rangees: 3 },
  9: { colonnes: 3, rangees: 3 },
  12: { colonnes: 3, rangees: 4 },
  18: { colonnes: 3, rangees: 6 }
};

const FORMATS = {
  Letter: { l: 215.9, h: 279.4 },
  Legal: { l: 215.9, h: 355.6 },
  A4: { l: 210, h: 297 }
};

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

// ---------------------------------------------------------------------
//  Base + manifeste
// ---------------------------------------------------------------------

const catalogue = JSON.parse(readFileSync(join(RACINE, "data/cartes.json"), "utf8"));
const cheminManifeste = join(RACINE, "data/cartes.manifeste.json");
const manifeste = existsSync(cheminManifeste)
  ? JSON.parse(readFileSync(cheminManifeste, "utf8"))
  : { droits: "", detenteur: "" };

let numeros = Object.keys(catalogue).map(Number).sort((a, b) => a - b);
if (args.de || args.a) {
  const de = Number(args.de ?? numeros[0]);
  const a = Number(args.a ?? numeros.at(-1));
  numeros = numeros.filter((n) => n >= de && n <= a);
}
if (!numeros.length) {
  console.error("Aucune carte dans la tranche demandée.");
  process.exit(1);
}

// C'est ICI que les séries se retrouvent éparpillées : on brasse la liste
// complète, puis on découpe en feuilles.
const melange = melanger(numeros, generateur(GRAINE));
const feuilles = [];
for (let i = 0; i < melange.length; i += PAR_FEUILLE) {
  feuilles.push(melange.slice(i, i + PAR_FEUILLE));
}
const derniereIncomplete = feuilles.at(-1).length < PAR_FEUILLE ? feuilles.at(-1).length : 0;

// ---------------------------------------------------------------------
//  Montage HTML
// ---------------------------------------------------------------------

const { colonnes, rangees } = DISPOSITIONS[PAR_FEUILLE];
const page = FORMATS[FORMAT];
const echapper = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function grilleHtml(numero) {
  const g = catalogue[String(numero)];
  let cases = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const n = g[r][c];
      cases += n === 0
        ? '<div class="case libre">★</div>'
        : `<div class="case">${n}</div>`;
    }
  }
  return `<div class="grille">
    <div class="entete"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div>
    <div class="cases">${cases}</div>
    <div class="serie">N° ${numero}</div>
  </div>`;
}

const corps = feuilles.map((serie) => {
  const vides = PAR_FEUILLE - serie.length;
  return `<section class="feuille">
    <div class="plateau">${serie.map(grilleHtml).join("")}${'<div class="grille vide"></div>'.repeat(vides)}</div>
    <footer class="pied-feuille">${echapper(manifeste.droits)}</footer>
  </section>`;
}).join("\n");

const html = `<!doctype html>
<html lang="fr-CA"><head><meta charset="utf-8">
<title>Feuilles de bingo — ${PAR_FEUILLE} grilles</title>
<style>
  @page { size: ${page.l}mm ${page.h}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /* Couleurs FORCÉES : sans ça, un navigateur en mode sombre imposerait
     son fond noir, et printBackground l'imprimerait tel quel. */
  html, body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: ${COULEUR ?? "#ffffff"};
    color: #000;
    color-scheme: only light;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .feuille {
    width: ${page.l}mm; height: ${page.h}mm;
    padding: 10mm 10mm 6mm;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page;
    background: ${COULEUR ?? "#ffffff"};
    color: #000;
  }
  .feuille:last-child { page-break-after: auto; break-after: auto; }
  .plateau {
    flex: 1; display: grid;
    grid-template-columns: repeat(${colonnes}, 1fr);
    grid-template-rows: repeat(${rangees}, 1fr);
    gap: 5mm;
  }
  .grille {
    border: 0.6mm solid #000; border-radius: 2mm;
    padding: 2mm; display: flex; flex-direction: column;
    min-height: 0; min-width: 0;
  }
  .grille.vide { border-style: dashed; border-color: #bbb; }
  .entete {
    display: grid; grid-template-columns: repeat(5, 1fr);
    text-align: center; font-weight: 800;
    font-size: ${PAR_FEUILLE >= 9 ? 4 : PAR_FEUILLE >= 6 ? 5 : 7}mm;
    line-height: 1.1; letter-spacing: 0.5mm;
    border-bottom: 0.5mm solid #000; padding-bottom: 0.8mm; margin-bottom: 1mm;
  }
  .cases {
    flex: 1; display: grid;
    grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr);
    gap: 0.6mm;
  }
  .case {
    display: flex; align-items: center; justify-content: center;
    border: 0.3mm solid #444; border-radius: 1mm;
    font-weight: 700; font-size: ${PAR_FEUILLE >= 9 ? 4 : PAR_FEUILLE >= 6 ? 5.5 : 7}mm;
    color: #000;
  }
  .case.libre { background: #e8e8e8; }
  .serie {
    text-align: right; font-size: ${PAR_FEUILLE >= 9 ? 3 : 3.6}mm;
    color: #000; font-weight: 700; padding-top: 0.8mm; letter-spacing: 0.2mm;
  }
  .pied-feuille {
    flex-shrink: 0; padding-top: 2.5mm;
    font-size: 2.6mm; color: #555; text-align: center;
  }
</style></head>
<body>
${corps}
</body></html>
`;

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
