// =====================================================================
//  Installe une base de cartes papier dans le logiciel.
//
//  La base de Bingo Studio, ce sont les séries de cartes papier que les
//  télévisions communautaires utilisent déjà — numérisées page par page
//  à partir des classeurs de vérification (cartables) : les feuillets qui
//  servent à vérifier les cartes gagnantes, pas les cartes des joueurs. Ce script prend le CSV issu de cette
//  numérisation, le contrôle carte par carte, l'installe dans
//  data/cartes.json et le scelle.
//
//  Il servira chaque fois qu'une série s'ajoute : une télé scanne son
//  classeur de vérification, on lit le PDF, on relance ce script sur le CSV complet.
//
//  Format accepté : une ligne par carte, la carte lue colonne par colonne.
//    carte,B1..B5,I1..I5,N1,N2,N4,N5,G1..G5,O1..O5     (N3 absent : case libre)
//    carte,B1..B5,I1..I5,N1..N5,G1..G5,O1..O5          (N3 présent, ignoré)
//
//    node scripts/importer-base.mjs --csv=chemin/cartes.csv
//    node scripts/importer-base.mjs --csv=… --verifier    (contrôle sans installer)
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

/**
 * Lit le CSV et rend { catalogue, problemes }.
 *
 * Le CSV se lit par COLONNES (B1 en haut de la colonne B) ; la grille du
 * logiciel est rangée par LIGNES, g[ligne][colonne]. Une transposition à
 * l'envers donnerait des cartes valides mais DIFFÉRENTES des cartes papier
 * — et un verdict faux en ondes, devant la personne qui tient sa carte.
 * D'où le test d'aller-retour dans tests/importer.test.mjs.
 */
export function lireCsv(texte) {
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const entete = lignes.shift().split(",").map((s) => s.trim());
  const colonnes = entete.slice(1);
  const avecN3 = colonnes.includes("N3");
  if (entete[0] !== "carte" || colonnes.length !== (avecN3 ? 25 : 24)) {
    throw new Error(`En-tête inattendu : « ${entete.join(",")} »`);
  }

  const catalogue = {};
  const problemes = [];
  for (const ligne of lignes) {
    const v = ligne.split(",").map((s) => s.trim());
    const numero = Number(v[0]);
    if (!Number.isInteger(numero) || numero < 1) { problemes.push(`ligne illisible : ${ligne.slice(0, 40)}`); continue; }
    if (catalogue[numero]) { problemes.push(`carte ${numero} en double dans le fichier`); continue; }

    const valeurs = {};
    colonnes.forEach((nom, i) => { valeurs[nom] = Number(v[i + 1]); });

    const g = Array.from({ length: 5 }, () => Array(5).fill(0));
    let ok = true;
    for (let col = 0; col < 5; col++) {
      for (let lig = 0; lig < 5; lig++) {
        if (col === 2 && lig === 2) continue;              // case libre
        const n = valeurs["BINGO"[col] + (lig + 1)];
        const [min, max] = PLAGES[col];
        if (!Number.isInteger(n) || n < min || n > max) {
          problemes.push(`carte ${numero} : ${"BINGO"[col]}${lig + 1} = ${v[colonnes.indexOf("BINGO"[col] + (lig + 1)) + 1]} hors de ${min}-${max}`);
          ok = false;
        }
        g[lig][col] = n;
      }
    }
    if (ok) catalogue[numero] = g;
  }
  return { catalogue, problemes };
}

/** Les suites de numéros sans trou : [[1, 9000], [27001, 34200]]. */
export function tranches(catalogue) {
  const nums = Object.keys(catalogue).map(Number).sort((a, b) => a - b);
  const r = [];
  for (const n of nums) {
    const derniere = r.at(-1);
    if (derniere && n === derniere[1] + 1) derniere[1] = n;
    else r.push([n, n]);
  }
  return r;
}

/** Même écriture compacte qu'avant : les numéros dans l'ordre, sans espace. */
export function ecrireJson(catalogue) {
  const nums = Object.keys(catalogue).map(Number).sort((a, b) => a - b);
  return "{" + nums.map((n) => `"${n}":${JSON.stringify(catalogue[n])}`).join(",") + "}";
}

// ---------------------------------------------------------------------

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [cle, ...reste] = a.replace(/^--/, "").split("=");
      return [cle, reste.length ? reste.join("=") : true];
    })
  );
  if (!args.csv) {
    console.error("Indique le fichier : --csv=chemin/cartes.csv");
    process.exit(1);
  }

  const { catalogue, problemes } = lireCsv(readFileSync(resolve(String(args.csv)), "utf8"));
  const nombre = Object.keys(catalogue).length;
  const t = tranches(catalogue);

  // Deux cartes identiques sous deux numéros : signe d'une page lue deux
  // fois, ou d'une erreur de numérotation à la numérisation.
  const vues = new Map();
  for (const [n, g] of Object.entries(catalogue)) {
    const sig = JSON.stringify(g);
    if (vues.has(sig)) problemes.push(`cartes ${vues.get(sig)} et ${n} identiques`);
    else vues.set(sig, n);
  }

  // Un même numéro deux fois sur une carte existe sur le papier (défaut
  // d'impression d'origine) : on le signale sans refuser la carte.
  const doublons = Object.entries(catalogue)
    .filter(([, g]) => { const f = g.flat().filter((x) => x); return new Set(f).size !== f.length; })
    .map(([n]) => Number(n));

  console.log(`\n  cartes lues   : ${nombre.toLocaleString("fr-CA")}`);
  console.log(`  tranches      : ${t.map(([a, b]) => `${a}–${b}`).join(" · ")}`);
  console.log(`  doublons      : ${doublons.length ? doublons.join(", ") + " (numéro répété sur la carte papier)" : "aucun"}`);
  console.log(`  problèmes     : ${problemes.length}`);
  for (const p of problemes.slice(0, 20)) console.log("    - " + p);

  if (problemes.length) {
    console.error("\nRien n'est installé : corrige d'abord les problèmes ci-dessus.\n");
    process.exit(1);
  }
  if (args.verifier) { console.log("\nContrôle seulement — rien n'est installé.\n"); process.exit(0); }

  const brut = ecrireJson(catalogue);
  writeFileSync(join(RACINE, "data/cartes.json"), brut);

  const nums = Object.keys(catalogue).map(Number).sort((a, b) => a - b);
  const manifeste = {
    source: String(args.source ?? "Séries de cartes papier Arrow, numérisées à partir des classeurs de vérification (cartables) des télévisions communautaires"),
    usage: "Vérification en ondes des cartes déjà achetées chez un fournisseur licencié. Le logiciel n'imprime pas de cartes.",
    tranches: t,
    premier: nums[0],
    dernier: nums.at(-1),
    nombre,
    doublonsConnus: doublons,
    empreinte: "sha256:" + createHash("sha256").update(brut).digest("hex"),
    scelleLe: new Date().toISOString().slice(0, 10),
    note: "Ne pas modifier data/cartes.json à la main : npm test refuse toute base dont l'empreinte ne correspond plus. Pour ajouter une série : relancer scripts/importer-base.mjs sur le CSV complet."
  };
  writeFileSync(join(RACINE, "data/cartes.manifeste.json"), JSON.stringify(manifeste, null, 2) + "\n");

  console.log(`\nInstallé et scellé → data/cartes.json (${(brut.length / 1048576).toFixed(1)} Mo)`);
  console.log(`Empreinte ${manifeste.empreinte.slice(0, 23)}…\n`);
}
