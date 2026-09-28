// =====================================================================
//  L'import des séries papier numérisées.
//
//  Ce qui passe par ici finit affiché en ondes, devant la personne qui a
//  sa carte en main. Une transposition à l'envers donnerait des cartes
//  parfaitement valides — 24 numéros, chacun dans sa colonne — mais qui ne
//  sont PAS celles du papier. Rien ne le signalerait, sauf ces tests.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { lireCsv, tranches, ecrireJson } from "../scripts/importer-base.mjs";
import { monterCsv } from "../scripts/cartes-en-csv.mjs";

// La carte 1 de la base TVRP, lue sur le papier : colonne B de haut en
// bas = 6, 4, 13, 8, 11. Ligne du haut = 6, 18, 45, 54, 66.
const CARTE_1 = [
  [ 6, 18, 45, 54, 66],
  [ 4, 16, 43, 58, 70],
  [13, 20,  0, 46, 69],
  [ 8, 25, 36, 56, 68],
  [11, 29, 41, 51, 63]
];
const ENTETE_24 = "carte,B1,B2,B3,B4,B5,I1,I2,I3,I4,I5,N1,N2,N4,N5,G1,G2,G3,G4,G5,O1,O2,O3,O4,O5";
const LIGNE_1 = "1,6,4,13,8,11,18,16,20,25,29,45,43,36,41,54,58,46,56,51,66,70,69,68,63";

test("le CSV se lit colonne par colonne : B1 est en haut à gauche, B2 en dessous", () => {
  const { catalogue, problemes } = lireCsv(`${ENTETE_24}\n${LIGNE_1}\n`);
  assert.deepEqual(problemes, []);
  assert.deepEqual(catalogue[1], CARTE_1);
});

test("la case du centre est libre, qu'elle soit absente du fichier ou non", () => {
  const sans = lireCsv(`${ENTETE_24}\n${LIGNE_1}\n`).catalogue[1];
  const avec = lireCsv(monterCsv({ 1: CARTE_1 }).csv).catalogue[1];
  assert.equal(sans[2][2], 0);
  assert.deepEqual(avec, sans);
});

test("aller-retour : exporter puis réimporter redonne exactement les mêmes cartes", () => {
  // Une deuxième carte valide : les lignes du haut et du bas échangées.
  // Chaque numéro reste dans sa colonne, le centre reste au centre.
  const retournee = [CARTE_1[4], CARTE_1[3], CARTE_1[2], CARTE_1[1], CARTE_1[0]];
  const base = { 1: CARTE_1, 27001: retournee };
  const { catalogue, problemes } = lireCsv(monterCsv(base).csv);
  assert.deepEqual(problemes, []);
  assert.deepEqual(catalogue, base);
});

test("un numéro hors de sa colonne est refusé, avec la case en cause", () => {
  const faux = LIGNE_1.replace(/^1,6,/, "1,16,");      // 16 en colonne B
  const { catalogue, problemes } = lireCsv(`${ENTETE_24}\n${faux}\n`);
  assert.equal(catalogue[1], undefined, "la carte fautive n'entre pas");
  assert.match(problemes[0], /carte 1 : B1 = 16 hors de 1-15/);
});

test("une case illisible (vide) est refusée, pas remplacée par zéro", () => {
  const trou = LIGNE_1.replace(/^1,6,4,/, "1,6,,");
  const { problemes } = lireCsv(`${ENTETE_24}\n${trou}\n`);
  assert.equal(problemes.length, 1);
  assert.match(problemes[0], /B2/);
});

test("un numéro de carte en double dans le fichier est signalé", () => {
  const { problemes } = lireCsv(`${ENTETE_24}\n${LIGNE_1}\n${LIGNE_1}\n`);
  assert.match(problemes[0], /carte 1 en double/);
});

test("un en-tête inattendu arrête tout avant d'installer quoi que ce soit", () => {
  assert.throws(() => lireCsv("numero,a,b\n1,2,3\n"), /En-tête inattendu/);
});

test("les tranches décrivent les séries présentes, trous compris", () => {
  const c = {};
  for (const n of [1, 2, 3, 27001, 27002, 45001]) c[n] = CARTE_1;
  assert.deepEqual(tranches(c), [[1, 3], [27001, 27002], [45001, 45001]]);
});

test("l'écriture JSON range les cartes dans l'ordre numérique", () => {
  const brut = ecrireJson({ 27001: CARTE_1, 2: CARTE_1, 10: CARTE_1 });
  assert.deepEqual(Object.keys(JSON.parse(brut)), ["2", "10", "27001"]);
  assert.ok(brut.indexOf('"2"') < brut.indexOf('"10"'));
});
