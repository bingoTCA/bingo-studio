// =====================================================================
//  Tests du générateur de cartes. Ce qui sort d'ici part chez
//  l'imprimeur : une carte fausse, ce sont des cartes vendues à jeter.
//    npm test
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(RACINE, "scripts/generer-cartes.mjs");
const dossier = mkdtempSync(join(tmpdir(), "bingo-cartes-"));

function generer(nom, options = []) {
  const sortie = join(dossier, nom);
  execFileSync("node", [SCRIPT, `--sortie=${sortie}`, ...options], { cwd: RACINE });
  return sortie;
}

const PLAGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

test("la même graine produit exactement la même base", () => {
  const a = readFileSync(generer("a.json", ["--fin=300", "--graine=essai", "--sans-csv"]), "utf8");
  const b = readFileSync(generer("b.json", ["--fin=300", "--graine=essai", "--sans-csv"]), "utf8");
  assert.equal(a, b);
});

test("une graine différente produit une base différente", () => {
  const a = readFileSync(generer("c.json", ["--fin=300", "--graine=un", "--sans-csv"]), "utf8");
  const b = readFileSync(generer("d.json", ["--fin=300", "--graine=deux", "--sans-csv"]), "utf8");
  assert.notEqual(a, b);
});

test("la plage demandée est respectée, sans trou", () => {
  const cat = JSON.parse(readFileSync(generer("e.json", ["--debut=500", "--fin=800", "--graine=x", "--sans-csv"]), "utf8"));
  const cles = Object.keys(cat).map(Number).sort((a, b) => a - b);
  assert.equal(cles[0], 500);
  assert.equal(cles.at(-1), 800);
  assert.equal(cles.length, 301);
});

test("les cartes produites sont toutes valides et toutes différentes", () => {
  const cat = JSON.parse(readFileSync(generer("f.json", ["--fin=1000", "--graine=validite", "--sans-csv"]), "utf8"));
  const vues = new Set();

  for (const [numero, g] of Object.entries(cat)) {
    assert.equal(g.length, 5, `carte ${numero}`);
    for (const ligne of g) assert.equal(ligne.length, 5, `carte ${numero}`);
    assert.equal(g[2][2], 0, `carte ${numero} : case centrale libre`);

    for (let c = 0; c < 5; c++) {
      const [min, max] = PLAGES[c];
      for (let r = 0; r < 5; r++) {
        const n = g[r][c];
        if (n === 0) { assert.ok(r === 2 && c === 2, `carte ${numero} : case libre hors centre`); continue; }
        assert.ok(n >= min && n <= max, `carte ${numero} : ${n} hors de ${min}-${max}`);
      }
    }

    const nums = g.flat().filter((n) => n !== 0);
    assert.equal(nums.length, 24, `carte ${numero}`);
    assert.equal(new Set(nums).size, 24, `carte ${numero} : doublon interne`);

    const sig = JSON.stringify(g);
    assert.equal(vues.has(sig), false, `carte ${numero} : sosie d'une autre`);
    vues.add(sig);
  }
});

test("le CSV de l'imprimeur dit exactement la même chose que le JSON", () => {
  const chemin = generer("g.json", ["--fin=400", "--graine=csv"]);
  const cat = JSON.parse(readFileSync(chemin, "utf8"));
  const lignes = readFileSync(chemin.replace(/\.json$/, ".csv"), "utf8").trim().split("\n");

  // L'en-tête saute POS13 : c'est la case libre, elle n'est pas imprimée.
  assert.match(lignes[0], /"POS12","POS14"/);
  assert.equal(lignes.length - 1, 400);

  for (let i = 1; i < lignes.length; i++) {
    const v = lignes[i].split(",").map(Number);
    const g = cat[String(v[0])];
    assert.ok(g, `carte ${v[0]} absente du JSON`);
    let k = 1;
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        if (c === 2 && r === 2) continue;
        assert.equal(g[r][c], v[k++], `carte ${v[0]}, case [${r}][${c}]`);
      }
    }
  }
});

test("une plage invalide est refusée au lieu d'écrire n'importe quoi", () => {
  assert.throws(() => generer("h.json", ["--debut=100", "--fin=50", "--graine=x"]));
});

test.after(() => rmSync(dossier, { recursive: true, force: true }));
