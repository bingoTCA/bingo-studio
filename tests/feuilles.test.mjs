// =====================================================================
//  Les feuilles imprimables.
//
//  Ce qui se joue ici part chez l'imprimeur en milliers d'exemplaires :
//  une erreur ne se corrige pas après coup, elle se réimprime.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { monterHtml, decouper, encreLisible, DISPOSITIONS, FORMATS } from "../src/core/feuilles.js";

/** Un petit catalogue de fixture : les tests ne dépendent pas de la base livrée. */
function catalogue(n) {
  const base = {};
  for (let i = 1; i <= n; i++) {
    base[String(i)] = [
      [1 + (i % 5), 16, 31, 46, 61],
      [2, 17, 32, 47, 62],
      [3, 18, 0, 48, 63],          // 0 = case libre au centre
      [4, 19, 34, 49, 64],
      [5, 20, 35, 50, 65]
    ];
  }
  return base;
}

// ---------------------------------------------------------------------
//  L'encre des blocs B-I-N-G-O
// ---------------------------------------------------------------------

test("l'encre bascule pour rester lisible sur n'importe quelle couleur", () => {
  assert.equal(encreLisible("#000000"), "#ffffff", "noir → lettres blanches");
  assert.equal(encreLisible("#ffffff"), "#000000", "blanc → lettres noires");
  assert.equal(encreLisible("#ffd700"), "#000000", "jaune vif → lettres noires");
  assert.equal(encreLisible("#c8102e"), "#ffffff", "rouge → lettres blanches");
  assert.equal(encreLisible("#4a1f7a"), "#ffffff", "violet foncé → lettres blanches");
});

test("une couleur écrite n'importe comment ne casse pas l'impression", () => {
  for (const bancal of ["", null, undefined, "pas une couleur", "#12", "###"]) {
    const encre = encreLisible(bancal);
    assert.ok(encre === "#000000" || encre === "#ffffff", `${bancal} donne ${encre}`);
  }
});

test("la notation courte à trois chiffres est comprise", () => {
  assert.equal(encreLisible("#fff"), encreLisible("#ffffff"));
  assert.equal(encreLisible("#000"), encreLisible("#000000"));
});

// ---------------------------------------------------------------------
//  La couleur ne touche QUE les blocs
// ---------------------------------------------------------------------

test("la couleur habille les blocs BINGO et rien d'autre", () => {
  const { html } = monterHtml(catalogue(3), { parFeuille: 3, couleur: "#c8102e" });

  // Le bloc la porte…
  assert.match(html, /\.entete span \{[^}]*background: #c8102e/,
    "les blocs B-I-N-G-O doivent prendre la couleur");

  // …et le papier reste blanc. Une feuille imprimée pleine page de couleur
  // coûte une fortune en encre et se lit mal.
  assert.match(html, /\.feuille \{[^}]*background: #fff/, "le papier reste blanc");
  assert.doesNotMatch(html, /html, body \{[^}]*background: #c8102e/, "le fond de page reste blanc");
  assert.match(html, /\.case \{[^}]*color: #000/, "les numéros restent noirs");
});

test("sans couleur choisie, la feuille est entièrement noir et blanc", () => {
  const { html } = monterHtml(catalogue(3), { parFeuille: 3 });
  assert.match(html, /\.entete span \{[^}]*background: #000000/);
  assert.match(html, /\.entete span \{[^}]*color: #ffffff/);
});

// ---------------------------------------------------------------------
//  Les numéros de série éparpillés
// ---------------------------------------------------------------------

test("une feuille ne porte jamais 1-2-3 à la suite", () => {
  const { feuilles } = decouper(catalogue(60), { parFeuille: 3, graine: "essai" });
  const enSuite = feuilles.filter((f) => f.length === 3 && f[1] === f[0] + 1 && f[2] === f[0] + 2);
  assert.equal(enSuite.length, 0, `${enSuite.length} feuille(s) portent des séries consécutives`);
});

test("chaque carte se retrouve sur une feuille, une seule fois", () => {
  const { feuilles } = decouper(catalogue(100), { parFeuille: 6, graine: "essai" });
  const tous = feuilles.flat();
  assert.equal(tous.length, 100, "aucune carte perdue");
  assert.equal(new Set(tous).size, 100, "aucune carte en double");
});

test("à graine égale, la répartition est identique — un lot perdu se réimprime", () => {
  const a = decouper(catalogue(50), { parFeuille: 3, graine: "lot du 12 mars" });
  const b = decouper(catalogue(50), { parFeuille: 3, graine: "lot du 12 mars" });
  assert.deepEqual(a.feuilles, b.feuilles);
});

test("à graine différente, la répartition change", () => {
  const a = decouper(catalogue(50), { parFeuille: 3, graine: "un" });
  const b = decouper(catalogue(50), { parFeuille: 3, graine: "deux" });
  assert.notDeepEqual(a.feuilles, b.feuilles);
});

// ---------------------------------------------------------------------
//  Les tranches
// ---------------------------------------------------------------------

test("on peut ne monter qu'une tranche de la base", () => {
  const { numeros } = decouper(catalogue(1000), { parFeuille: 3, de: 100, a: 199 });
  assert.equal(numeros.length, 100);
  assert.equal(Math.min(...numeros), 100);
  assert.equal(Math.max(...numeros), 199);
});

test("une tranche vide ne produit pas de feuille fantôme", () => {
  const r = decouper(catalogue(10), { parFeuille: 3, de: 500, a: 600 });
  assert.deepEqual(r.feuilles, []);
  assert.equal(r.derniereIncomplete, 0);
});

test("la dernière feuille incomplète est annoncée, pas cachée", () => {
  // 10 cartes à 3 par feuille : 3 pleines + 1 qui n'en porte qu'une.
  const r = decouper(catalogue(10), { parFeuille: 3, graine: "essai" });
  assert.equal(r.feuilles.length, 4);
  assert.equal(r.derniereIncomplete, 1);
});

test("quand le compte tombe juste, rien n'est signalé", () => {
  const r = decouper(catalogue(9), { parFeuille: 3, graine: "essai" });
  assert.equal(r.feuilles.length, 3);
  assert.equal(r.derniereIncomplete, 0);
});

// ---------------------------------------------------------------------
//  Ce qu'on refuse
// ---------------------------------------------------------------------

test("une disposition ou un format inconnu est refusé avant d'imprimer", () => {
  assert.throws(() => monterHtml(catalogue(3), { parFeuille: 7 }), /Disposition inconnue/);
  assert.throws(() => monterHtml(catalogue(3), { format: "Tabloid" }), /Format inconnu/);
});

test("toutes les dispositions annoncées tiennent la route", () => {
  for (const n of Object.keys(DISPOSITIONS).map(Number)) {
    const m = monterHtml(catalogue(20), { parFeuille: n });
    assert.equal(m.grilles, 20, `${n} grilles par feuille`);
    assert.ok(m.feuilles >= Math.ceil(20 / n));
  }
});

test("tous les formats donnent une page aux bonnes dimensions", () => {
  for (const [nom, attendu] of Object.entries(FORMATS)) {
    const m = monterHtml(catalogue(3), { format: nom });
    assert.deepEqual(m.page, attendu, nom);
  }
});

// ---------------------------------------------------------------------
//  La mention de droits
// ---------------------------------------------------------------------

test("la mention de droits figure sur chaque feuille", () => {
  const droits = "Cartes libres de droits pour les télévisions communautaires autonomes";
  const { html, feuilles } = monterHtml(catalogue(9), { parFeuille: 3, droits });
  assert.equal(feuilles, 3);
  assert.equal(html.split(droits).length - 1, 3, "une mention par feuille");
});

test("une mention de droits contenant du HTML est échappée, pas exécutée", () => {
  const { html } = monterHtml(catalogue(3), { droits: '<script>alert("x")</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
