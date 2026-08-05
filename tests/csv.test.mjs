// =====================================================================
//  La base en CSV.
//
//  Ce fichier part chez un imprimeur qui compose lui-même les cartes.
//  S'il se trompe d'une colonne, les cartes imprimées ne sont plus celles
//  du logiciel : la vérification à l'antenne contredirait le carton du
//  joueur, en ondes, devant tout le monde. Ça ne se rattrape pas.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { monterCsv, enColonnes } from "../scripts/cartes-en-csv.mjs";

/** Une carte de fixture, lisible : la valeur dit sa place. */
function catalogue(n) {
  const base = {};
  for (let i = 1; i <= n; i++) {
    base[String(i)] = [
      [1, 16, 31, 46, 61],
      [2, 17, 32, 47, 62],
      [3, 18, 0, 48, 63],        // 0 = case du centre
      [4, 19, 34, 49, 64],
      [5, 20, 35, 50, 65]
    ];
  }
  return base;
}

// ---------------------------------------------------------------------
//  L'ordre des colonnes
// ---------------------------------------------------------------------

test("le CSV se lit colonne par colonne, pas ligne par ligne", () => {
  // La grille de fixture porte 1..5 dans la colonne B, de haut en bas.
  // Si on transposait à l'envers, B1..B5 vaudraient 1, 16, 31, 46, 61.
  const cases = enColonnes(catalogue(1)["1"]);
  assert.deepEqual(cases.slice(0, 5), [1, 2, 3, 4, 5], "B1 à B5");
  assert.deepEqual(cases.slice(5, 10), [16, 17, 18, 19, 20], "I1 à I5");
  assert.deepEqual(cases.slice(20), [61, 62, 63, 64, 65], "O1 à O5");
});

test("la case du centre est bien N3, la treizième", () => {
  const cases = enColonnes(catalogue(1)["1"]);
  assert.equal(cases[12], 0, "N3 est la 13e case dans l'ordre des colonnes");
});

test("l'en-tête nomme les cases comme un joueur les nomme", () => {
  const { csv } = monterCsv(catalogue(1));
  const entete = csv.split("\r\n")[0];
  assert.equal(entete,
    "carte,B1,B2,B3,B4,B5,I1,I2,I3,I4,I5,N1,N2,N3,N4,N5,G1,G2,G3,G4,G5,O1,O2,O3,O4,O5");
});

// ---------------------------------------------------------------------
//  Ce que reçoit l'imprimeur
// ---------------------------------------------------------------------

test("une ligne par carte, vingt-six colonnes, pas une de plus", () => {
  const { csv, nombre } = monterCsv(catalogue(40));
  const lignes = csv.trimEnd().split("\r\n");
  assert.equal(nombre, 40);
  assert.equal(lignes.length, 41, "l'en-tête plus quarante cartes");
  for (const l of lignes) assert.equal(l.split(",").length, 26, l.slice(0, 30));
});

test("la case du centre s'écrit comme l'imprimeur la veut", () => {
  const brut = monterCsv(catalogue(1)).csv.split("\r\n")[1].split(",");
  assert.equal(brut[13], "0", "par défaut, un zéro sans ambiguïté");

  const dit = monterCsv(catalogue(1), { libre: "GRATUIT" }).csv.split("\r\n")[1].split(",");
  assert.equal(dit[13], "GRATUIT");
});

test("les fins de ligne sont en CRLF, comme le veut la norme du CSV", () => {
  const { csv } = monterCsv(catalogue(3));
  assert.match(csv, /\r\n/);
  assert.doesNotMatch(csv, /[^\r]\n/, "aucun saut de ligne isolé");
});

test("on peut n'envoyer qu'une tranche, et les numéros restent les bons", () => {
  const { csv, nombre } = monterCsv(catalogue(500), { de: 200, a: 249 });
  const lignes = csv.trimEnd().split("\r\n").slice(1);
  assert.equal(nombre, 50);
  assert.equal(lignes[0].split(",")[0], "200");
  assert.equal(lignes.at(-1).split(",")[0], "249");
});

test("une tranche hors de la base ne produit aucune ligne", () => {
  assert.equal(monterCsv(catalogue(10), { de: 900, a: 999 }).nombre, 0);
});

// ---------------------------------------------------------------------
//  Le CSV et le logiciel doivent parler de la MÊME carte
// ---------------------------------------------------------------------

test("sur la vraie base, le CSV redonne exactement la grille du logiciel", () => {
  const vraie = JSON.parse(readFileSync(new URL("../data/cartes.json", import.meta.url), "utf8"));
  const { csv } = monterCsv(vraie, { de: 4321, a: 4321 });
  const valeurs = csv.trimEnd().split("\r\n")[1].split(",");
  const grille = vraie["4321"];

  assert.equal(valeurs[0], "4321");
  let i = 1;
  for (let col = 0; col < 5; col++) {
    for (let ligne = 0; ligne < 5; ligne++) {
      const attendu = grille[ligne][col];
      assert.equal(valeurs[i], String(attendu),
        `la case ${"BINGO"[col]}${ligne + 1} devrait valoir ${attendu}`);
      i++;
    }
  }
});

test("chaque colonne du CSV reste dans sa plage de numéros", () => {
  const vraie = JSON.parse(readFileSync(new URL("../data/cartes.json", import.meta.url), "utf8"));
  const { csv } = monterCsv(vraie, { de: 1, a: 300 });
  for (const ligne of csv.trimEnd().split("\r\n").slice(1)) {
    const v = ligne.split(",");
    for (let col = 0; col < 5; col++) {
      for (let k = 0; k < 5; k++) {
        const n = Number(v[1 + col * 5 + k]);
        if (n === 0) continue;                    // la case du centre
        assert.ok(n > col * 15 && n <= (col + 1) * 15,
          `carte ${v[0]} : ${n} ne peut pas être dans la colonne ${"BINGO"[col]}`);
      }
    }
  }
});
