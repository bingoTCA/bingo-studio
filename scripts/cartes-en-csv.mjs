// =====================================================================
//  La base en CSV, pour l'imprimeur.
//
//  Un imprimeur qui fait du bingo compose ses cartes lui-même, à données
//  variables : il ne veut pas notre mise en page, il veut nos NUMÉROS.
//  Ce script sort la base sous la forme qu'il attend — une ligne par
//  carte, vingt-cinq colonnes dans l'ordre B-I-N-G-O, de haut en bas.
//
//  L'ordre des colonnes est celui d'une carte lue colonne par colonne :
//  B1 est en haut à gauche, B5 en bas de la première colonne, I1 en haut
//  de la deuxième, et ainsi de suite. N3 est la case du centre.
//
//    node scripts/cartes-en-csv.mjs --de=1 --a=100
//    node scripts/cartes-en-csv.mjs --libre=GRATUIT --sortie=data/base.csv
// =====================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [cle, ...reste] = a.replace(/^--/, "").split("=");
    return [cle, reste.length ? reste.join("=") : true];
  })
);

if (args.aide || args.h) {
  console.log(`
La base de cartes en CSV

  --de=N --a=N      ne sortir qu'une tranche de la base    (défaut : toute)
  --libre=TEXTE     ce qu'on écrit dans la case du centre       (défaut 0)
  --sortie=CHEMIN   fichier produit            (défaut data/cartes-<n>.csv)

Une ligne par carte. Colonnes : carte, puis B1..B5, I1..I5, N1..N5,
G1..G5, O1..O5 — la carte lue colonne par colonne, de haut en bas.
N3 est la case du centre, celle qui est donnée.
`);
  process.exit(0);
}

/**
 * Une grille est rangée par LIGNES — g[ligne][colonne] — parce que c'est
 * ainsi qu'on la dessine. Le CSV, lui, se lit par COLONNES : c'est la
 * façon dont on nomme les cases d'une carte de bingo (B1, B2, … O5).
 * D'où la transposition, qui n'est pas un détail : l'inverser donnerait
 * des cartes valides mais différentes de celles du logiciel, et une
 * vérification à l'antenne qui contredirait le carton du joueur.
 */
export function enColonnes(grille) {
  const cases = [];
  for (let col = 0; col < 5; col++) {
    for (let ligne = 0; ligne < 5; ligne++) cases.push(grille[ligne][col]);
  }
  return cases;
}

export function monterCsv(catalogue, options = {}) {
  const libre = String(options.libre ?? "0");
  const numeros = Object.keys(catalogue)
    .map(Number)
    .filter((n) => n >= (options.de ?? 1) && n <= (options.a ?? Infinity))
    .sort((a, b) => a - b);

  const entetes = ["carte"];
  for (const lettre of "BINGO") for (let i = 1; i <= 5; i++) entetes.push(lettre + i);

  const lignes = [entetes.join(",")];
  for (const n of numeros) {
    const cases = enColonnes(catalogue[String(n)])
      .map((v) => (v === 0 ? libre : String(v)));
    lignes.push([n, ...cases].join(","));
  }
  // Fin de ligne CRLF : c'est ce que demande la norme du CSV, et ce
  // qu'attendent les vieux outils de composition sous Windows.
  return { csv: lignes.join("\r\n") + "\r\n", nombre: numeros.length };
}

// ---------------------------------------------------------------------

// « file://» + argv[1] ne suffit pas : le dossier de Marc s'appelle
// « APP_WEB (deploy) », et import.meta.url encode l'espace en %20 alors
// qu'argv[1] ne l'encode pas. La comparaison échouait, et le script se
// terminait sans rien écrire ni rien dire.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalogue = JSON.parse(readFileSync(join(RACINE, "data/cartes.json"), "utf8"));
  const de = args.de ? Number(args.de) : 1;
  const a = args.a ? Number(args.a) : Infinity;

  const { csv, nombre } = monterCsv(catalogue, { de, a, libre: args.libre });
  if (!nombre) {
    console.error(`Aucune carte entre ${de} et ${a}. La base va de 1 à ${Object.keys(catalogue).length}.`);
    process.exit(1);
  }

  const sortie = resolve(RACINE, args.sortie || `data/cartes-${nombre}.csv`);
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, csv, "utf8");

  const bornes = nombre === Object.keys(catalogue).length ? "toute la base" : `n° ${de} à ${Math.min(a, de + nombre - 1)}`;
  console.log(`\n  cartes   : ${nombre.toLocaleString("fr-CA")} (${bornes})`);
  console.log(`  centre   : « ${args.libre ?? "0"} »`);
  console.log(`  colonnes : carte, B1…B5, I1…I5, N1…N5, G1…G5, O1…O5`);
  console.log(`\nCSV → ${sortie}\n`);
}
