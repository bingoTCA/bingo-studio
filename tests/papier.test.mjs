// =====================================================================
//  La base contre le papier.
//
//  Les autres tests vérifient que la base est cohérente. Celui-ci vérifie
//  qu'elle est VRAIE : six cartes relevées à l'œil sur une feuille papier
//  Capitol™ 1-9000 (Arrow, distribution Bingo Vézina), photographiée —
//  voir site/images/feuille-capitol.webp. Même feuille, même boîte que
//  celles qu'une télé communautaire a en main.
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
