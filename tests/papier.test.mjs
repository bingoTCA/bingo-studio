// =====================================================================
//  La base contre le papier.
//
//  Les autres tests vérifient que la base est cohérente. Celui-ci vérifie
//  qu'elle est VRAIE : six cartes relevées à l'œil sur une feuille papier
//  Capitol™ 1-9000 (Arrow, distribution Bingo Vézina), photographiée —
//  TVCE/photos3/IMG_8942.jpg. La photo n'est pas sur le site, exprès :
//  les télés ont des feuilles de 3 ou 6 cartes, de couleurs variées, et
//  une seule image laisserait croire que seules celles-là sont reconnues.
//
//  Si une réinstallation de la base décale une série, transpose une
//  colonne ou mélange deux numéros, ces six cartes le disent — avant les
//  ondes, pas pendant.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync(new URL("../data/cartes.json", import.meta.url), "utf8"));

// Colonnes B, I, N, G, O lues de haut en bas ; 0 = la case FREE.
const FEUILLE_CAPITOL = {
  1509: { B: [11, 7, 9, 4, 1],   I: [28, 22, 16, 29, 26], N: [33, 32, 0, 42, 31], G: [47, 56, 57, 49, 53], O: [73, 63, 75, 69, 65] },
  1634: { B: [4, 9, 11, 8, 7],   I: [25, 22, 28, 18, 17], N: [41, 32, 0, 44, 42], G: [58, 55, 48, 57, 46], O: [74, 62, 64, 75, 68] },
  1759: { B: [13, 14, 7, 15, 6], I: [18, 20, 30, 24, 28], N: [42, 44, 0, 39, 31], G: [51, 58, 50, 48, 52], O: [68, 71, 72, 70, 74] },
  1884: { B: [13, 10, 7, 15, 9], I: [20, 18, 19, 21, 25], N: [36, 45, 0, 39, 40], G: [58, 52, 47, 53, 54], O: [63, 62, 67, 68, 75] },
  2009: { B: [1, 10, 5, 12, 9],  I: [22, 23, 19, 25, 18], N: [41, 33, 0, 45, 31], G: [56, 48, 47, 54, 52], O: [67, 69, 72, 71, 65] },
  2134: { B: [8, 14, 3, 4, 2],   I: [25, 19, 21, 30, 28], N: [42, 36, 0, 37, 39], G: [54, 56, 59, 51, 46], O: [64, 61, 63, 69, 66] }
};

for (const [numero, papier] of Object.entries(FEUILLE_CAPITOL)) {
  test(`la carte papier ${numero} est identique, case pour case, à la base`, () => {
    const g = catalogue[numero];
    assert.ok(g, `la carte ${numero} a disparu de la base`);
    "BINGO".split("").forEach((lettre, col) => {
      papier[lettre].forEach((attendu, ligne) => {
        assert.equal(g[ligne][col], attendu,
          `carte ${numero}, case ${lettre}${ligne + 1} : le papier porte ${attendu}, la base ${g[ligne][col]}`);
      });
    });
  });
}

// ---------------------------------------------------------------------
//  Les classeurs de vérification, page contre base.
//
//  Six cartes relevées à l'œil sur les pages scannées des classeurs, là
//  où une numérisation se trompe le plus volontiers : la page 201 de la
//  série 45 001–54 000 (fichier « 192-209 », mal nommé et décalé d'une
//  page — les numéros imprimés ont été suivis), et la DERNIÈRE page de
//  chaque série, où une page manquante ou doublée décalerait tout.
//  Relevé le 6 octobre 2026 : 13 cartes, 312 cases sur 312 identiques.
// ---------------------------------------------------------------------

const PAGES_DE_CLASSEUR = {
  49801: { B: [2, 4, 7, 14, 12],   I: [23, 30, 27, 25, 21], N: [41, 36, 0, 39, 44], G: [47, 57, 58, 46, 56], O: [67, 70, 66, 64, 61] },
  49824: { B: [7, 9, 13, 4, 12],   I: [26, 30, 29, 18, 27], N: [40, 45, 0, 33, 42], G: [56, 59, 48, 58, 60], O: [61, 66, 73, 68, 63] },
  35977: { B: [12, 9, 8, 3, 6],    I: [16, 17, 21, 25, 22], N: [37, 31, 0, 43, 32], G: [49, 54, 47, 50, 53], O: [69, 63, 65, 71, 62] },
  36000: { B: [13, 11, 10, 7, 5],  I: [16, 17, 21, 30, 27], N: [39, 35, 0, 40, 36], G: [50, 53, 56, 55, 48], O: [61, 71, 72, 73, 69] },
  53977: { B: [15, 11, 14, 8, 2],  I: [17, 20, 29, 19, 23], N: [35, 43, 0, 42, 44], G: [60, 47, 49, 51, 59], O: [71, 73, 62, 74, 70] },
  54000: { B: [11, 13, 6, 2, 15],  I: [23, 22, 30, 25, 27], N: [31, 32, 0, 39, 33], G: [51, 60, 50, 48, 56], O: [65, 73, 61, 70, 75] }
};

for (const [numero, page] of Object.entries(PAGES_DE_CLASSEUR)) {
  test(`la carte ${numero} du classeur scanné est identique, case pour case, à la base`, () => {
    const g = catalogue[numero];
    assert.ok(g, `la carte ${numero} a disparu de la base`);
    "BINGO".split("").forEach((lettre, col) => {
      page[lettre].forEach((attendu, ligne) => {
        assert.equal(g[ligne][col], attendu,
          `carte ${numero}, case ${lettre}${ligne + 1} : le classeur porte ${attendu}, la base ${g[ligne][col]}`);
      });
    });
  });
}
