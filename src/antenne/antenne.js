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
  const pubs = t.pubs.actif && t.pubs.images.length > 0;
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

async function majFondMedia(reglages) {
  const fiche = reglages.video ?? reglages.image ?? null;
  // Signature : on ne relit le fichier que s'il change réellement. Sans ça,
  // chaque boule tirée relancerait la vidéo depuis le début.
  const signature = fiche ? `${fiche.cle}|${reglages.opacite}` : "";
  if (signature === signatureFond) return;
  signatureFond = signature;

  const boite = $("fond-media"), img = $("fond-image"), video = $("fond-video");
  medias.libererUrl(urlFond);
  urlFond = null;
  img.hidden = true; video.hidden = true;
  video.removeAttribute("src");
  img.removeAttribute("src");

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

function majPubs(reglages, actives) {
  // Signature : on ne relance la rotation que si les images ou le délai
  // changent. Sinon chaque boule tirée ferait repartir le diaporama.
  const signature = actives
    ? `${reglages.secondes}|${reglages.images.length}|${reglages.images.map((i) => i.length).join(",")}`
    : "";
  if (signature === signaturePubs) return;
  signaturePubs = signature;

  clearInterval(minuteriePubs);
  minuteriePubs = null;
  const a = $("pub-a"), b = $("pub-b");
  if (!actives) { a.classList.remove("visible"); b.classList.remove("visible"); return; }

  const images = reglages.images;
  let index = 0;
  couchePubActive = 0;
  a.src = images[0];
  a.classList.add("visible");
  b.classList.remove("visible");

  // Une seule image : elle reste affichée, sans minuterie.
  if (images.length < 2) return;

  const delai = Math.max(1, Number(reglages.secondes) || 8) * 1000;
  minuteriePubs = setInterval(() => {
    index = (index + 1) % images.length;
    const entrante = couchePubActive === 0 ? b : a;
    const sortante = couchePubActive === 0 ? a : b;
    entrante.src = images[index];
    entrante.classList.add("visible");
    sortante.classList.remove("visible");
    couchePubActive = 1 - couchePubActive;
  }, delai);
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
    return;
  }
  // Les plus récents en haut, au cas où la liste dépasse le bloc.
  for (const g of [...gagnants].reverse()) {
    const li = document.createElement("li");
    const lot = Number(g.lot) || 0;

    const nom = document.createElement("span");
    nom.className = "g-nom";
    nom.textContent = g.nom?.trim() || `Carte ${g.carte}`;

    const detail = document.createElement("span");
    detail.className = "g-detail";
    detail.textContent = (g.nom?.trim() ? `Carte ${g.carte} · ` : "")
      + (FIGURES[g.figure]?.nom ?? g.figure)
      + (lot ? ` · ${lot.toLocaleString("fr-CA")} $` : "");

    li.append(nom, detail);
    liste.appendChild(li);
  }
}

function dessinerCarte(v) {
  const boite = $("bloc-carte");
  if (!v || v.statut === "INTROUVABLE") { boite.hidden = true; return; }

  $("carte-num").textContent = v.numero;
  const grille = $("carte-grille");
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

  const verdict = $("carte-verdict");
  if (v.statut === "GAGNANTE") {
    verdict.textContent = "Carte gagnante";
    verdict.className = "carte-verdict gagnante";
  } else {
    verdict.textContent = v.restants === 1 ? "Il reste 1 case" : `Il reste ${v.restants} cases`;
    verdict.className = "carte-verdict pas-encore";
  }
  boite.hidden = false;
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

  // Cale de la hauteur de l'écran : le texte entre par le bas.
  const cale = document.createElement("div");
  cale.className = "gen-cale";
  piste.appendChild(cale);

  const section = (titre) => {
    const el = document.createElement("p");
    el.className = "gen-section";
    el.textContent = titre;
    piste.appendChild(el);
  };
  const ligne = (texte) => {
    const el = document.createElement("p");
    el.className = "gen-ligne";
    el.textContent = texte;
    piste.appendChild(el);
  };
  const etoiles = () => {
    const el = document.createElement("p");
    el.className = "gen-etoiles";
    el.textContent = "★ ★ ★";
    piste.appendChild(el);
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
      for (const bloc of t.generique.reglement.split(/\n\s*\n/)) {
        const el = document.createElement("p");
        el.className = "gen-reglement";
        el.textContent = bloc.trim();
        if (el.textContent) piste.appendChild(el);
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

  const musiqueVoulue = t.sons.musique && etat.ecran === "jeu";
  if (musiqueVoulue && !sons.musiqueEnCours()) sons.demarrerMusique();
  if (!musiqueVoulue && sons.musiqueEnCours()) sons.arreterMusique();
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
  dessinerCarte(coupe ? null : etat.verification);
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
