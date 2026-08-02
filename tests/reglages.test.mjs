// =====================================================================
//  Export et import des réglages.
//
//  Ce qu'on protège ici : une station qui réinstalle le logiciel doit
//  retrouver son habillage, et une station qui importe au mauvais moment ne
//  doit pas perdre la soirée en cours.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { etatNeuf, themeNeuf } from "../src/core/canal.js";
import {
  FORMAT, VERSION, clesMedias, monterDossier, lireDossier,
  appliquerReglages, nomDeFichier
} from "../src/core/reglages.js";

/** Un état de station bien garni : habillage réglé ET soirée en cours. */
function etatGarni() {
  const etat = etatNeuf();
  etat.titre = "Le Bingo TVRP";
  etat.telephones = ["418 385 3909", "1 888 312-4646"];
  etat.commanditaire = "Présenté par nos commanditaires";
  etat.parties = [
    { nom: "Partie 1", figure: "LIGNE", lot: 100 },
    { nom: "Partie 2", figure: "X", lot: 200 },
    { nom: "Jackpot", figure: "PLEINE", lot: 1000 }
  ];
  etat.partieIndex = 2;

  etat.theme = themeNeuf();
  etat.theme.ambiance = "#0f4c47";
  etat.theme.logo = "data:image/png;base64,AAAA";
  etat.theme.bandeau.actif = true;
  etat.theme.bandeau.messages = ["Merci à nos commanditaires"];
  etat.theme.pubs.images = ["data:image/png;base64,BBBB"];
  etat.theme.generique.musiques = [
    { cle: "musique-a", nom: "generique.mp3", type: "audio/mpeg", taille: 2048 },
    { cle: "musique-b", nom: "ambiance.mp3", type: "audio/mpeg", taille: 4096 }
  ];
  etat.theme.fondMedia.video = { cle: "fond-v", nom: "boucle.mp4", type: "video/mp4", taille: 9000 };

  // La soirée en cours
  etat.tirage = [12, 27, 44];
  etat.gagnants = [{ partie: "Partie 1", carte: 259, nom: "Jeannine Cyr", lot: 100 }];
  etat.horodatage = [{ n: 12, heure: "12 h 41" }];
  return etat;
}

// ---------------------------------------------------------------------
//  Ce qui voyage, et ce qui ne voyage pas
// ---------------------------------------------------------------------

test("le dossier emporte l'habillage et les parties", () => {
  const dossier = monterDossier(etatGarni(), {}, "2026-08-02");
  assert.equal(dossier.format, FORMAT);
  assert.equal(dossier.version, VERSION);
  assert.equal(dossier.reglages.titre, "Le Bingo TVRP");
  assert.equal(dossier.reglages.parties.length, 3);
  assert.equal(dossier.reglages.theme.ambiance, "#0f4c47");
  assert.equal(dossier.reglages.theme.logo, "data:image/png;base64,AAAA");
});

test("le dossier n'emporte PAS la soirée en cours", () => {
  const dossier = monterDossier(etatGarni(), {}, "2026-08-02");
  // Un fichier de réglages qui traînerait les gagnants d'un autre bingo, c'est
  // une confusion garantie le soir où on le réimporte.
  for (const trace of ["tirage", "gagnants", "horodatage", "enOnde", "ecran"]) {
    assert.equal(dossier.reglages[trace], undefined, `${trace} ne doit pas voyager`);
  }
});

// ---------------------------------------------------------------------
//  Les médias
// ---------------------------------------------------------------------

test("on retrouve toutes les clés de médias de l'habillage", () => {
  const cles = clesMedias(etatGarni().theme);
  assert.deepEqual(cles.sort(), ["fond-v", "musique-a", "musique-b"]);
});

test("une même clé utilisée deux fois n'est demandée qu'une seule fois", () => {
  const theme = themeNeuf();
  theme.generique.musiques = [{ cle: "double", nom: "a.mp3" }];
  theme.fondMedia.video = { cle: "double", nom: "a.mp3" };
  assert.deepEqual(clesMedias(theme), ["double"]);
});

test("un habillage sans média ne demande rien", () => {
  assert.deepEqual(clesMedias(themeNeuf()), []);
});

// ---------------------------------------------------------------------
//  Les fichiers qu'on refuse
// ---------------------------------------------------------------------

test("un fichier étranger est refusé, en français", () => {
  assert.throws(() => lireDossier({ nimporte: "quoi" }), /pas été produit par Bingo Studio/);
  assert.throws(() => lireDossier(null), /ne contient pas de réglages/);
  assert.throws(() => lireDossier("texte"), /ne contient pas de réglages/);
});

test("un dossier d'une version plus récente est refusé plutôt que mal lu", () => {
  assert.throws(
    () => lireDossier({ format: FORMAT, version: VERSION + 1, reglages: {} }),
    /version plus récente/
  );
});

test("un dossier sans réglages est refusé", () => {
  assert.throws(() => lireDossier({ format: FORMAT, version: VERSION }), /incomplet/);
});

test("un dossier valide se relit", () => {
  const dossier = monterDossier(etatGarni(), { "musique-a": { nom: "x.mp3" } }, "2026-08-02");
  const { reglages, medias } = lireDossier(JSON.parse(JSON.stringify(dossier)));
  assert.equal(reglages.titre, "Le Bingo TVRP");
  assert.ok(medias["musique-a"]);
});

// ---------------------------------------------------------------------
//  L'import ne doit pas casser la soirée
// ---------------------------------------------------------------------

test("importer n'efface ni le tirage ni les gagnants", () => {
  const courant = etatGarni();
  const { reglages } = lireDossier(monterDossier(etatNeuf(), {}, ""));
  const { etat } = appliquerReglages(courant, reglages);
  assert.deepEqual(etat.tirage, [12, 27, 44]);
  assert.equal(etat.gagnants.length, 1);
  assert.equal(etat.horodatage.length, 1);
});

test("la partie en cours revient dans les bornes si le dossier en porte moins", () => {
  const courant = etatGarni();          // partieIndex = 2, trois parties
  const maigre = etatNeuf();
  maigre.parties = [{ nom: "Une seule", figure: "LIGNE", lot: 50 }];
  const { etat } = appliquerReglages(courant, monterDossier(maigre).reglages);
  assert.equal(etat.parties.length, 1);
  assert.equal(etat.partieIndex, 0, "sinon la régie pointe sur une partie disparue");
});

test("un dossier sans partie laisse les parties en place", () => {
  const courant = etatGarni();
  const { etat } = appliquerReglages(courant, { titre: "Autre" });
  assert.equal(etat.parties.length, 3);
  assert.equal(etat.titre, "Autre");
});

// ---------------------------------------------------------------------
//  Les médias absents
// ---------------------------------------------------------------------

test("un média absent du dossier est retiré et nommé, pas laissé dans le vide", () => {
  const source = etatGarni();
  const { etat, retires } = appliquerReglages(
    etatNeuf(), monterDossier(source).reglages, ["musique-b", "fond-v"]
  );
  assert.deepEqual(etat.theme.generique.musiques.map((m) => m.cle), ["musique-a"]);
  assert.equal(etat.theme.fondMedia.video, null);
  assert.deepEqual(retires.sort(), ["ambiance.mp3", "boucle.mp4"]);
});

test("quand tous les médias sont là, rien n'est retiré", () => {
  const source = etatGarni();
  const { etat, retires } = appliquerReglages(etatNeuf(), monterDossier(source).reglages, []);
  assert.deepEqual(retires, []);
  assert.equal(etat.theme.generique.musiques.length, 2);
  assert.equal(etat.theme.fondMedia.video.nom, "boucle.mp4");
});

// ---------------------------------------------------------------------
//  L'aller-retour complet
// ---------------------------------------------------------------------

test("exporter puis importer redonne le même habillage", () => {
  const source = etatGarni();
  // On passe par le texte : c'est bien un fichier qui voyage, pas un objet.
  const surDisque = JSON.stringify(monterDossier(source, {}, "2026-08-02"));
  const { reglages } = lireDossier(JSON.parse(surDisque));
  const { etat } = appliquerReglages(etatNeuf(), reglages);

  assert.equal(etat.titre, source.titre);
  assert.deepEqual(etat.telephones, source.telephones);
  assert.equal(etat.commanditaire, source.commanditaire);
  assert.deepEqual(etat.parties, source.parties);
  assert.equal(etat.theme.ambiance, "#0f4c47");
  assert.equal(etat.theme.logo, "data:image/png;base64,AAAA");
  assert.deepEqual(etat.theme.bandeau.messages, ["Merci à nos commanditaires"]);
  assert.deepEqual(etat.theme.pubs.images, ["data:image/png;base64,BBBB"]);
});

test("un dossier d'une version plus ancienne récupère les réglages ajoutés depuis", () => {
  // Le cas réel : une station exporte, on ajoute un réglage au logiciel, elle
  // réimporte. Le réglage neuf doit prendre sa valeur par défaut, pas rester
  // absent — sinon l'antenne lit undefined et n'affiche plus rien.
  const vieux = { titre: "Ancien", theme: { ambiance: "#123456" } };
  const { etat } = appliquerReglages(etatNeuf(), vieux);
  assert.equal(etat.theme.ambiance, "#123456", "ce qui était réglé est gardé");
  assert.equal(etat.theme.fondMedia.opacite, themeNeuf().fondMedia.opacite);
  assert.equal(etat.theme.generique.reglementActif, themeNeuf().generique.reglementActif);
  assert.deepEqual(etat.theme.bandeau, themeNeuf().bandeau);
});

// ---------------------------------------------------------------------
//  Le nom du fichier
// ---------------------------------------------------------------------

test("le nom de fichier survit aux accents et aux espaces", () => {
  assert.equal(
    nomDeFichier("Télé du Rocher-Percé", "2026-08-02"),
    "bingo-studio-reglages-tele-du-rocher-perce-2026-08-02.json"
  );
});

test("un titre vide ou illisible donne quand même un nom utilisable", () => {
  assert.equal(nomDeFichier("", "2026-08-02"), "bingo-studio-reglages-bingo-2026-08-02.json");
  assert.equal(nomDeFichier("///", "2026-08-02"), "bingo-studio-reglages-bingo-2026-08-02.json");
  assert.ok(!nomDeFichier("A".repeat(200), "2026-08-02").includes(" "));
});
