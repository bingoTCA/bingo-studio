// =====================================================================
//  Scelle la base de cartes en service.
//
//  Écrit data/cartes.manifeste.json : origine, empreinte SHA-256, droits.
//  À partir de là, `npm test` refuse toute base dont l'empreinte ne
//  correspond plus — une modification accidentelle est attrapée avant
//  la diffusion, pas devant public.
//
//    node scripts/sceller-base.mjs --graine="ma graine" --detenteur="Marc Bert"
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(RACINE, "data/cartes.json");
const MANIFESTE = join(RACINE, "data/cartes.manifeste.json");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [cle, ...reste] = a.replace(/^--/, "").split("=");
    return [cle, reste.length ? reste.join("=") : true];
  })
);

const brut = readFileSync(BASE, "utf8");
const catalogue = JSON.parse(brut);
const numeros = Object.keys(catalogue).map(Number).sort((a, b) => a - b);

const manifeste = {
  detenteur: String(args.detenteur ?? "Marc Bert"),
  droits: `© ${args.annee ?? new Date().getFullYear()} ${args.detenteur ?? "Marc Bert"}. Base de cartes originale, tous droits réservés.`,
  graine: args.graine ? String(args.graine) : null,
  premier: numeros[0],
  dernier: numeros.at(-1),
  nombre: numeros.length,
  empreinte: "sha256:" + createHash("sha256").update(brut).digest("hex"),
  scelleLe: args.date ? String(args.date) : new Date().toISOString().slice(0, 10),
  note: "Ne pas modifier data/cartes.json. Toute retouche invalide l'empreinte "
      + "et fait échouer npm test. Pour changer de base : régénérer avec la "
      + "graine, puis resceller."
};

writeFileSync(MANIFESTE, JSON.stringify(manifeste, null, 2) + "\n", "utf8");

console.log("Base scellée.\n");
console.log(`  détenteur : ${manifeste.detenteur}`);
console.log(`  cartes    : ${manifeste.nombre.toLocaleString("fr-CA")} (${manifeste.premier} à ${manifeste.dernier})`);
console.log(`  graine    : ${manifeste.graine ?? "non consignée"}`);
console.log(`  empreinte : ${manifeste.empreinte}`);
console.log(`\nManifeste → ${MANIFESTE}`);
console.log(`\n« npm test » vérifie désormais cette empreinte à chaque exécution.`);
