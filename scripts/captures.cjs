// =====================================================================
//  Captures d'écran de la régie et de l'antenne, pour le site.
//
//  On ouvre les deux fenêtres comme le fait l'application, on y injecte
//  une session de démonstration, puis on photographie. Les deux fenêtres
//  vivent dans le même processus : BroadcastChannel les relie, exactement
//  comme en vrai.
//
//    npm run captures
// =====================================================================

const { app, BrowserWindow } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { demarrer } = require("../src/server");

const RACINE = join(__dirname, "..");
const SORTIE = join(RACINE, "site/images");
const PORT = 7911;                       // port dédié, pour ne pas gêner l'app

// Session de démonstration — de quoi montrer un écran vivant.
const DEMO = {
  titre: "Bingo communautaire",
  telephone: "418 555-0143",
  commanditaire: "Présenté par nos commanditaires",
  parties: [
    { nom: "Partie 1", figure: "LIGNE", lot: 100 },
    { nom: "Partie 2", figure: "X", lot: 200 },
    { nom: "Partie 3", figure: "TOUR", lot: 300 },
    { nom: "Jackpot", figure: "PLEINE", lot: 1000 }
  ],
  // Ambiance volontairement différente du violet livré : les captures du
  // site montrent ainsi que les couleurs se règlent.
  theme: {
    ambiance: "#0f4c47",
    accent: "#ffcf4d",
    marquage: "#d1332e",
    fondHaut: "#020a09", fondMilieu: "#06201d", fondBas: "#0d4741", fondAngle: 135,
    bandeau: { actif: true, source: "messages", vitesse: 90,
      messages: ["Merci à nos commanditaires", "Prochain bingo dimanche 12 h 30"] }
  },
  partieIndex: 1,
  tirage: [12, 27, 44, 51, 68, 3, 33, 59, 17, 40, 71, 25, 8, 55, 62],
  enOnde: true,
  ecran: "jeu",
  gagnants: [
    { partie: "Partie 1", figure: "LIGNE", carte: 259, nom: "Jeannine Cyr, Grande-Rivière", lot: 100, heure: "12 h 41 min 08 s" }
  ],
  rssTitres: [],
  horodatage: [],
  tic: 15
};

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "document-user-activation-required");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function photographier(fenetre, nom) {
  const image = await fenetre.webContents.capturePage();
  const chemin = join(SORTIE, nom);
  writeFileSync(chemin, image.toPNG());
  const { width, height } = image.getSize();
  console.log(`  ${nom.padEnd(22)} ${width} × ${height}`);
}

app.whenReady().then(async () => {
  mkdirSync(SORTIE, { recursive: true });
  const { serveur } = await demarrer(RACINE, PORT);

  // La régie : c'est elle qui détient l'état et le diffuse.
  const regie = new BrowserWindow({
    width: 1600, height: 895, show: false,
    webPreferences: { preload: join(RACINE, "preload.js"), contextIsolation: true, offscreen: true }
  });
  await regie.loadURL(`http://127.0.0.1:${PORT}/regie`);

  // On installe la session de démonstration, puis on recharge pour que la
  // régie la restaure et la diffuse.
  await regie.webContents.executeJavaScript(
    `localStorage.setItem("bingo-studio-session", ${JSON.stringify(JSON.stringify(DEMO))}); true;`
  );
  await regie.loadURL(`http://127.0.0.1:${PORT}/regie`);
  await attendre(700);

  // Une carte vérifiée à l'écran, pour montrer la fonction phare.
  await regie.webContents.executeJavaScript(`
    (() => {
      const v = document.getElementById("verif-num");
      v.value = "4321";
      v.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("btn-montrer").click();
      window.scrollTo(0, 0);
      return true;
    })();
  `);

  // L'antenne : même origine, donc elle reçoit l'état par BroadcastChannel.
  const antenne = new BrowserWindow({
    width: 1920, height: 1080, show: false,
    webPreferences: { preload: join(RACINE, "preload.js"), contextIsolation: true, offscreen: true }
  });
  await antenne.loadURL(`http://127.0.0.1:${PORT}/antenne`);
  await attendre(1200);

  console.log("Captures :");
  await photographier(antenne, "antenne.png");
  await photographier(regie, "regie.png");

  // Troisième vue : le panneau d'impression des cartes, dans les
  // Paramètres. C'est la seule fonction qui ne se voit sur aucun des
  // deux écrans précédents.
  const impression = new BrowserWindow({
    width: 1200, height: 428, show: false,
    webPreferences: { preload: join(RACINE, "preload.js"), contextIsolation: true, offscreen: true }
  });
  await impression.loadURL(`http://127.0.0.1:${PORT}/regie`);
  await attendre(900);
  await impression.webContents.executeJavaScript(`
    (() => {
      document.getElementById("btn-reglages").click();
      const titre = document.getElementById("titre-impression");
      // On cherche l'ancêtre qui défile réellement : selon la hauteur de la
      // fenêtre, ce peut être .param-corps ou le document lui-même.
      let boite = titre.parentElement;
      while (boite && boite.scrollHeight <= boite.clientHeight) boite = boite.parentElement;
      const cible = boite || document.scrollingElement;
      const ecart = titre.getBoundingClientRect().top - cible.getBoundingClientRect().top;
      cible.scrollTop += ecart - 18;   // 18 px d'air au-dessus du titre
      return { conteneur: cible.className || cible.tagName, position: Math.round(cible.scrollTop) };
    })();
  `).then((r) => console.log(`  (défilement : ${r.conteneur} → ${r.position} px)`));
  await attendre(400);
  await photographier(impression, "impression.png");

  console.log(`\nDossier → ${SORTIE}`);

  serveur.close();
  app.exit(0);
}).catch((err) => {
  console.error("Échec des captures :", err.message);
  app.exit(1);
});
