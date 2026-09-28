// =====================================================================
//  Le site dit-il la vérité sur le logiciel ?
//
//  Le site a déjà affirmé des choses que le logiciel avait cessé d'être
//  (une base « libre de droits » de 50 000 cartes, alors remplacée par les
//  séries Arrow Games). Une page qui promet une série que le logiciel ne
//  connaît pas, c'est une station qui tape un numéro en ondes et lit
//  « vérification au cartable » devant tout le monde.
//
//  Ces tests lisent la page et la comparent à la base installée.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const regie = readFileSync(new URL("../src/regie/regie.html", import.meta.url), "utf8");
const catalogue = JSON.parse(readFileSync(new URL("../data/cartes.json", import.meta.url), "utf8"));
const NUMEROS = Object.keys(catalogue).map(Number);

const series = [...page.matchAll(
  /class="serie-ligne" data-de="(\d+)" data-a="(\d+)" data-integrees="(\d+)"[\s\S]*?<i style="width:(\d+)%"><\/i>/g
)].map(([, de, a, integrees, largeur]) => ({ de: +de, a: +a, integrees: +integrees, largeur: +largeur }));

test("la page annonce des séries", () => {
  assert.ok(series.length >= 1, "aucune série trouvée dans la section #cartes");
});

test("pour chaque série, le nombre annoncé est celui que le logiciel contient", () => {
  for (const s of series) {
    const reel = NUMEROS.filter((n) => n >= s.de && n <= s.a).length;
    assert.equal(s.integrees, reel,
      `série ${s.de}–${s.a} : la page annonce ${s.integrees} cartes, la base en contient ${reel}`);
  }
});

test("la jauge de chaque série correspond à ce qui est intégré", () => {
  for (const s of series) {
    const attendu = Math.round((s.integrees / (s.a - s.de + 1)) * 100);
    assert.equal(s.largeur, attendu, `série ${s.de}–${s.a} : jauge à ${s.largeur} %, devrait être ${attendu} %`);
  }
});

test("aucune carte du logiciel n'appartient à une série absente de la page", () => {
  const orphelines = NUMEROS.filter((n) => !series.some((s) => n >= s.de && n <= s.a));
  assert.deepEqual(orphelines.slice(0, 5), [],
    `${orphelines.length} carte(s) hors des séries annoncées — ajoute la série sur la page`);
});

test("le total annoncé en toutes lettres est le vrai total", () => {
  const total = NUMEROS.length.toLocaleString("fr-CA").replace(/\s/g, "&nbsp;");
  assert.ok(page.includes(`<strong>${total} cartes</strong>`),
    `la page doit annoncer « ${total} cartes » dans la version actuelle`);
});

test("les affirmations de l'ancienne base ne reviennent pas", () => {
  assert.doesNotMatch(page, /50 000 cartes|50&nbsp;000 cartes|libres? de droits/i);
  assert.doesNotMatch(page, /images\/impression\.png|images\/feuille-cartes\.png/);
});

test("l'impression reste masquée dans la régie — la base est celle d'un fournisseur", () => {
  // Imprimer les séries Arrow Games, ce serait reproduire les cartes d'un
  // fournisseur. Le code d'impression existe encore ; il ne doit pas
  // redevenir visible par accident.
  assert.match(regie, /<button id="btn-cartes"[^>]*\bhidden\b/, "le bouton « Imprimer les cartes » doit rester masqué");
  assert.match(regie, /<div id="section-impression" hidden>/, "la section d'impression doit rester masquée");
});
