// =====================================================================
//  Montage des feuilles imprimables.
//
//  Partagé par le logiciel (Paramètres → Cartes) et par le script en
//  ligne de commande. Une seule mise en page, donc jamais deux rendus
//  différents entre ce qu'on voit à l'écran et ce qui part chez
//  l'imprimeur.
//
//  Les numéros de série sont RÉPARTIS AU HASARD sur tout le tirage : une
//  feuille ne porte jamais 1-2-3, mais par exemple 4821, 193, 7702. Un
//  acheteur ne peut pas deviner ce qu'il aura, et les grilles voisines ne
//  se retrouvent pas dans la même main.
// =====================================================================

import { generateur, melanger } from "./hasard.js";

export const DISPOSITIONS = {
  1: { colonnes: 1, rangees: 1 },
  2: { colonnes: 1, rangees: 2 },
  3: { colonnes: 1, rangees: 3 },   // la bande classique
  4: { colonnes: 2, rangees: 2 },
  6: { colonnes: 2, rangees: 3 },
  9: { colonnes: 3, rangees: 3 },
  12: { colonnes: 3, rangees: 4 },
  18: { colonnes: 3, rangees: 6 }
};

export const FORMATS = {
  Letter: { l: 215.9, h: 279.4 },
  Legal: { l: 215.9, h: 355.6 },
  A4: { l: 210, h: 297 }
};

const echapper = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Noir ou blanc par-dessus une couleur, selon ce qui se lit.
 * Une station qui choisit un jaune vif aurait des lettres blanches
 * illisibles ; sur un bleu marine, des lettres noires. On tranche pour elle.
 */
export function encreLisible(fond) {
  const hex = String(fond || "#000000").replace("#", "");
  const plein = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const n = parseInt(plein, 16);
  if (!Number.isFinite(n) || plein.length !== 6) return "#ffffff";
  // Luminance perçue : l'œil est bien plus sensible au vert qu'au bleu.
  const r = (n >> 16) & 255, v = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * v + 0.114 * b) > 150 ? "#000000" : "#ffffff";
}

/**
 * Découpe la base en feuilles, séries mélangées.
 * Renvoie { feuilles, numeros, derniereIncomplete }.
 */
export function decouper(catalogue, { parFeuille = 3, de = null, a = null, graine = "feuilles" } = {}) {
  let numeros = Object.keys(catalogue).map(Number).sort((x, y) => x - y);
  if (de !== null || a !== null) {
    const min = de ?? numeros[0];
    const max = a ?? numeros.at(-1);
    numeros = numeros.filter((n) => n >= min && n <= max);
  }
  if (!numeros.length) return { feuilles: [], numeros: [], derniereIncomplete: 0 };

  const melange = melanger(numeros, generateur(graine));
  const feuilles = [];
  for (let i = 0; i < melange.length; i += parFeuille) {
    feuilles.push(melange.slice(i, i + parFeuille));
  }
  const derniere = feuilles.at(-1).length;
  return { feuilles, numeros, derniereIncomplete: derniere < parFeuille ? derniere : 0 };
}

/** Le document complet, prêt à imprimer ou à convertir en PDF. */
export function monterHtml(catalogue, options = {}) {
  const parFeuille = Number(options.parFeuille ?? 3);
  const format = options.format ?? "Letter";
  // La couleur ne touche QUE les blocs B-I-N-G-O. Le papier reste blanc et
  // les carreaux noir sur blanc : c'est ce qui s'imprime le mieux, coûte le
  // moins cher, et reste lisible pour tout le monde à distance.
  const couleurBlocs = options.couleur || "#000000";
  const encre = encreLisible(couleurBlocs);
  const droits = options.droits ?? "";

  if (!DISPOSITIONS[parFeuille]) throw new Error(`Disposition inconnue : ${parFeuille} grilles par feuille`);
  if (!FORMATS[format]) throw new Error(`Format inconnu : ${format}`);

  const { feuilles, numeros, derniereIncomplete } = decouper(catalogue, options);
  const { colonnes, rangees } = DISPOSITIONS[parFeuille];
  const page = FORMATS[format];

  const grilleHtml = (numero) => {
    const g = catalogue[String(numero)];
    let cases = "";
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const n = g[r][c];
        cases += n === 0 ? '<div class="case libre">★</div>' : `<div class="case">${n}</div>`;
      }
    }
    return `<div class="grille">
      <div class="entete"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div>
      <div class="cases">${cases}</div>
      <div class="serie">N° ${numero}</div>
    </div>`;
  };

  const corps = feuilles.map((serie) => {
    const vides = parFeuille - serie.length;
    return `<section class="feuille">
      <div class="plateau">${serie.map(grilleHtml).join("")}${'<div class="grille vide"></div>'.repeat(vides)}</div>
      <footer class="pied-feuille">${echapper(droits)}</footer>
    </section>`;
  }).join("\n");

  const tailleEntete = parFeuille >= 9 ? 4 : parFeuille >= 6 ? 5 : 7;
  const tailleCase = parFeuille >= 9 ? 4 : parFeuille >= 6 ? 5.5 : 7;
  const tailleSerie = parFeuille >= 9 ? 3 : 3.6;

  const html = `<!doctype html>
<html lang="fr-CA"><head><meta charset="utf-8">
<title>Feuilles de bingo — ${parFeuille} grilles</title>
<style>
  @page { size: ${page.l}mm ${page.h}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /* Couleurs FORCÉES : sans ça, un navigateur en mode sombre imposerait
     son fond noir, et printBackground l'imprimerait tel quel. */
  html, body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #fff;
    color: #000;
    color-scheme: only light;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .feuille {
    width: ${page.l}mm; height: ${page.h}mm;
    padding: 10mm 10mm 6mm;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page;
    background: #fff; color: #000;
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
  /* Les blocs B-I-N-G-O : le SEUL endroit coloré de la feuille. */
  .entete {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 0.6mm; margin-bottom: 0.6mm;
  }
  .entete span {
    display: flex; align-items: center; justify-content: center;
    background: ${couleurBlocs}; color: ${encre};
    border-radius: 1mm;
    font-weight: 800; font-size: ${tailleEntete}mm;
    line-height: 1; letter-spacing: 0.3mm;
    padding: ${parFeuille >= 9 ? "0.8" : "1.2"}mm 0;
  }
  .cases {
    flex: 1; display: grid;
    grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr);
    gap: 0.6mm;
  }
  .case {
    display: flex; align-items: center; justify-content: center;
    border: 0.3mm solid #444; border-radius: 1mm;
    font-weight: 700; font-size: ${tailleCase}mm; color: #000;
  }
  .case.libre { background: #e8e8e8; }
  .serie {
    text-align: right; font-size: ${tailleSerie}mm;
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

  return { html, feuilles: feuilles.length, grilles: numeros.length, numeros, derniereIncomplete, page };
}
