// =====================================================================
//  Bingo Studio — processus principal Electron.
//
//  Deux fenêtres :
//    RÉGIE   — l'écran de l'opérateur (saisie du boulier, vérification)
//    ANTENNE — ce qui part au mélangeur / à la recopie d'écran
//
//  L'antenne peut être envoyée en plein écran sur n'importe quel écran
//  branché. Sans Electron (mode navigateur), on ouvre simplement les
//  deux adresses et on place les fenêtres à la main.
// =====================================================================

const { app, BrowserWindow, screen, ipcMain, shell, dialog } = require("electron");
const { writeFileSync, unlinkSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("path");
const { demarrer } = require("./src/server");

// L'antenne joue des sons sans que personne ne clique dedans — elle est
// posée sur un écran de diffusion. Sans ça, Chromium refuserait de lire.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const PORT_SOUHAITE = 7777;
let port = PORT_SOUHAITE;      // port réellement obtenu (voir src/server.js)
let fenetreRegie = null;
let fenetreAntenne = null;
let serveur = null;

function creerRegie() {
  fenetreRegie = new BrowserWindow({
    width: 1180,
    height: 880,
    minWidth: 940,
    minHeight: 700,
    title: "Bingo Studio — Régie",
    backgroundColor: "#14140f",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true }
  });
  fenetreRegie.loadURL(`http://127.0.0.1:${port}/regie`);
  fenetreRegie.on("closed", () => { fenetreRegie = null; app.quit(); });
}

function creerAntenne() {
  fenetreAntenne = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "Bingo Studio — Antenne",
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true }
  });
  fenetreAntenne.loadURL(`http://127.0.0.1:${port}/antenne`);

  // On empêche la fermeture accidentelle en ondes : la fenêtre se cache.
  fenetreAntenne.on("close", (e) => {
    if (!app.enFermeture) { e.preventDefault(); fenetreAntenne.hide(); }
  });
}

// ---------------------------------------------------------------------
//  Ponts avec les fenêtres
// ---------------------------------------------------------------------

ipcMain.handle("ecrans", () => {
  const principal = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((e, i) => ({
    id: e.id,
    nom: e.label || `Écran ${i + 1}`,
    largeur: e.size.width,
    hauteur: e.size.height,
    principal: e.id === principal
  }));
});

ipcMain.handle("antenne-vers-ecran", (_e, idEcran) => {
  if (!fenetreAntenne) return false;
  const cible = screen.getAllDisplays().find((d) => d.id === idEcran);
  if (!cible) return false;

  fenetreAntenne.setFullScreen(false);
  fenetreAntenne.setBounds(cible.bounds);
  fenetreAntenne.show();
  // Le passage en plein écran doit suivre le déplacement, pas le précéder.
  setTimeout(() => fenetreAntenne.setFullScreen(true), 120);
  return true;
});

ipcMain.handle("antenne-fenetre", () => {
  if (!fenetreAntenne) return false;
  fenetreAntenne.setFullScreen(false);
  fenetreAntenne.show();
  fenetreAntenne.focus();
  return true;
});

ipcMain.handle("adresse-antenne", () => `http://127.0.0.1:${port}/antenne`);

/**
 * Produire les feuilles de cartes pour l'imprimeur, sans passer par la boîte
 * d'impression du navigateur : les marges et le format sont exactement ceux
 * de la mise en page. En deux temps.
 *
 * Étape 1 — où enregistrer. Séparée du rendu exprès : la régie doit pouvoir
 * afficher sa jauge APRÈS que l'opératrice a choisi le fichier, et pas
 * pendant qu'une boîte système attend sa réponse.
 */
ipcMain.handle("choisir-fichier-pdf", async (_e, { nomSuggere }) => {
  const cible = await dialog.showSaveDialog(fenetreRegie, {
    title: "Enregistrer les feuilles",
    defaultPath: nomSuggere || "feuilles-bingo.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (cible.canceled || !cible.filePath) return { annule: true };
  return { chemin: cible.filePath };
});

/**
 * Étape 2 — le rendu lui-même, qui peut durer plusieurs minutes.
 *
 * ⚠️ Le document passe par un FICHIER TEMPORAIRE, jamais par une adresse
 * `data:`. Chromium refuse les adresses data: au-delà de quelques mégaoctets
 * (ERR_INVALID_URL) : au-dessus d'environ 200 feuilles, le rendu échouait —
 * et c'est justement pour les gros lots qu'on en a besoin.
 */
ipcMain.handle("rendre-feuilles-pdf", async (_e, { html, largeurMm, hauteurMm, chemin }) => {
  if (!chemin) return { erreur: "aucun fichier de destination" };

  const provisoire = path.join(app.getPath("temp"), `bingo-feuilles-${process.pid}.html`);
  const rendu = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    writeFileSync(provisoire, html, "utf8");
    await rendu.loadURL(pathToFileURL(provisoire).href);
    // ⚠️ Depuis Electron 21, pageSize attend des POUCES, pas des microns.
    const pdf = await rendu.webContents.printToPDF({
      pageSize: { width: largeurMm / 25.4, height: hauteurMm / 25.4 },
      margins: { marginType: "none" },
      printBackground: true
    });
    writeFileSync(chemin, pdf);
    return { chemin, octets: pdf.length };
  } catch (err) {
    return { erreur: err.message };
  } finally {
    rendu.destroy();
    try { unlinkSync(provisoire); } catch { /* déjà parti */ }
  }
});

/**
 * Enregistre un fichier texte là où l'opératrice le demande. Sans ça, un
 * téléchargement Electron atterrit en silence dans le dossier par défaut —
 * et un fichier de réglages qu'on ne retrouve pas ne sert à rien.
 */
ipcMain.handle("enregistrer-fichier", async (_e, { texte, nomSuggere, titre, extension }) => {
  const cible = await dialog.showSaveDialog(fenetreRegie, {
    title: titre || "Enregistrer",
    defaultPath: nomSuggere || "fichier.txt",
    filters: [{ name: (extension || "txt").toUpperCase(), extensions: [extension || "txt"] }]
  });
  if (cible.canceled || !cible.filePath) return { annule: true };
  try {
    writeFileSync(cible.filePath, texte, "utf8");
    return { chemin: cible.filePath };
  } catch (err) {
    return { erreur: err.message };
  }
});

ipcMain.handle("ouvrir-dans-navigateur", (_e, url) => {
  if (typeof url === "string" && url.startsWith(`http://127.0.0.1:${port}/`)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------

// Une seule copie à la fois. Deux copies ouvertes, c'est la PREMIÈRE cause de
// port occupé — et un port différent, ce sont des réglages qui semblent
// disparus (voir plus bas). Une deuxième ouverture ramène donc la fenêtre
// existante au lieu de démarrer un rival.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (fenetreRegie) {
      if (fenetreRegie.isMinimized()) fenetreRegie.restore();
      fenetreRegie.focus();
    }
  });
}

app.whenReady().then(async () => {
  let replie = false;
  try {
    ({ serveur, port, replie } = await demarrer(__dirname, PORT_SOUHAITE));
  } catch (err) {
    dialog.showErrorBox(
      "Démarrage impossible",
      `Aucun port libre entre ${PORT_SOUHAITE} et ${PORT_SOUHAITE + 10} sur cet ordinateur.\n\n` +
      `Ferme les autres copies de Bingo Studio, puis relance.\n\n(${err.message})`
    );
    app.quit();
    return;
  }

  creerRegie();
  creerAntenne();

  if (replie) {
    // ⚠️ Ce n'est PAS un détail technique. Le navigateur range les réglages,
    // les médias et les parties sous l'adresse complète, port compris :
    // http://127.0.0.1:7777 et http://127.0.0.1:7778 sont deux rangements
    // séparés. Sur un autre port, l'opératrice retrouve un logiciel vierge et
    // croit tout avoir perdu. Il faut donc le lui dire, en clair, tout de
    // suite — et lui dire aussi que rien n'est perdu.
    dialog.showMessageBox(fenetreRegie, {
      type: "warning",
      title: "Bingo Studio a dû changer de port",
      message: `Le port ${PORT_SOUHAITE} était déjà occupé. Bingo Studio tourne sur ${port}.`,
      detail:
        `Deux conséquences :\n\n` +
        `1. Tes réglages, tes parties et tes médias vont sembler VIDES. ` +
        `Ils ne sont pas perdus : ils sont rangés sous le port ${PORT_SOUHAITE}. ` +
        `Ferme ce qui occupe ce port — souvent une autre copie de Bingo Studio — ` +
        `puis relance, et tout revient.\n\n` +
        `2. L'adresse à mettre dans OBS ou Tricaster devient ` +
        `http://127.0.0.1:${port}/antenne`,
      buttons: ["J'ai compris"]
    }).catch(() => { /* la boîte n'est pas indispensable au démarrage */ });
  }
});

app.on("before-quit", () => {
  app.enFermeture = true;
  if (serveur) serveur.close();
});

app.on("window-all-closed", () => app.quit());
