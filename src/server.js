// =====================================================================
//  Mini-serveur statique local (127.0.0.1) — le coeur de la portabilité.
//
//  Pourquoi un serveur plutôt que file:// : les deux fenêtres doivent
//  partager la MÊME origine pour se parler par BroadcastChannel, et les
//  modules ES ne se chargent pas depuis file://. Bonus : OBS, vMix et
//  Tricaster peuvent pointer une « source navigateur » sur
//  http://127.0.0.1:7777/antenne — l'intégration la plus propre.
//
//  N'écoute que sur la boucle locale : rien n'est exposé au réseau.
// =====================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2"
};

const ROUTES = {
  "/": "src/regie/regie.html",
  "/regie": "src/regie/regie.html",
  "/antenne": "src/antenne/antenne.html"
};

/**
 * Relais du flux RSS. Le navigateur refuserait d'aller chercher un flux
 * sur un autre domaine (CORS) : c'est donc le serveur local qui le fait,
 * et il ne renvoie que les titres.
 */
async function relayerRss(url, res) {
  const repondre = (code, charge) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(charge));
  };

  let cible;
  try { cible = new URL(url); } catch { return repondre(400, { erreur: "Adresse invalide" }); }
  if (cible.protocol !== "http:" && cible.protocol !== "https:") {
    return repondre(400, { erreur: "Seules les adresses http et https sont acceptées" });
  }

  try {
    const reponse = await fetch(cible, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Bingo Studio" }
    });
    if (!reponse.ok) return repondre(502, { erreur: `Le flux a répondu ${reponse.status}` });

    const texte = (await reponse.text()).slice(0, 1_000_000);

    const nettoyer = (brut) => brut
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    // On ne prend que les titres SITUÉS DANS un article : <item> en RSS,
    // <entry> en Atom. Ratisser tous les <title> du document ramènerait
    // aussi le nom du flux et celui de son logo (deux fois « Radio Gaspésie »).
    const titres = [];
    const articles = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let bloc;
    while ((bloc = articles.exec(texte)) !== null && titres.length < 40) {
      const titre = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(bloc[2]);
      if (titre) {
        const propre = nettoyer(titre[1]);
        if (propre) titres.push(propre);
      }
    }
    repondre(200, { titres });
  } catch (err) {
    repondre(502, { erreur: `Flux injoignable (${err.name === "TimeoutError" ? "délai dépassé" : err.message})` });
  }
}

function repondreFichier(racine, req, res) {
  let chemin, parametres;
  try {
    const adresse = new URL(req.url, "http://127.0.0.1");
    chemin = decodeURIComponent(adresse.pathname);
    parametres = adresse.searchParams;
  } catch {
    res.writeHead(400).end("Requête invalide");
    return;
  }

  if (chemin === "/api/rss") {
    relayerRss(parametres.get("url") ?? "", res);
    return;
  }

  const relatif = ROUTES[chemin] || chemin.replace(/^\/+/, "");
  const fichier = path.resolve(racine, relatif);

  // Garde-fou : interdit de sortir du dossier de l'application.
  if (!fichier.startsWith(path.resolve(racine) + path.sep)) {
    res.writeHead(403).end("Accès refusé");
    return;
  }

  fs.readFile(fichier, (err, contenu) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Introuvable : " + chemin);
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(fichier).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(contenu);
  });
}

/**
 * Démarre le serveur. Si le port souhaité est déjà pris — une copie restée
 * ouverte, un autre logiciel — on passe au suivant plutôt que de refuser de
 * démarrer. Personne ne doit avoir à chasser un processus avant une
 * diffusion. Le port réellement obtenu est renvoyé : c'est lui qui sert à
 * ouvrir les fenêtres et à donner l'adresse pour OBS.
 */
function demarrer(racine, portSouhaite = 7777, essais = 10) {
  return new Promise((resolve, reject) => {
    const tenter = (port, restants) => {
      const serveur = http.createServer((req, res) => repondreFichier(racine, req, res));

      serveur.on("error", (err) => {
        if (err.code === "EADDRINUSE" && restants > 0) {
          tenter(port + 1, restants - 1);
          return;
        }
        reject(err);
      });

      serveur.listen(port, "127.0.0.1", () => {
        resolve({ serveur, port, replie: port !== portSouhaite });
      });
    };
    tenter(portSouhaite, essais);
  });
}

module.exports = { demarrer };
