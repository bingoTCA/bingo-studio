// =====================================================================
//  Antenne — pur affichage. N'émet jamais rien, ne décide de rien.
//  Elle écoute la régie et redessine. Si elle plante, on la recharge :
//  l'état complet est renvoyé par la régie à la demande.
// =====================================================================

import { COLONNES, rangee, lettre, FIGURES } from "../core/bingo.js";
import { creerCanal, reclamerEtat, etatNeuf, fusionnerTheme, messagesDuBandeau } from "../core/canal.js";
import * as sons from "../core/sons.js";
import * as medias from "../core/medias.js";

const $ = (id) => document.getElementById(id);
const scene = document.getElementById("scene");

if (new URLSearchParams(location.search).get("fond") === "transparent") {
  document.body.classList.add("transparent");
}

// ---------------------------------------------------------------------
//  Tableau 1 à 75 — construit une seule fois
// ---------------------------------------------------------------------

const cases = new Map();

function construireTableau() {
  const tableau = $("tableau");
  for (const col of COLONNES) {
    const etiquette = document.createElement("div");
    etiquette.className = "tableau-lettre";
    etiquette.textContent = col;
    tableau.appendChild(etiquette);

    for (const n of rangee(col)) {
      const c = document.createElement("div");
      c.className = "tableau-case";
      c.textContent = n;
      cases.set(n, c);
      tableau.appendChild(c);
    }
  }
}

// ---------------------------------------------------------------------
//  Horloge — heure du Québec, quelle que soit la machine
// ---------------------------------------------------------------------

const fmtDate = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long"
});
const fmtHeure = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

function majHorloge() {
  const maintenant = new Date();
  const date = fmtDate.format(maintenant);
  // formatToParts, pas un split : en fr-CA l'heure se formate déjà « 13 h 48 »,
  // sans deux-points — découper sur « : » donnait « 13 h 48 h undefined ».
  const p = Object.fromEntries(fmtHeure.formatToParts(maintenant).map((x) => [x.type, x.value]));
  $("horloge").textContent =
    `${date.charAt(0).toUpperCase()}${date.slice(1)} — ${p.hour} h ${p.minute}`;
}

// ---------------------------------------------------------------------
//  Habillage (Paramètres de la régie)
// ---------------------------------------------------------------------

function appliquerTheme(theme) {
  const t = fusionnerTheme(theme);
  const s = document.documentElement.style;

  // Les trois couleurs réglables. Toutes les autres teintes de la feuille
  // de style s'en déduisent par color-mix — rien d'autre à poser ici.
  s.setProperty("--ambiance", t.ambiance);
  s.setProperty("--accent", t.accent);
  s.setProperty("--marquage", t.marquage);

  s.setProperty("--fond-haut", t.fondHaut);
  s.setProperty("--fond-milieu", t.fondMilieu);
  s.setProperty("--fond-bas", t.fondBas);
  s.setProperty("--fond-angle", `${t.fondAngle}deg`);
  s.setProperty("--chroma", t.chroma);

  scene.classList.toggle("sans-halo", !t.halo);
  scene.classList.toggle("sans-texture", !t.texture);

  $("horloge").hidden = !t.dateHeure;

  // Pubs OU caméra : jamais les deux. Les pubs prennent exactement la place
  // du carré d'incrustation, mêmes dimensions.
  const pubs = t.pubs.actif && listeDesPubs(t.pubs).length > 0;
  $("camera").hidden = pubs || !t.chromaVisible;
  $("pubs").hidden = !pubs;
  majPubs(t.pubs, pubs);

  const logo = $("logo");
  if (t.logo) { logo.src = t.logo; logo.hidden = false; }
  else { logo.removeAttribute("src"); logo.hidden = true; }

  const genLogo = $("gen-logo");
  if (t.logo) { genLogo.src = t.logo; genLogo.hidden = false; }
  else { genLogo.removeAttribute("src"); genLogo.hidden = true; }

  majFondMedia(t.fondMedia);

  sons.reglerVolumes({ effets: t.sons.volumeEffets, musique: t.sons.volumeMusique });
  return t;
}

// ---------------------------------------------------------------------
//  Fond image ou vidéo
// ---------------------------------------------------------------------

let signatureFond = "";
let urlFond = null;

const FOND_LIVRE = "/assets/fond-defaut.jpg";

async function majFondMedia(reglages) {
  const fiche = reglages.video ?? reglages.image ?? null;
  // Aucun média déposé : on retombe sur le fond livré avec le logiciel,
  // sauf si la station l'a explicitement retiré.
  const livre = !fiche && reglages.livre !== false;

  // Signature : on ne relit le fichier que s'il change réellement. Sans ça,
  // chaque boule tirée relancerait la vidéo depuis le début.
  const signature = fiche ? `${fiche.cle}|${reglages.opacite}`
                  : livre ? `livre|${reglages.opacite}` : "";
  if (signature === signatureFond) return;
  signatureFond = signature;

  const boite = $("fond-media"), img = $("fond-image"), video = $("fond-video");
  medias.libererUrl(urlFond);
  urlFond = null;
  img.hidden = true; video.hidden = true;
  video.removeAttribute("src");
  img.removeAttribute("src");

  if (livre) {
    img.src = FOND_LIVRE;
    img.hidden = false;
    boite.style.opacity = String(reglages.opacite);
    boite.hidden = false;
    return;
  }

  if (!fiche) { boite.hidden = true; return; }

  urlFond = await medias.urlDe(fiche.cle);
  if (!urlFond) { boite.hidden = true; return; }

  boite.style.opacity = String(reglages.opacite);
  boite.hidden = false;

  if (reglages.video) {
    video.src = urlFond;
    video.hidden = false;
    video.play().catch(() => {});
  } else {
    img.src = urlFond;
    img.hidden = false;
  }
}

// ---------------------------------------------------------------------
//  Musique des génériques
// ---------------------------------------------------------------------

let urlMusique = null;
let musiqueEnCours = false;

async function majMusiqueGenerique(t, etat) {
  const audio = $("musique-generique");
  const enGenerique = etat.ecran === "debut" || etat.ecran === "fin";
  const voulue = enGenerique && etat.enOnde !== false && t.generique.musiques.length > 0;

  if (!voulue) {
    if (musiqueEnCours) {
      audio.pause();
      medias.libererUrl(urlMusique);
      urlMusique = null;
      musiqueEnCours = false;
    }
    return;
  }
  if (musiqueEnCours) { audio.volume = t.generique.volumeMusique; return; }

  // Une piste au hasard parmi celles déposées, en boucle.
  const liste = t.generique.musiques;
  const choisie = liste[Math.floor(Math.random() * liste.length)];
  urlMusique = await medias.urlDe(choisie.cle);
  if (!urlMusique) return;
  audio.src = urlMusique;
  audio.volume = t.generique.volumeMusique;
  audio.play().catch(() => {});
  musiqueEnCours = true;
}

// ---------------------------------------------------------------------
//  Pubs — rotation en boucle à la place du chroma
// ---------------------------------------------------------------------

let minuteriePubs = null;
let signaturePubs = "";
let couchePubActive = 0;

/**
 * La liste à passer en boucle. Un dossier choisi par la station l'emporte
 * sur les images téléversées une à une : c'est le mode qu'on encourage, et
 * une station qui vient de choisir un dossier ne veut plus voir les vieilles.
 */
function listeDesPubs(reglages) {
  if (reglages.fichiers?.length) return reglages.fichiers;
  return (reglages.images ?? []).map((url) => ({ url, video: false, nom: "" }));
}

/**
 * Rotation des publicités, à la place du carré d'incrustation.
 *
 * Les IMAGES tiennent le nombre de secondes réglé. Les VIDÉOS jouent jusqu'au
 * bout puis passent à la suivante — couper une pub vidéo au milieu, c'est
 * fâcher le commanditaire qui l'a payée. La boucle tourne tant qu'on n'a pas
 * repris l'antenne.
 */
function majPubs(reglages, actives) {
  const liste = actives ? listeDesPubs(reglages) : [];

  // Signature : on ne relance la rotation que si le contenu ou le délai
  // changent. Sinon chaque boule tirée ferait repartir le diaporama.
  const signature = liste.length
    ? `${reglages.secondes}|${liste.map((f) => f.url).join("|")}`
    : "";
  if (signature === signaturePubs) return;
  signaturePubs = signature;

  clearTimeout(minuteriePubs);
  minuteriePubs = null;

  const a = $("pub-a"), b = $("pub-b"), video = $("pub-video");
  const toutCacher = () => {
    a.classList.remove("visible");
    b.classList.remove("visible");
    video.classList.remove("visible");
  };
  video.onended = null;
  try { video.pause(); } catch { /* pas encore chargée */ }

  if (!liste.length) { toutCacher(); video.removeAttribute("src"); return; }

  let index = 0;
  couchePubActive = 0;

  const passer = () => {
    const fiche = liste[index];

    if (fiche.video) {
      a.classList.remove("visible");
      b.classList.remove("visible");
      video.src = fiche.url;
      video.classList.add("visible");
      // Le son suit le réglage : celui des vidéos, ou rien si la station a
      // choisi sa propre musique — deux sources en même temps, c'est illisible.
      video.muted = reglages.son !== "videos";
      video.currentTime = 0;
      video.play().catch(() => {});
      // Une seule vidéo dans le dossier : on la reboucle plutôt que de
      // laisser un écran figé sur sa dernière image.
      video.onended = () => { if (liste.length === 1) { video.currentTime = 0; video.play().catch(() => {}); } else suivante(); };
      // Filet : si la vidéo est illisible, on ne reste pas coincé dessus.
      video.onerror = () => { if (liste.length > 1) suivante(); };
      return;
    }

    video.classList.remove("visible");
    try { video.pause(); } catch { /* rien en cours */ }
    const entrante = couchePubActive === 0 ? a : b;
    const sortante = couchePubActive === 0 ? b : a;
    entrante.src = fiche.url;
    entrante.classList.add("visible");
    sortante.classList.remove("visible");
    couchePubActive = 1 - couchePubActive;

    if (liste.length < 2) return;   // une seule image : elle reste
    minuteriePubs = setTimeout(suivante, Math.max(1, Number(reglages.secondes) || 8) * 1000);
  };

  const suivante = () => {
    clearTimeout(minuteriePubs);
    index = (index + 1) % liste.length;
    passer();
  };

  passer();
}

// ---------------------------------------------------------------------
//  Pictogramme d'une figure
// ---------------------------------------------------------------------

function picto(idFigure) {
  const f = FIGURES[idFigure];
  // Pour une figure « au choix », on montre la première variante en exemple.
  const actives = new Set((f?.cases ?? f?.variantes?.[0] ?? []).map(([r, c]) => `${r},${c}`));
  const boite = document.createElement("div");
  boite.className = "f-picto";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const el = document.createElement("i");
      if (actives.has(`${r},${c}`)) el.className = "on";
      boite.appendChild(el);
    }
  }
  return boite;
}

// ---------------------------------------------------------------------
//  Blocs
// ---------------------------------------------------------------------

function dessinerFormes(etat) {
  const liste = $("liste-formes");
  liste.innerHTML = "";
  let total = 0;

  etat.parties.forEach((p, i) => {
    total += Number(p.lot) || 0;
    const li = document.createElement("li");
    if (i === etat.partieIndex) li.className = "en-cours";
    else if (i < etat.partieIndex) li.className = "faite";

    li.appendChild(picto(p.figure));

    // Nom au-dessus, montant en dessous : le montant ne peut jamais
    // chevaucher un nom de figure qui passe sur deux lignes.
    const texte = document.createElement("div");
    texte.className = "f-texte";

    const nom = document.createElement("span");
    nom.className = "f-nom";
    nom.textContent = FIGURES[p.figure]?.nom ?? p.figure;

    const lot = document.createElement("span");
    lot.className = "f-lot";
    lot.textContent = p.lot ? `${Number(p.lot).toLocaleString("fr-CA")} $` : "—";

    texte.append(nom, lot);
    li.appendChild(texte);
    liste.appendChild(li);
  });

  $("formes-total-val").textContent = total ? `${total.toLocaleString("fr-CA")} $` : "—";
}

const COMBINE_TELEPHONE = "M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.05 15.05 0 0 1-6.59-6.58l2.2-2.21a1 1 0 0 0 .25-1.02A11.36 11.36 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1z";

function dessinerTelephones(numeros) {
  const boite = $("telephones");
  const liste = (numeros ?? []).map((n) => String(n).trim()).filter(Boolean);
  boite.innerHTML = "";
  boite.hidden = liste.length === 0;
  if (!liste.length) return;

  for (const numero of liste) {
    const el = document.createElement("div");
    el.className = "tel";
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">`
      + `<path d="${COMBINE_TELEPHONE}"/></svg><span></span>`;
    el.querySelector("span").textContent = numero;
    boite.appendChild(el);
  }
}

function dessinerGagnants(gagnants) {
  const liste = $("liste-gagnants");
  liste.innerHTML = "";
  if (!gagnants?.length) {
    liste.innerHTML = '<li class="liste-vide">— en attente —</li>';
    liste.className = "liste-gagnants";
    return;
  }

  const parts = partsDeLot(gagnants);

  // La liste doit tenir tout le bingo dans un bloc de hauteur fixe. Plutôt
  // que de rogner les derniers noms, on resserre l'affichage par paliers :
  // mieux vaut lire dix noms un peu petits que six gros et quatre invisibles.
  const n = gagnants.length;
  const serrage = n <= 4 ? "" : n <= 7 ? " serre-1" : n <= 11 ? " serre-2" : " serre-3";
  liste.className = "liste-gagnants" + serrage;

  // Les plus récents en haut : c'est celui qu'on vient d'annoncer qu'on cherche.
  for (const g of [...gagnants].reverse()) {
    const li = document.createElement("li");
    const part = parts.get(g);

    const nom = document.createElement("span");
    nom.className = "g-nom";
    nom.textContent = g.nom?.trim() || `Carte ${g.carte}`;

    const detail = document.createElement("span");
    detail.className = "g-detail";
    detail.textContent = (g.nom?.trim() ? `Carte ${g.carte} · ` : "")
      + (FIGURES[g.figure]?.nom ?? g.figure)
      + (part.montant ? ` · ${arrondiSou(part.montant)} $` : "")
      + (part.nombre > 1 ? ` · partagé à ${part.nombre}` : "");

    li.append(nom, detail);
    liste.appendChild(li);
  }
}

/**
 * Le lot d'une partie se divise entre tous ses gagnants, et se recalcule à
 * chaque ajout : le premier annoncé voit sa part diminuer quand un deuxième
 * appelle. C'est la règle habituelle du bingo, et elle est écrite dans le
 * règlement livré par défaut.
 */
function partsDeLot(gagnants) {
  const parPartie = new Map();
  for (const g of gagnants) {
    const cle = `${g.partie}|${g.figure}`;
    if (!parPartie.has(cle)) parPartie.set(cle, []);
    parPartie.get(cle).push(g);
  }
  const parts = new Map();
  for (const groupe of parPartie.values()) {
    // On prend le lot le plus élevé du groupe : si l'opératrice a corrigé le
    // montant en cours de partie, c'est le bon qui fait foi.
    const lot = Math.max(...groupe.map((g) => Number(g.lot) || 0));
    for (const g of groupe) parts.set(g, { montant: lot / groupe.length, nombre: groupe.length });
  }
  return parts;
}

/** 33,33 $ plutôt que 33,333333 — et 100 $ reste 100 $, pas 100,00 $. */
function arrondiSou(montant) {
  const arrondi = Math.round(montant * 100) / 100;
  return Number.isInteger(arrondi)
    ? arrondi.toLocaleString("fr-CA")
    : arrondi.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Le bloc de vérification, au centre, à la place de l'incrustation caméra.
 * Il suit la saisie de la régie en direct : le numéro s'affiche pendant qu'on
 * le tape, puis la carte apparaît dès qu'elle existe.
 */
function dessinerVerification(v, actif) {
  const boite = $("bloc-verification");
  boite.hidden = !actif;
  if (!actif) return;

  const corps = $("verif-corps");
  const verdict = $("verif-verdict");
  $("verif-numero").textContent = v?.numero != null && String(v.numero) !== "" ? v.numero : "————";

  // Rien de tapé encore, ou numéro incomplet : on le dit au lieu de laisser
  // un trou noir au milieu de l'écran.
  if (!v || v.statut === "INTROUVABLE") {
    corps.innerHTML = '<p class="verif-attente">En attente du numéro de carte…</p>';
    verdict.textContent = v?.statut === "INTROUVABLE" && v.numero
      ? `Aucune carte ${v.numero} dans la base`
      : "";
    verdict.className = "verif-verdict" + (v?.statut === "INTROUVABLE" && v.numero ? " introuvable" : "");
    return;
  }

  let grille = $("verif-grille");
  if (!grille) {
    corps.innerHTML = '<div id="verif-grille" class="carte-grille"></div>';
    grille = $("verif-grille");
  }
  grille.innerHTML = "";

  // Pas de surlignage de la figure à l'antenne : le téléspectateur suit
  // les numéros, pas la géométrie. On garde la lecture la plus simple.
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const num = v.grille[r][c];
      const libre = num === 0;
      const el = document.createElement("div");
      el.className = "carte-case" + (libre ? " libre" : v.marquees[r][c] ? " marquee" : "");
      el.textContent = libre ? "★" : num;
      grille.appendChild(el);
    }
  }

  if (v.statut === "GAGNANTE") {
    verdict.textContent = "★  CARTE GAGNANTE  ★";
    verdict.className = "verif-verdict gagnante";
  } else {
    verdict.textContent = v.restants === 1 ? "Il reste 1 case" : `Il reste ${v.restants} cases`;
    verdict.className = "verif-verdict pas-encore";
  }
}

// ---------------------------------------------------------------------
//  Musiques choisies : rebours et publicités
//
//  Elles viennent du magasin de médias, pas des pistes livrées : une station
//  choisit sa musique, on ne la tire pas au sort. Entrée et sortie en fondu —
//  une musique qui démarre à plein volume fait sursauter.
// ---------------------------------------------------------------------

function fondreVers(audio, cible, ms, aLaFin) {
  const depart = audio.volume;
  const debut = Date.now();
  clearInterval(audio.__fondu);
  audio.__fondu = setInterval(() => {
    const k = Math.min(1, (Date.now() - debut) / ms);
    try { audio.volume = Math.max(0, Math.min(1, depart + (cible - depart) * k)); }
    catch { clearInterval(audio.__fondu); return; }
    if (k >= 1) { clearInterval(audio.__fondu); aLaFin?.(); }
  }, 50);
}

/** Un lecteur par usage : le rebours et les pubs ne se marchent pas dessus. */
function lecteurChoisi(nom) {
  let audio = null, cle = null, url = null;
  return {
    async regler(fiche, volume) {
      const voulue = fiche?.cle ?? null;
      if (voulue === cle) {
        if (audio && voulue) fondreVers(audio, volume, 400);
        return;
      }
      cle = voulue;

      if (audio) {
        const partante = audio;
        const urlPartante = url;
        audio = null; url = null;
        fondreVers(partante, 0, 900, () => {
          try { partante.pause(); } catch { /* déjà arrêtée */ }
          medias.libererUrl(urlPartante);
        });
      }
      if (!voulue) return;

      url = await medias.urlDe(voulue);
      if (!url) { cle = null; return; }
      audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0;
      audio.play().catch(() => {});
      fondreVers(audio, volume, 1200);
    }
  };
}

const musiqueRebours = lecteurChoisi("rebours");
const musiquePubs = lecteurChoisi("pubs");

// ---------------------------------------------------------------------
//  Compte à rebours d'entracte
//
//  L'antenne ne reçoit qu'une HEURE DE FIN et recalcule le reste toutes les
//  secondes. Deux avantages : la régie n'a pas à envoyer un message par
//  seconde, et un rechargement en pleine pause retrouve le bon temps au lieu
//  de repartir de zéro.
// ---------------------------------------------------------------------

let minuterieRebours = null;
let dernierEtat = null;

function secondesRestantes(rebours) {
  if (!rebours?.finLe) return null;
  return Math.max(0, Math.ceil((rebours.finLe - Date.now()) / 1000));
}

function enMinutesSecondes(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function majRebours(t, etat) {
  const boite = $("rebours");
  const reste = secondesRestantes(etat.rebours);
  const actif = reste !== null && reste > 0 && etat.enOnde !== false;

  boite.hidden = !actif || etat.rebours?.enGros === false;
  if (!actif) {
    clearInterval(minuterieRebours);
    minuterieRebours = null;
    return;
  }

  // ⚠️ On relit dernierEtat à chaque battement, jamais l'`etat` capturé au
  // moment où la minuterie a été créée. Sinon un entracte modifié en cours de
  // route — durée changée, pubs décochées — continuerait d'afficher l'ancien
  // décompte : la minuterie n'est créée qu'une fois et garderait à jamais la
  // première version de l'état.
  const dessiner = () => {
    const courant = dernierEtat ?? etat;
    const s = secondesRestantes(courant.rebours);
    if (s === null) return;
    $("rebours-temps").textContent = enMinutesSecondes(s);

    // Option C : en pastille tant que les pubs tournent, en grand dans la
    // DERNIÈRE MINUTE. Sans pubs, il est en grand tout du long — il n'y a
    // rien d'autre à regarder.
    const avecPubs = courant.rebours.avecPubs && listeDesPubs(t.pubs).length > 0;
    boite.classList.toggle("grand", !avecPubs || s <= 60);
    boite.classList.toggle("presse", s <= 10);

    if (s <= 0) {
      clearInterval(minuterieRebours);
      minuterieRebours = null;
      // C'est la régie qui décide de la suite : elle seule tient l'état.
      // L'antenne se contente de ne plus rien afficher.
      boite.hidden = true;
    }
  };

  dessiner();
  if (!minuterieRebours) minuterieRebours = setInterval(dessiner, 250);
}

// ---------------------------------------------------------------------
//  Bandeau défilant
// ---------------------------------------------------------------------

let signatureBandeau = "";

function majBandeau(t, etat) {
  const messages = messagesDuBandeau(t, etat);
  const actif = messages.length > 0;
  $("defilant").hidden = !actif;

  // On ne reconstruit que si le contenu change : sinon le défilement
  // repartirait de zéro à chaque boule tirée.
  const signature = actif ? `${t.bandeau.source}|${t.bandeau.vitesse}|${messages.join("¦")}` : "";
  if (signature === signatureBandeau) return;
  signatureBandeau = signature;
  if (!actif) return;

  const piste = $("defilant-piste");
  piste.innerHTML = "";
  // Deux passages : la fin du texte est encore visible quand le début
  // revient, donc pas de trou blanc dans le défilement.
  for (let passage = 0; passage < 2; passage++) {
    for (const m of messages) {
      const el = document.createElement("span");
      el.className = "defilant-item";
      el.textContent = m;
      piste.appendChild(el);
    }
  }
  piste.style.animationDuration = `${Math.max(10, Number(t.bandeau.vitesse) || 90)}s`;
}

// ---------------------------------------------------------------------
//  Générique de début et de fin
// ---------------------------------------------------------------------

let signatureGenerique = "";

function majGenerique(t, etat) {
  const ecran = etat.ecran === "debut" || etat.ecran === "fin" ? etat.ecran : null;
  $("generique").hidden = !ecran;
  if (!ecran) { signatureGenerique = ""; return; }

  const gagnants = etat.gagnants ?? [];
  const signature = `${ecran}|${t.generique.texteDebut}|${t.generique.texteFin}|${t.generique.vitesse}`
    + `|${t.generique.reglementActif ? t.generique.reglement : ""}`
    + `|${etat.parties.map((p) => `${p.figure}:${p.lot}`).join(",")}|${gagnants.length}`;
  if (signature === signatureGenerique) return;
  signatureGenerique = signature;

  $("gen-titre").textContent = etat.titre || "";
  const piste = $("gen-piste");
  piste.innerHTML = "";

  // On monte le générique dans un bloc, puis on en met DEUX copies dans la
  // piste : l'animation ne remonte que de 50 %, donc au moment de boucler la
  // seconde copie est déjà en place et la reprise ne se voit pas.
  const bloc = document.createElement("div");

  // Cale de la hauteur de l'écran : le texte entre par le bas, et elle
  // sépare la fin d'une copie du début de la suivante.
  const cale = document.createElement("div");
  cale.className = "gen-cale";
  bloc.appendChild(cale);

  const section = (titre) => {
    const el = document.createElement("p");
    el.className = "gen-section";
    el.textContent = titre;
    bloc.appendChild(el);
  };
  const ligne = (texte) => {
    const el = document.createElement("p");
    el.className = "gen-ligne";
    el.textContent = texte;
    bloc.appendChild(el);
  };
  const etoiles = () => {
    const el = document.createElement("p");
    el.className = "gen-etoiles";
    el.textContent = "★ ★ ★";
    bloc.appendChild(el);
  };

  etoiles();
  ligne(ecran === "debut" ? t.generique.texteDebut : t.generique.texteFin);

  if (ecran === "debut") {
    section("Prix à gagner");
    for (const p of etat.parties) {
      const lot = Number(p.lot) || 0;
      ligne(`${FIGURES[p.figure]?.nom ?? p.figure}${lot ? ` — ${lot.toLocaleString("fr-CA")} $` : ""}`);
    }
    if (t.generique.reglementActif && t.generique.reglement?.trim()) {
      section("Règlement");
      for (const paragraphe of t.generique.reglement.split(/\n\s*\n/)) {
        const el = document.createElement("p");
        el.className = "gen-reglement";
        el.textContent = paragraphe.trim();
        if (el.textContent) bloc.appendChild(el);
      }
    }
  } else {
    section("Gagnants du jour");
    if (!gagnants.length) ligne("— aucun gagnant consigné —");
    for (const g of gagnants) {
      const lot = Number(g.lot) || 0;
      ligne(`Carte ${g.carte} — ${FIGURES[g.figure]?.nom ?? g.figure}${lot ? ` — ${lot.toLocaleString("fr-CA")} $` : ""}`);
    }
  }

  if (etat.commanditaire) { section("Merci à"); ligne(etat.commanditaire); }
  const tels = (etat.telephones ?? []).filter(Boolean);
  if (tels.length) { section("Pour nous joindre"); for (const n of tels) ligne(n); }
  etoiles();

  piste.appendChild(bloc);
  piste.appendChild(bloc.cloneNode(true));

  piste.style.animationDuration = `${Math.max(15, Number(t.generique.vitesse) || 60)}s`;
}

// ---------------------------------------------------------------------
//  Sons
// ---------------------------------------------------------------------

let dernierTic = null;
let annonceEnCours = false;

function majSons(t, etat) {
  const coupe = etat.enOnde === false;

  if (coupe) {
    sons.toutCouper();
    dernierTic = etat.tic;
    annonceEnCours = false;
    return;
  }

  // Ding : `tic` change à chaque boule envoyée. Au tout premier rendu on
  // se contente de mémoriser la valeur — sinon l'antenne dingue en
  // s'ouvrant sur une partie déjà commencée.
  if (dernierTic === null) dernierTic = etat.tic;
  else if (etat.tic !== dernierTic) {
    dernierTic = etat.tic;
    if (t.sons.ding) sons.ding();
  }

  const annonce = Boolean(etat.annonce?.texte);
  if (annonce && !annonceEnCours && t.sons.fanfare) sons.fanfare();
  annonceEnCours = annonce;

  // La musique d'attente prime sur le fond sonore : pendant une
  // vérification, c'est elle qui doit s'entendre.
  const attente = etat.modeVerification === true && etat.ecran === "jeu";
  if (attente !== sons.attenteEnCours()) sons.musiqueAttente(attente, t.sons.volumeMusique);

  const musiqueVoulue = t.sons.musique && etat.ecran === "jeu" && !attente;
  if (musiqueVoulue && !sons.musiqueEnCours()) sons.demarrerMusique();
  if (!musiqueVoulue && sons.musiqueEnCours() && !attente) sons.arreterMusique();
}

// ---------------------------------------------------------------------
//  Rendu principal
// ---------------------------------------------------------------------

function rendre(etat) {
  const t = appliquerTheme(etat.theme);

  const partie = etat.parties[etat.partieIndex] ?? { nom: "—", figure: "PLEINE", lot: 0 };
  const f = FIGURES[partie.figure];

  $("titre").textContent = etat.titre || "";
  $("pause-titre").textContent = etat.titre || "";
  $("partie-nom").textContent = partie.nom || "";
  $("figure-aide").textContent = f ? `${f.nom} — ${f.aide}` : "";

  dessinerTelephones(etat.telephones);
  $("commanditaire").textContent = etat.commanditaire || "";

  dessinerFormes(etat);
  dessinerGagnants(etat.gagnants);

  // Tableau
  const sortis = new Set(etat.tirage);
  const dernier = etat.tirage.length ? etat.tirage[etat.tirage.length - 1] : null;
  for (const [n, el] of cases) {
    el.classList.toggle("sorti", sortis.has(n) && n !== dernier);
    el.classList.toggle("dernier", n === dernier);
  }

  // Dernier numéro
  $("dn-lettre").textContent = dernier === null ? "—" : lettre(dernier);
  $("dn-numero").textContent = dernier === null ? "—" : dernier;
  $("dn-compte").textContent = etat.tirage.length;
  $("dn-restants").textContent = 75 - etat.tirage.length;

  majBandeau(t, etat);
  majGenerique(t, etat);
  majSons(t, etat);
  majMusiqueGenerique(t, etat);

  // Superpositions — antenne coupée : plus rien ne passe, carte comprise.
  const coupe = etat.enOnde === false;
  $("pause").hidden = !coupe;
  if (coupe) $("generique").hidden = true;

  if (!coupe && etat.annonce?.texte) {
    $("annonce-texte").textContent = etat.annonce.texte;
    $("annonce").hidden = false;
  } else {
    $("annonce").hidden = true;
  }
  // Vérification : elle prend la place de l'incrustation caméra, jamais en
  // plus. Antenne coupée, on ne montre rien.
  const enVerification = !coupe && etat.modeVerification === true;
  dessinerVerification(etat.verification, enVerification);
  if (enVerification) { $("camera").hidden = true; $("pubs").hidden = true; }

  // Entracte. Sans pubs cochées, on cache aussi l'incrustation : l'écran
  // bleu derrière un compte à rebours n'a aucun sens.
  dernierEtat = etat;
  majRebours(t, etat);

  // Musique du rebours : seulement pendant l'entracte, et seulement si la
  // station en a choisi une.
  const enEntracte = !coupe && secondesRestantes(etat.rebours) > 0;
  musiqueRebours.regler(enEntracte ? t.compteur?.musique : null, t.compteur?.volume ?? 0.55);

  // Musique des pubs : seulement quand elles passent ET que la station a
  // choisi « ma musique ». Jamais en même temps que celle du rebours.
  const pubsAuson = !coupe && !enEntracte && t.pubs.actif
    && t.pubs.son === "musique" && listeDesPubs(t.pubs).length > 0;
  musiquePubs.regler(pubsAuson ? t.pubs.musique : null, t.sons.volumeMusique * 2);
  const enRebours = !coupe && !enVerification && secondesRestantes(etat.rebours) > 0;
  if (enRebours && !etat.rebours.avecPubs) $("camera").hidden = true;
}

// ---------------------------------------------------------------------

construireTableau();
majHorloge();
setInterval(majHorloge, 5000);
rendre(etatNeuf());

const canal = creerCanal();
canal.onmessage = (e) => {
  if (e.data?.type === "etat") rendre(e.data.etat);
};
// La régie tourne peut-être déjà : on réclame l'état courant au démarrage.
reclamerEtat(canal);
