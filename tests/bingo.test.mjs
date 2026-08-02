// =====================================================================
//  Tests de la logique pure. Ce qui est testé ici part en ondes :
//  une erreur de détection de gagnant est une erreur devant public.
//    npm test
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  lettre, rangee, FIGURES, compteRestants, carteEstGagnante,
  verifierCarte, validerSaisie, restantsDansBoulier, casesRetenues
} from "../src/core/bingo.js";

const ici = dirname(fileURLToPath(import.meta.url));
const brutCatalogue = readFileSync(join(ici, "../data/cartes.json"), "utf8");
const catalogue = JSON.parse(brutCatalogue);

// ---------------------------------------------------------------------

test("lettre() suit les colonnes B I N G O", () => {
  assert.equal(lettre(1), "B");
  assert.equal(lettre(15), "B");
  assert.equal(lettre(16), "I");
  assert.equal(lettre(45), "N");
  assert.equal(lettre(46), "G");
  assert.equal(lettre(60), "G");
  assert.equal(lettre(61), "O");
  assert.equal(lettre(75), "O");
});

test("rangee() donne les 15 numéros de chaque colonne", () => {
  assert.deepEqual(rangee("B")[0], 1);
  assert.deepEqual(rangee("B").at(-1), 15);
  assert.deepEqual(rangee("O")[0], 61);
  assert.deepEqual(rangee("O").at(-1), 75);
  assert.equal(rangee("N").length, 15);
});

// ---------------------------------------------------------------------
//  Catalogue
// ---------------------------------------------------------------------

// Les tests valident la base RÉELLEMENT installée, sans figer son nombre de
// cartes : tu peux générer la tienne (scripts/generer-cartes.mjs) sans les
// réécrire.
const NUMEROS = Object.keys(catalogue).map(Number).sort((a, b) => a - b);

test("la base scellée n'a pas bougé d'un octet", () => {
  const chemin = join(ici, "../data/cartes.manifeste.json");
  if (!existsSync(chemin)) {
    assert.fail("data/cartes.manifeste.json est absent — lance : node scripts/sceller-base.mjs");
  }
  const m = JSON.parse(readFileSync(chemin, "utf8"));
  const empreinte = "sha256:" + createHash("sha256").update(brutCatalogue).digest("hex");

  assert.equal(empreinte, m.empreinte,
    "L'empreinte de data/cartes.json ne correspond plus au manifeste.\n"
    + "   La base a été modifiée. Si c'est voulu, resceller ; sinon, restaurer.");
  assert.equal(NUMEROS.length, m.nombre);
  assert.equal(NUMEROS[0], m.premier);
  assert.equal(NUMEROS.at(-1), m.dernier);
});

test("le catalogue est numéroté sans trou", () => {
  assert.ok(NUMEROS.length > 0, "le catalogue est vide");
  for (let i = NUMEROS[0]; i <= NUMEROS.at(-1); i++) {
    assert.ok(catalogue[String(i)], `carte ${i} manquante`);
  }
  assert.equal(NUMEROS.length, NUMEROS.at(-1) - NUMEROS[0] + 1);
});

test("chaque carte est une grille 5x5 avec la case libre au centre", () => {
  for (const i of NUMEROS) {
    const g = catalogue[String(i)];
    assert.equal(g.length, 5, `carte ${i}`);
    for (const ligne of g) assert.equal(ligne.length, 5, `carte ${i}`);
    assert.equal(g[2][2], 0, `carte ${i} : la case centrale doit être libre`);
  }
});

test("chaque colonne d'une carte respecte sa plage de numéros", () => {
  const plages = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  for (const i of NUMEROS) {
    const g = catalogue[String(i)];
    for (let c = 0; c < 5; c++) {
      const [min, max] = plages[c];
      for (let r = 0; r < 5; r++) {
        const n = g[r][c];
        if (n === 0) continue;
        assert.ok(n >= min && n <= max, `carte ${i}, case [${r}][${c}] = ${n} hors de ${min}-${max}`);
      }
    }
  }
});

test("chaque carte porte bien 24 numéros", () => {
  for (const i of NUMEROS) {
    const nums = catalogue[String(i)].flat().filter((n) => n !== 0);
    assert.equal(nums.length, 24, `carte ${i}`);
  }
});

// Défaut connu de la base d'origine A09036 (ligne 9043 du CSV) : la carte
// 9042 porte le 58 deux fois en colonne G. Elle n'a donc que 23 numéros
// distincts et complète la carte pleine une boule plus tôt que les autres.
// On le tolère s'il est là, mais on refuse tout NOUVEAU doublon — et une
// base générée par scripts/generer-cartes.mjs n'en a aucun.
const DOUBLONS_TOLERES = new Set([9042]);

test("aucune carte ne contient deux fois le même numéro", () => {
  const trouves = [];
  for (const i of NUMEROS) {
    const nums = catalogue[String(i)].flat().filter((n) => n !== 0);
    if (new Set(nums).size !== nums.length) trouves.push(i);
  }
  const inattendus = trouves.filter((n) => !DOUBLONS_TOLERES.has(n));
  assert.deepEqual(inattendus, [], `cartes avec un doublon : ${inattendus}`);
});

test("aucune carte n'est le sosie d'une autre", () => {
  const vues = new Map();
  for (const i of NUMEROS) {
    const sig = JSON.stringify(catalogue[String(i)]);
    assert.equal(vues.has(sig), false, `cartes ${vues.get(sig)} et ${i} sont identiques`);
    vues.set(sig, i);
  }
});

// ---------------------------------------------------------------------
//  Figures
// ---------------------------------------------------------------------

// Grille FIXE, écrite ici et pas tirée du catalogue : la logique des figures
// doit se tester indépendamment de la base livrée. (Ces tests s'appuyaient
// avant sur la carte 1 du catalogue — changer de base les cassait tous.)
const carte1 = [
  [ 6, 18, 45, 54, 66],
  [ 4, 16, 43, 58, 70],
  [13, 20,  0, 46, 69],
  [ 8, 25, 36, 56, 68],
  [11, 29, 41, 51, 63]
];

test("carte pleine : gagnante seulement quand les 24 numéros sont sortis", () => {
  const nums = carte1.flat().filter((n) => n !== 0);
  assert.equal(nums.length, 24);

  const presque = new Set(nums.slice(0, 23));
  assert.equal(compteRestants(carte1, presque, "PLEINE"), 1);
  assert.equal(carteEstGagnante(carte1, presque, "PLEINE"), false);

  const tout = new Set(nums);
  assert.equal(compteRestants(carte1, tout, "PLEINE"), 0);
  assert.equal(carteEstGagnante(carte1, tout, "PLEINE"), true);
});

test("la case libre compte comme marquée", () => {
  // Ligne du milieu : 13, 20, LIBRE, 46, 69 -> 4 numéros suffisent.
  const tirage = new Set([13, 20, 46, 69]);
  assert.equal(compteRestants(carte1, tirage, "LIGNE_H"), 0);
});

test("LIGNE_H retient la meilleure ligne, pas la première", () => {
  // Dernière ligne complète, les autres vides.
  const tirage = new Set([11, 29, 41, 51, 63]);
  assert.equal(compteRestants(carte1, tirage, "LIGNE_H"), 0);
});

test("LIGNE_V fonctionne sur les colonnes", () => {
  const colonneB = [6, 4, 13, 8, 11];
  assert.equal(compteRestants(carte1, new Set(colonneB), "LIGNE_V"), 0);
  assert.equal(compteRestants(carte1, new Set(colonneB.slice(0, 4)), "LIGNE_V"), 1);
});

test("DIAGONALE accepte les deux sens", () => {
  const descendante = [6, 16, 56, 63];         // [0][0],[1][1],[3][3],[4][4] + centre libre
  const montante = [66, 58, 25, 11];           // [0][4],[1][3],[3][1],[4][0] + centre libre
  assert.equal(compteRestants(carte1, new Set(descendante), "DIAGONALE"), 0);
  assert.equal(compteRestants(carte1, new Set(montante), "DIAGONALE"), 0);
});

test("X exige les deux diagonales à la fois", () => {
  const descendante = new Set([6, 16, 56, 63]);
  assert.equal(compteRestants(carte1, descendante, "X"), 4);
  const lesDeux = new Set([6, 16, 56, 63, 66, 58, 25, 11]);
  assert.equal(compteRestants(carte1, lesDeux, "X"), 0);
});

test("les 4 coins ne demandent que 4 numéros", () => {
  assert.equal(compteRestants(carte1, new Set([6, 66, 11, 63]), "QUATRE_COINS"), 0);
  assert.equal(compteRestants(carte1, new Set([6, 66, 11]), "QUATRE_COINS"), 1);
});

test("le tour compte 16 cases et n'inclut pas le centre", () => {
  const cases = FIGURES.TOUR.cases;
  assert.equal(cases.length, 16);
  assert.ok(!cases.some(([r, c]) => r === 2 && c === 2));
});

test("une figure inconnue ne déclare jamais un gagnant", () => {
  assert.equal(compteRestants(carte1, new Set([1, 2, 3]), "FIGURE_INEXISTANTE"), 999);
  assert.equal(carteEstGagnante(carte1, new Set(), "FIGURE_INEXISTANTE"), false);
});

test("casesRetenues montre la variante la plus avancée", () => {
  const tirage = new Set([11, 29, 41, 51]);   // dernière ligne, à une case du but
  const cases = casesRetenues(carte1, tirage, "LIGNE_H");
  assert.deepEqual(cases.map(([r]) => r), [4, 4, 4, 4, 4]);
});

// ---------------------------------------------------------------------
//  Vérification de carte
// ---------------------------------------------------------------------

// Catalogue minuscule et fixe : ces tests portent sur verifierCarte, pas
// sur le contenu de la base en service.
const CATALOGUE_ESSAI = { "1": carte1 };

test("verifierCarte trouve une carte du catalogue et compte les restants", () => {
  const v = verifierCarte(CATALOGUE_ESSAI, 1, [6, 18, 45, 54], "LIGNE_H");
  assert.equal(v.statut, "PAS_ENCORE");
  assert.equal(v.numero, 1);
  assert.equal(v.restants, 1);
  assert.equal(v.marquees[0][0], true);
  assert.equal(v.marquees[2][2], true, "la case libre doit être marquée");
  assert.equal(v.marquees[4][0], false);
});

test("verifierCarte déclare la carte gagnante au bon moment", () => {
  const v = verifierCarte(CATALOGUE_ESSAI, 1, [6, 18, 45, 54, 66], "LIGNE_H");
  assert.equal(v.statut, "GAGNANTE");
  assert.equal(v.restants, 0);
});

test("verifierCarte refuse proprement un numéro hors catalogue", () => {
  for (const mauvais of [0, 2, -3, "abc", "", null, undefined, 1.5]) {
    const v = verifierCarte(CATALOGUE_ESSAI, mauvais, [1, 2, 3], "PLEINE");
    assert.equal(v.statut, "INTROUVABLE", `numéro ${mauvais}`);
    assert.equal(v.grille, null);
  }
});

test("verifierCarte accepte un numéro saisi en texte", () => {
  const dernier = String(NUMEROS.at(-1));
  const v = verifierCarte(catalogue, dernier, [], "PLEINE");
  assert.equal(v.statut, "PAS_ENCORE");
  assert.equal(v.numero, Number(dernier));
});

test("verifierCarte refuse un numéro hors des bornes de la base en service", () => {
  for (const mauvais of [NUMEROS[0] - 1, NUMEROS.at(-1) + 1]) {
    const v = verifierCarte(catalogue, mauvais, [], "PLEINE");
    assert.equal(v.statut, "INTROUVABLE", `numéro ${mauvais}`);
  }
});

// ---------------------------------------------------------------------
//  Saisie du boulier — la protection contre les fautes de frappe
// ---------------------------------------------------------------------

test("une saisie valide passe", () => {
  const r = validerSaisie("54", [12, 30]);
  assert.equal(r.ok, true);
  assert.equal(r.numero, 54);
  assert.equal(r.lettre, "G");
});

test("une saisie vide est refusée", () => {
  assert.equal(validerSaisie("", []).raison, "VIDE");
  assert.equal(validerSaisie("   ", []).raison, "VIDE");
  assert.equal(validerSaisie(null, []).raison, "VIDE");
});

test("un numéro hors de 1-75 est refusé", () => {
  for (const mauvais of ["0", "76", "99", "-5", "4.5", "abc"]) {
    assert.equal(validerSaisie(mauvais, []).raison, "HORS_PLAGE", `saisie ${mauvais}`);
  }
});

test("un numéro déjà sorti est refusé, avec son rang", () => {
  const r = validerSaisie("30", [12, 30, 55]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, "DEJA_SORTI");
  assert.match(r.message, /2e boule/);
});

test("restantsDansBoulier décompte les 75 boules", () => {
  assert.equal(restantsDansBoulier([]), 75);
  assert.equal(restantsDansBoulier([1, 2, 3]), 72);
});
