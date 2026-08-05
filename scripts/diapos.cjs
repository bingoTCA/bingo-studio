// =====================================================================
//  Les images du diaporama du site.
//
//  Même principe que `captures.cjs` : on ouvre les deux fenêtres pour de
//  vrai, on y pose une session de démonstration, et on photographie une
//  suite d'états — le jeu, la régie, la vérification, les gagnants qui se
//  partagent un lot, l'entracte.
//
//  En plus des PNG, on écrit un fichier `reperes.json` : pour chaque
//  image, la position exacte des zones à encadrer, relevée dans le DOM.
//  C'est `annoter.py` qui trace ensuite les cadres rouges. Relever les
//  rectangles plutôt que de les deviner, c'est ce qui fait qu'un cadre
//  reste juste même si la mise en page bouge.
//
//    npm run diapos
// =====================================================================

const { app, BrowserWindow, ipcMain } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { demarrer } = require("../src/server");

const RACINE = join(__dirname, "..");
// Les captures brutes restent HORS de `site/` : ce dossier est publié tel
// quel par GitHub Pages, et 12 Mo de PNG que personne ne demande n'ont
// rien à faire en ligne. Seuls les WebP finis y entrent, par `annoter.py`.
const SORTIE = join(RACINE, "captures/diapo");
const PORT = 7912;

// Une session qui a l'air d'un vrai dimanche après-midi.
const DEMO = {
  titre: "Le Bingo du Rocher-Percé",
  telephones: ["418 385-3909", "1 888 312-4646"],
  commanditaire: "Présenté par nos commanditaires",
  parties: [
    { nom: "Partie 1", figure: "LIGNE", lot: 100 },
    { nom: "Partie 2", figure: "X", lot: 200 },
    { nom: "Partie 3", figure: "TOUR", lot: 300 },
    { nom: "Jackpot", figure: "PLEINE", lot: 1000 }
  ],
  theme: {
    ambiance: "#0f4c47",
    accent: "#ffcf4d",
    marquage: "#d1332e",
    fondHaut: "#020a09", fondMilieu: "#06201d", fondBas: "#0d4741", fondAngle: 135,
    bandeau: {
      actif: true, source: "messages", vitesse: 90,
      messages: ["Merci à nos commanditaires", "Prochain bingo dimanche 12 h 30"]
    }
  },
  partieIndex: 2,
  tirage: [],                      // rempli plus bas, à partir de la carte 4321
  enOnde: true,
  ecran: "jeu",
  // Deux gagnants sur la MÊME figure : c'est le cas qui montre le partage.
  gagnants: [
    { partie: "Partie 2", figure: "X", carte: 88, nom: "Roger Bourque, Percé", lot: 200, heure: "12 h 58 min 12 s" },
    { partie: "Partie 3", figure: "TOUR", carte: 259, nom: "Jeannine Cyr, Grande-Rivière", lot: 300, heure: "13 h 12 min 04 s" },
    { partie: "Partie 3", figure: "TOUR", carte: 1477, nom: "Line Cloutier, Chandler", lot: 300, heure: "13 h 12 min 21 s" }
  ],
  rssTitres: [],
  horodatage: [],
  tic: 0
};

const CARTE_MONTREE = "4321";

/**
 * Le tirage est déduit de la carte qu'on va vérifier, et non l'inverse :
 * la diapositive doit montrer le moment qui compte — la carte est bonne.
 * On prend les 16 cases du tour, plus quelques numéros qui n'y sont pas,
 * pour que le tableau ne soit pas le décalque de la carte.
 */
function tirageQuiFaitGagnerLeTour(catalogue) {
  const g = catalogue[CARTE_MONTREE];
  if (!g) throw new Error(`carte ${CARTE_MONTREE} absente du catalogue`);
  // g[ligne][colonne] — le tour, c'est la première et la dernière ligne,
  // plus les deux bouts des lignes du milieu.
  const tour = [...g[0], ...g[4]];
  for (let l = 1; l <= 3; l++) tour.push(g[l][0], g[l][4]);

  const surLaCarte = new Set(g.flat());
  const leurres = [];
  for (let n = 1; n <= 75 && leurres.length < 6; n++) {
    if (!surLaCarte.has(n) && n % 7 === 5) leurres.push(n);
  }

  // On entremêle, et on finit par un numéro du tour : c'est lui qui
  // s'affiche en « dernier numéro » et qui déclenche l'appel.
  const dernier = tour.pop();
  const melange = [];
  const restant = [...tour];
  while (restant.length || leurres.length) {
    if (leurres.length) melange.push(leurres.shift());
    for (let k = 0; k < 3 && restant.length; k++) melange.push(restant.shift());
  }
  return [...melange, dernier];
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "document-user-activation-required");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const reperes = {};

/** Relève le rectangle de chaque sélecteur, en pixels de l'image capturée. */
async function releverZones(fenetre, zones) {
  const code = `
    (() => {
      const zones = ${JSON.stringify(zones)};
      const r = {};
      const f = window.devicePixelRatio || 1;
      for (const [nom, sel] of Object.entries(zones)) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) continue;
        r[nom] = [Math.round(b.left*f), Math.round(b.top*f), Math.round(b.width*f), Math.round(b.height*f)];
      }
      return r;
    })();
  `;
  return fenetre.webContents.executeJavaScript(code);
}

async function photographier(fenetre, nom, zones) {
  const image = await fenetre.webContents.capturePage();
  writeFileSync(join(SORTIE, nom), image.toPNG());
  if (zones) reperes[nom] = await releverZones(fenetre, zones);
  const { width, height } = image.getSize();
  const n = reperes[nom] ? Object.keys(reperes[nom]).length : 0;
  console.log(`  ${nom.padEnd(26)} ${width} × ${height}   ${n} zone(s)`);
}

// Les fenêtres appellent le processus principal dès leur démarrage. Sans
// ces réponses, la promesse est rejetée et la régie s'arrête AVANT d'avoir
// restauré la session : on photographiait alors un écran par défaut.
ipcMain.handle("adresse-antenne", () => `http://127.0.0.1:${PORT}/antenne`);
ipcMain.handle("ecrans", () => []);
ipcMain.handle("relire-dossier-pubs", () => ({ fichiers: [] }));

app.whenReady().then(async () => {
  mkdirSync(SORTIE, { recursive: true });
  const { serveur } = await demarrer(RACINE, PORT);

  const catalogue = JSON.parse(
    require("node:fs").readFileSync(join(RACINE, "data/cartes.json"), "utf8")
  );
  DEMO.tirage = tirageQuiFaitGagnerLeTour(catalogue);
  DEMO.tic = DEMO.tirage.length;
  console.log(`Tirage de démonstration : ${DEMO.tirage.length} boules, la carte ${CARTE_MONTREE} fait le tour.\n`);

  const regie = new BrowserWindow({
    width: 1600, height: 895, show: false,
    webPreferences: { preload: join(RACINE, "preload.js"), contextIsolation: true, offscreen: true }
  });
  await regie.loadURL(`http://127.0.0.1:${PORT}/regie`);
  // Laisser la régie FINIR de démarrer avant d'écrire. Sans cette pause,
  // elle enregistre sa session neuve par-dessus la nôtre et on photographie
  // un écran vide en croyant tenir la démonstration.
  await attendre(700);
  await regie.webContents.executeJavaScript(
    `localStorage.setItem("bingo-studio-session", ${JSON.stringify(JSON.stringify(DEMO))}); true;`
  );
  await regie.loadURL(`http://127.0.0.1:${PORT}/regie`);
  await attendre(800);

  // Garde-fou : si la session de démonstration n'a pas pris, tout le reste
  // photographie un écran vide sans qu'on s'en rende compte.
  const pris = await regie.webContents.executeJavaScript(
    `document.getElementById("compte-tires").textContent`
  );
  if (String(pris) !== String(DEMO.tirage.length)) {
    throw new Error(`session non restaurée : ${pris} numéros tirés au lieu de ${DEMO.tirage.length}`);
  }

  const antenne = new BrowserWindow({
    width: 1920, height: 1080, show: false,
    webPreferences: { preload: join(RACINE, "preload.js"), contextIsolation: true, offscreen: true }
  });
  await antenne.loadURL(`http://127.0.0.1:${PORT}/antenne`);
  await attendre(1400);

  console.log("Diaporama :");

  // --- 1. L'antenne pendant le jeu ------------------------------------
  await photographier(antenne, "1-antenne-jeu.png", {
    derniere: ".dn-affichage",
    tableau: "#tableau",
    figure: ".bloc-formes",
    camera: "#camera",
    telephones: "#telephones"
  });

  // --- 2. La régie, la carte au bout des doigts ------------------------
  // On tape le numéro AVANT de photographier : une régie au bloc de
  // vérification vide ne raconte rien.
  await regie.webContents.executeJavaScript(`
    (() => {
      const v = document.getElementById("verif-num");
      v.value = ${JSON.stringify(CARTE_MONTREE)};
      v.dispatchEvent(new Event("input", { bubbles: true }));
      const nom = document.getElementById("verif-nom");
      if (nom) { nom.value = "Céline Arsenault, Sainte-Thérèse-de-Gaspé";
                 nom.dispatchEvent(new Event("input", { bubbles: true })); }
      window.scrollTo(0, 0);
      return true;
    })();
  `);
  await attendre(500);
  await photographier(regie, "2-regie.png", {
    tableau: "#tableau",
    verdict: ".verif-zone",
    carte: "#verif-grille"
  });

  // --- 3. La vérification à l'antenne ---------------------------------
  await regie.webContents.executeJavaScript(
    `document.getElementById("btn-verification").click(); true;`
  );
  await attendre(1100);
  await photographier(antenne, "3-verification.png", {
    carte: "#verif-corps",
    numero: "#verif-numero",
    verdict: "#verif-verdict"
  });

  // --- 4. Les gagnants, lot partagé -----------------------------------
  await regie.webContents.executeJavaScript(
    `document.getElementById("btn-retour-antenne").click(); true;`
  );
  await attendre(900);
  await photographier(antenne, "4-gagnants.png", { gagnants: "#bloc-gagnants" });

  // --- 5. L'entracte --------------------------------------------------
  await regie.webContents.executeJavaScript(`
    (() => {
      document.getElementById("reb-minutes").value = "5";
      const p = document.getElementById("reb-pubs"); if (p) p.checked = false;
      document.getElementById("btn-rebours").click();
      return true;
    })();
  `);
  await attendre(1200);
  await photographier(antenne, "5-entracte.png", { rebours: "#rebours" });
  await regie.webContents.executeJavaScript(
    `document.getElementById("btn-rebours").click(); true;`
  );

  writeFileSync(join(SORTIE, "reperes.json"), JSON.stringify(reperes, null, 2));
  console.log(`\nDossier → ${SORTIE}`);

  serveur.close();
  app.exit(0);
}).catch((err) => {
  console.error("Échec des diapos :", err.message, err.stack);
  app.exit(1);
});
