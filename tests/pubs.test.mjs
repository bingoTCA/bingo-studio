// =====================================================================
//  Les publicités prêtes à passer.
//
//  Défaut vécu : la régie ne comptait que les images téléversées une à
//  une. Une station qui avait choisi un DOSSIER — le mode qu'on encourage
//  — cliquait « Passer aux pubs » et se faisait renvoyer aux réglages
//  avec « Ajoute d'abord des images ». La fonction était inatteignable
//  par son propre bouton, alors que l'antenne, elle, savait les afficher.
//
//  D'où une seule définition, partagée, et ces tests autour.
// =====================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { pubsDisponibles, themeNeuf } from "../src/core/canal.js";

const FICHIERS = [
  { nom: "garage.png", url: "/pubs/garage.png", video: false },
  { nom: "epicerie.mp4", url: "/pubs/epicerie.mp4", video: true }
];

test("un dossier choisi rend le bouton « Passer aux pubs » utilisable", () => {
  const pubs = { ...themeNeuf().pubs, fichiers: FICHIERS };
  assert.equal(pubsDisponibles(pubs).length, 2, "le dossier doit compter");
});

test("le dossier l'emporte sur les vieilles images téléversées", () => {
  const pubs = { ...themeNeuf().pubs, fichiers: FICHIERS, images: ["data:image/png;base64,AAA"] };
  const liste = pubsDisponibles(pubs);
  assert.equal(liste.length, 2);
  assert.equal(liste[0].nom, "garage.png", "on passe le dossier, pas l'ancienne image");
});

test("sans dossier, les images téléversées passent encore", () => {
  const pubs = { ...themeNeuf().pubs, images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"] };
  const liste = pubsDisponibles(pubs);
  assert.equal(liste.length, 2);
  assert.deepEqual(liste[0], { url: "data:image/png;base64,AAA", video: false, nom: "" });
});

test("une vidéo reste marquée comme vidéo — elle joue jusqu'au bout", () => {
  const liste = pubsDisponibles({ fichiers: FICHIERS });
  assert.equal(liste.find((p) => p.nom === "epicerie.mp4").video, true);
});

test("rien de chargé : aucune pub, et pas de plantage", () => {
  assert.deepEqual(pubsDisponibles(themeNeuf().pubs), []);
  assert.deepEqual(pubsDisponibles({}), []);
  assert.deepEqual(pubsDisponibles(null), []);
  assert.deepEqual(pubsDisponibles(undefined), []);
});

test("un dossier vidé revient aux images téléversées sans rien perdre", () => {
  // La station oublie son dossier : « fichiers » redevient vide, mais les
  // images d'avant sont toujours là. On ne veut pas d'écran noir en ondes.
  const pubs = { fichiers: [], images: ["data:image/png;base64,AAA"] };
  assert.equal(pubsDisponibles(pubs).length, 1);
});
