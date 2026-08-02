// =====================================================================
//  Pont Electron — volontairement minuscule.
//
//  Tout ce qui touche au JEU passe par BroadcastChannel (voir
//  src/core/canal.js) et fonctionne donc aussi bien dans un navigateur.
//  Ici on n'expose QUE ce qu'un navigateur ne sait pas faire : connaître
//  les écrans branchés et y envoyer la fenêtre antenne en plein écran.
// =====================================================================

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  presente: true,
  ecrans: () => ipcRenderer.invoke("ecrans"),
  antenneVersEcran: (id) => ipcRenderer.invoke("antenne-vers-ecran", id),
  antenneEnFenetre: () => ipcRenderer.invoke("antenne-fenetre"),
  adresseAntenne: () => ipcRenderer.invoke("adresse-antenne"),
  ouvrirDansNavigateur: (url) => ipcRenderer.invoke("ouvrir-dans-navigateur", url),
  feuillesEnPdf: (charge) => ipcRenderer.invoke("feuilles-en-pdf", charge)
});
