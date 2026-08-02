// =====================================================================
//  Rendu HTML → PDF, par Electron.
//
//  Electron est déjà une dépendance du projet : produire le PDF avec lui
//  évite d'ajouter une bibliothèque PDF, et garantit que le résultat est
//  exactement ce que la mise en page affiche.
//
//    electron scripts/pdf.cjs <entree.html> <sortie.pdf> <largeurMm> <hauteurMm>
// =====================================================================

const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");

const [entree, sortie, largeurMm, hauteurMm] = process.argv.slice(2);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const fenetre = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await fenetre.loadURL(pathToFileURL(entree).href);
    // ⚠️ Depuis Electron 21, printToPDF attend un pageSize en POUCES.
    // Les anciennes versions prenaient des microns : passer 215900 donnait
    // une page de 215 900 pouces, illisible pour un imprimeur.
    const pdf = await fenetre.webContents.printToPDF({
      pageSize: { width: Number(largeurMm) / 25.4, height: Number(hauteurMm) / 25.4 },
      margins: { marginType: "none" },
      printBackground: true
    });
    writeFileSync(sortie, pdf);
    app.exit(0);
  } catch (err) {
    console.error("Rendu PDF impossible :", err.message);
    app.exit(1);
  }
});
