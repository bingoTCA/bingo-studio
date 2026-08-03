// =====================================================================
//  Régie — seule source de vérité de la session.
//
//  Principe de conception : rien ne part à l'antenne sans une frappe
//  volontaire. On tape le numéro, on le VOIT (« G 54 »), puis Entrée.
//  Une faute de frappe ne peut jamais atteindre le téléviseur.
// =====================================================================

import {
  lettre, COLONNES, rangee, FIGURES, ORDRE_FIGURES,
  verifierCarte, validerSaisie, restantsDansBoulier
} from "../core/bingo.js";
import {
  creerCanal, diffuser, etatNeuf, themeNeuf, sauvegarder, restaurer,
  messagesDuBandeau
} from "../core/canal.js";
import * as sons from "../core/sons.js";
import * as medias from "../core/medias.js";
import { monterHtml, DISPOSITIONS, FORMATS } from "../core/feuilles.js";
import {
  monterDossier, lireDossier, appliquerReglages, clesMedias, nomDeFichier
} from "../core/reglages.js";

const $ = (id) => document.getElementById(id);
const canal = creerCanal();

let etat = restaurer() ?? etatNeuf();
let catalogue = {};
let verification = null;   // dernier résultat de vérification (non diffusé tant qu'on ne le montre pas)

// ---------------------------------------------------------------------
//  Cycle : on modifie l'état, puis on pousse partout.
// ---------------------------------------------------------------------

// Son de confirmation propre à cette machine : il dit à l'opératrice que
// la frappe est passée. Indépendant du son qui part à l'antenne, et
// enregistré à part puisqu'il dépend du poste, pas de la session.
const CLE_SON_REGIE = "bingo-studio-son-regie";
let sonRegie = localStorage.getItem(CLE_SON_REGIE) !== "non";

function pousser() {
  if (!sauvegarder(etat)) {
    dire("Sauvegarde impossible — stockage plein. Retire des images de pub.", "erreur");
  }
  diffuser(canal, etat);
  rendre();
}

// L'antenne réclame l'état quand elle (re)démarre.
canal.onmessage = (e) => {
  if (e.data?.type === "reclame") diffuser(canal, etat);
};

function partieCourante() {
  return etat.parties[etat.partieIndex] ?? { nom: "—", figure: "PLEINE", lot: 0 };
}

/** L'habillage de l'antenne — jamais absent, même sur une session ancienne. */
function theme() {
  if (!etat.theme) etat.theme = themeNeuf();
  return etat.theme;
}

function heureQuebec() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(new Date());
}

// ---------------------------------------------------------------------
//  Confirmation — remplace le confirm() du navigateur
// ---------------------------------------------------------------------

let confirmationEnCours = null;

/**
 * Demande confirmation et renvoie une promesse : true si l'opératrice
 * accepte. Le ton est léger, mais le message dit toujours exactement ce
 * qui va disparaître — c'est ça qui évite les accidents, pas la peur.
 */
function demander({ titre, texte, detail, oui, non }) {
  $("confirm-titre").textContent = titre;
  $("confirm-texte").innerHTML = texte;
  $("confirm-detail").textContent = detail ?? "";
  $("confirm-oui").textContent = oui ?? "Oui, vas-y";
  $("confirm-non").textContent = non ?? "Non, j'ai eu peur";
  $("confirmation").hidden = false;
  $("confirm-non").focus();

  return new Promise((resolve) => { confirmationEnCours = resolve; });
}

function repondreConfirmation(reponse) {
  $("confirmation").hidden = true;
  const resoudre = confirmationEnCours;
  confirmationEnCours = null;
  if (resoudre) resoudre(reponse);
}

// ---------------------------------------------------------------------
//  Messages à l'opérateur
// ---------------------------------------------------------------------

let minuterieMessage = null;

function dire(texte, genre = "") {
  const el = $("message");
  el.textContent = texte;
  el.className = "message " + genre;
  clearTimeout(minuterieMessage);
  if (texte) minuterieMessage = setTimeout(() => { el.textContent = ""; el.className = "message"; }, 4000);
}

// ---------------------------------------------------------------------
//  Saisie du boulier
// ---------------------------------------------------------------------

function majApercu() {
  const brut = $("saisie").value.trim();
  const n = Number(brut);
  const valide = brut !== "" && Number.isInteger(n) && n >= 1 && n <= 75;

  $("apercu-lettre").textContent = valide ? `${lettre(n)} ${n}` : "–";
  // L'aide passe en infobulle du champ : elle ne prend plus de hauteur.
  $("saisie").title = brut === ""
    ? "Tape le numéro puis Entrée, ou clique-le directement dans le tableau"
    : valide
      ? (etat.tirage.includes(n) ? "Déjà sorti — Entrée sera refusée" : "Appuie sur Entrée pour l'envoyer")
      : "Numéro de 1 à 75 seulement";

  // Le numéro préparé se surligne dans le tableau, sans être encore envoyé.
  for (const [num, el] of casesTableau) {
    el.classList.toggle("prepare", valide && num === n && !etat.tirage.includes(n));
  }
}

/**
 * Envoie un numéro à l'antenne. Renvoie false et affiche la raison si le
 * numéro est refusé (déjà sorti, hors de 1-75, vide).
 */
function envoyerNumero(valeur) {
  const resultat = validerSaisie(valeur, etat.tirage);
  if (!resultat.ok) { dire(resultat.message, "erreur"); return false; }

  etat.tirage.push(resultat.numero);
  etat.horodatage.push({ numero: resultat.numero, heure: heureQuebec() });
  etat.tic = (etat.tic ?? 0) + 1;      // fait sonner la clochette à l'antenne
  if (sonRegie) sons.ding();
  dire(`${resultat.lettre}-${resultat.numero} est à l'antenne.`, "ok");
  rafraichirVerification();
  pousser();
  return true;
}

function envoyer() {
  if (envoyerNumero($("saisie").value)) {
    $("saisie").value = "";
    majApercu();
  } else if (String($("saisie").value).trim() !== "") {
    $("saisie").select();
  }
}

function annulerDernier() {
  if (!etat.tirage.length) { dire("Aucun numéro à annuler.", "erreur"); return; }
  const n = etat.tirage.pop();
  etat.horodatage = etat.horodatage.filter((h) => h.numero !== n);
  dire(`${lettre(n)}-${n} retiré du tableau.`, "ok");
  rafraichirVerification();
  pousser();
}

function retirerNumero(n) {
  etat.tirage = etat.tirage.filter((x) => x !== n);
  etat.horodatage = etat.horodatage.filter((h) => h.numero !== n);
  dire(`${lettre(n)}-${n} retiré du tableau.`, "ok");
  rafraichirVerification();
  pousser();
}

// ---------------------------------------------------------------------
//  Vérification d'une carte
// ---------------------------------------------------------------------

function rafraichirVerification() {
  const brut = $("verif-num").value.trim();
  if (brut === "") {
    verification = null;
    dessinerVerification();
    // Champ vidé pendant une vérification : l'antenne doit se vider aussi,
    // sinon la carte précédente reste affichée devant tout le monde.
    if (etat.modeVerification) { etat.verification = null; pousserLeger(); }
    return;
  }
  verification = verifierCarte(catalogue, brut, etat.tirage, partieCourante().figure);
  dessinerVerification();

  // Pendant une vérification, l'antenne suit la frappe en direct : le
  // téléspectateur voit le numéro se composer, puis la carte apparaître.
  // C'est ce qui remplace la voix de l'animateur.
  if (etat.modeVerification) {
    etat.verification = verification;
    pousserLeger();
  } else if (etat.verification && etat.verification.numero === verification.numero) {
    // Hors vérification, on garde seulement à jour une carte déjà affichée.
    etat.verification = verification.statut === "INTROUVABLE" ? null : verification;
  }
}

// Le nombre de cartes se lit dans la base chargée, il n'est écrit nulle part
// en dur : quiconque génère sa propre base voit ses vrais chiffres.
function numerosCatalogue() {
  return Object.keys(catalogue).map(Number).sort((a, b) => a - b);
}
function descriptionCatalogue() {
  const n = Object.keys(catalogue).length;
  return n ? `Catalogue de ${n.toLocaleString("fr-CA")} cartes` : "Catalogue non chargé";
}
function bornesCatalogue() {
  const nums = numerosCatalogue();
  return nums.length ? `${nums[0]} à ${nums.at(-1)}` : "aucune carte";
}

function dessinerVerification() {
  const verdict = $("verif-verdict");
  const grille = $("verif-grille");
  grille.innerHTML = "";

  if (!verification) {
    verdict.textContent = descriptionCatalogue();
    verdict.className = "verdict";
    for (let i = 0; i < 25; i++) {
      const el = document.createElement("div");
      el.className = "carte-case vide";
      grille.appendChild(el);
    }
    return;
  }

  if (verification.statut === "INTROUVABLE") {
    verdict.textContent = `Carte ${verification.numero || "?"} inexistante (${bornesCatalogue()})`;
    verdict.className = "verdict introuvable";
    for (let i = 0; i < 25; i++) {
      const el = document.createElement("div");
      el.className = "carte-case vide";
      grille.appendChild(el);
    }
    return;
  }

  if (verification.statut === "GAGNANTE") {
    verdict.textContent = `GAGNANTE — ${FIGURES[partieCourante().figure]?.nom ?? ""}`;
    verdict.className = "verdict gagnante";
  } else {
    verdict.textContent = verification.restants === 1
      ? "Il reste 1 case"
      : `Il reste ${verification.restants} cases`;
    verdict.className = "verdict pas-encore";
  }

  const retenues = new Set(verification.cases.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const num = verification.grille[r][c];
      const libre = num === 0;
      const el = document.createElement("div");
      el.className = "carte-case"
        + (libre ? " libre" : verification.marquees[r][c] ? " marquee" : "")
        + (retenues.has(`${r},${c}`) ? " retenue" : "");
      el.textContent = libre ? "★" : num;
      grille.appendChild(el);
    }
  }
}

// ---------------------------------------------------------------------
//  Rendu de la régie
// ---------------------------------------------------------------------

function rendre() {
  $("entete-session").textContent = etat.titre || "";

  const pastille = $("pastille-onde");
  pastille.textContent = etat.enOnde ? "En ondes" : "Antenne coupée";
  pastille.className = "pastille " + (etat.enOnde ? "pastille-onde" : "pastille-coupe");
  $("btn-pause").textContent = etat.enOnde ? "Couper l'antenne" : "Remettre en ondes";

  $("compte-tires").textContent = etat.tirage.length;
  $("compte-restants").textContent = restantsDansBoulier(etat.tirage);

  // Journal, du plus récent au plus ancien
  const journal = $("journal");
  journal.innerHTML = "";
  if (!etat.tirage.length) {
    journal.innerHTML = '<p class="journal-vide">Aucun numéro tiré pour l\'instant.</p>';
  } else {
    [...etat.tirage].reverse().forEach((n, i) => {
      const b = document.createElement("button");
      b.className = "journal-item" + (i === 0 ? " dernier" : "");
      b.textContent = `${lettre(n)}-${n}`;
      b.title = `Retirer ${lettre(n)}-${n} du tableau`;
      b.onclick = () => retirerNumero(n);
      journal.appendChild(b);
    });
  }

  // Tableau : même code couleur qu'à l'antenne
  const sortis = new Set(etat.tirage);
  const dernier = etat.tirage.length ? etat.tirage[etat.tirage.length - 1] : null;
  const prepare = Number($("saisie").value);
  for (const [n, el] of casesTableau) {
    el.classList.toggle("sorti", sortis.has(n) && n !== dernier);
    el.classList.toggle("dernier", n === dernier);
    el.classList.toggle("prepare", n === prepare && !sortis.has(n));
  }

  // Parties
  const barre = $("partie-barre");
  barre.innerHTML = "";
  etat.parties.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "partie-puce" + (i === etat.partieIndex ? " active" : "");
    b.textContent = p.nom;
    b.onclick = () => { etat.partieIndex = i; rafraichirVerification(); pousser(); };
    barre.appendChild(b);
  });

  const partie = partieCourante();
  $("partie-figure").value = partie.figure;
  $("partie-lot").value = partie.lot ?? 0;

  // Paramètres
  $("reg-titre").value = etat.titre || "";
  dessinerTelephones();
  $("reg-commanditaire").value = etat.commanditaire || "";
  dessinerParametresTheme();
  dessinerReglagesParties();
  dessinerControles();
}

// ---------------------------------------------------------------------
//  Paramètres — habillage de l'antenne
// ---------------------------------------------------------------------

/**
 * Dit d'avance ce que le bandeau fera. Cocher « Afficher le bandeau » ne
 * suffit pas : sans message, l'antenne n'affiche rien du tout, et sans cette
 * ligne l'opératrice cherche pendant dix minutes ce qui cloche.
 */
function majEtatBandeau(t) {
  const ligne = $("reg-bandeau-etat");
  const messages = messagesDuBandeau(t, etat);

  if (!t.bandeau.actif) {
    ligne.textContent = "Le bandeau ne s'affiche pas.";
    ligne.classList.remove("aide-alerte");
    return;
  }
  if (messages.length) {
    const n = messages.length;
    const pluriel = n > 1 ? "s" : "";        // le nom
    const verbe = n > 1 ? "nt" : "";         // et le verbe, qui ne s'accorde pas pareil
    ligne.textContent = t.bandeau.source === "rss"
      ? `${n} titre${pluriel} du flux défile${verbe} à l'antenne.`
      : `${n} message${pluriel} défile${verbe} à l'antenne.`;
    ligne.classList.remove("aide-alerte");
    return;
  }
  ligne.textContent = t.bandeau.source === "rss"
    ? "Coché, mais aucun titre chargé — rien ne s'affiche à l'antenne. Colle l'adresse du flux, puis « Charger »."
    : "Coché, mais aucun message — rien ne s'affiche à l'antenne. Le texte gris ci-dessous n'est qu'un exemple : écris tes lignes par-dessus.";
  ligne.classList.add("aide-alerte");
}

function dessinerParametresTheme() {
  const t = theme();
  $("reg-dateheure").checked = t.dateHeure;
  $("reg-ambiance").value = t.ambiance;
  $("reg-accent").value = t.accent;
  $("reg-marquage").value = t.marquage;
  $("reg-fond-haut").value = t.fondHaut;
  $("reg-fond-milieu").value = t.fondMilieu;
  $("reg-fond-bas").value = t.fondBas;
  $("reg-fond-angle").value = t.fondAngle;
  $("reg-halo").checked = t.halo;
  $("reg-texture").checked = t.texture;
  $("reg-chroma").value = t.chroma;
  $("reg-chroma-visible").checked = t.chromaVisible;

  const img = $("reg-logo-img");
  if (t.logo) { img.src = t.logo; img.hidden = false; $("reg-logo-vide").hidden = true; }
  else { img.removeAttribute("src"); img.hidden = true; $("reg-logo-vide").hidden = false; }

  // Bandeau défilant
  $("reg-bandeau-actif").checked = t.bandeau.actif;
  $("reg-source-messages").checked = t.bandeau.source !== "rss";
  $("reg-source-rss").checked = t.bandeau.source === "rss";
  if (document.activeElement !== $("reg-bandeau-messages")) {
    $("reg-bandeau-messages").value = (t.bandeau.messages || []).join("\n");
  }
  if (document.activeElement !== $("reg-bandeau-rss")) $("reg-bandeau-rss").value = t.bandeau.rssUrl || "";
  $("reg-bandeau-vitesse").value = t.bandeau.vitesse;
  $("reg-bandeau-vitesse-val").textContent = t.bandeau.vitesse;
  majEtatBandeau(t);
  majResumeExport();   // le poids du fichier change dès qu'un média est déposé

  // Pubs
  $("reg-pubs-secondes").value = t.pubs.secondes;
  $("reg-pubs-secondes-val").textContent = t.pubs.secondes;
  dessinerListePubs();
  dessinerDossierPubs();

  // Sons
  $("reg-son-ding").checked = t.sons.ding;
  $("reg-son-fanfare").checked = t.sons.fanfare;
  $("reg-son-musique").checked = t.sons.musique;
  $("reg-vol-musique").value = Math.round(t.sons.volumeMusique * 100);
  $("reg-vol-musique-val").textContent = Math.round(t.sons.volumeMusique * 100);
  $("reg-vol-effets").value = Math.round(t.sons.volumeEffets * 100);
  $("reg-vol-effets-val").textContent = Math.round(t.sons.volumeEffets * 100);
  sons.reglerVolumes({ effets: t.sons.volumeEffets, musique: t.sons.volumeMusique });

  // Fond image ou vidéo
  $("reg-fond-image-nom").textContent = t.fondMedia.image
    ? `${t.fondMedia.image.nom} · ${medias.formaterTaille(t.fondMedia.image.taille)}` : "Aucune image";
  $("reg-fond-video-nom").textContent = t.fondMedia.video
    ? `${t.fondMedia.video.nom} · ${medias.formaterTaille(t.fondMedia.video.taille)}` : "Aucune vidéo";
  $("reg-fond-opacite").value = Math.round(t.fondMedia.opacite * 100);
  $("reg-fond-opacite-val").textContent = Math.round(t.fondMedia.opacite * 100);

  // Génériques
  $("reg-reglement-actif").checked = t.generique.reglementActif;
  if (document.activeElement !== $("reg-reglement")) $("reg-reglement").value = t.generique.reglement || "";
  $("reg-gen-volume").value = Math.round(t.generique.volumeMusique * 100);
  $("reg-gen-volume-val").textContent = Math.round(t.generique.volumeMusique * 100);
  dessinerMusiques();
  if (document.activeElement !== $("reg-gen-debut")) $("reg-gen-debut").value = t.generique.texteDebut || "";
  if (document.activeElement !== $("reg-gen-fin")) $("reg-gen-fin").value = t.generique.texteFin || "";
  $("reg-gen-vitesse").value = t.generique.vitesse;
  $("reg-gen-vitesse-val").textContent = t.generique.vitesse;

  majApercuFond();
}

function dessinerTelephones() {
  const boite = $("reg-telephones");
  boite.innerHTML = "";
  if (!Array.isArray(etat.telephones)) etat.telephones = [];

  if (!etat.telephones.length) {
    boite.innerHTML = '<p class="aide">Aucun numéro — le bloc reste masqué à l\'antenne.</p>';
    return;
  }

  etat.telephones.forEach((numero, i) => {
    const rang = document.createElement("div");
    rang.className = "reg-ligne-bouton";

    const champ = document.createElement("input");
    champ.type = "text"; champ.value = numero; champ.placeholder = "418 555-0143";
    champ.oninput = () => { etat.telephones[i] = champ.value; pousserLeger(); };

    const sup = document.createElement("button");
    sup.className = "reg-supprimer"; sup.textContent = "×";
    sup.title = "Retirer ce numéro";
    sup.onclick = () => { etat.telephones.splice(i, 1); pousser(); };

    rang.append(champ, sup);
    boite.appendChild(rang);
  });
}

function dessinerMusiques() {
  const boite = $("reg-musiques-liste");
  boite.innerHTML = "";
  const liste = theme().generique.musiques;
  if (!liste.length) {
    boite.innerHTML = '<p class="aide">Aucune musique — les génériques défileront en silence.</p>';
    return;
  }
  liste.forEach((piste, i) => {
    const rang = document.createElement("div");
    rang.className = "reg-ligne-bouton";

    const nom = document.createElement("span");
    nom.className = "reg-nom-fichier";
    nom.textContent = `${piste.nom} · ${medias.formaterTaille(piste.taille)}`;

    const sup = document.createElement("button");
    sup.className = "reg-supprimer"; sup.textContent = "×";
    sup.title = "Retirer cette musique";
    sup.onclick = async () => {
      await medias.retirer(piste.cle);
      theme().generique.musiques.splice(i, 1);
      dessinerParametresTheme();
      pousser();
    };

    rang.append(nom, sup);
    boite.appendChild(rang);
  });
}

/**
 * L'état du dossier de publicités : où il est, ce qu'il contient.
 * On affiche les noms de fichiers pour que la station vérifie d'un coup d'oeil
 * que le logiciel voit bien ce qu'elle vient d'y déposer.
 */
function dessinerDossierPubs() {
  const p = theme().pubs;
  const ligne = $("reg-pubs-dossier");
  const liste = $("reg-pubs-fichiers-liste");
  liste.innerHTML = "";

  const dansElectron = Boolean(window.studio?.presente);
  for (const id of ["btn-pubs-dossier", "btn-pubs-relire", "btn-pubs-oublier"]) {
    $(id).disabled = !dansElectron;
  }
  if (!dansElectron) {
    ligne.textContent = "Le choix d'un dossier n'existe que dans l'application installée.";
    return;
  }

  if (!p.dossier) {
    ligne.textContent = "Aucun dossier choisi.";
    ligne.classList.remove("aide-alerte");
    return;
  }

  const n = p.fichiers?.length ?? 0;
  ligne.textContent = `${p.dossier} — ${n} fichier${n > 1 ? "s" : ""}.`;
  // Un dossier vide n'est pas une erreur, mais il faut le dire : sinon
  // « Passer aux pubs » ne fera rien et personne ne saura pourquoi.
  ligne.classList.toggle("aide-alerte", n === 0);
  if (!n) { ligne.textContent += " Rien à passer — dépose des images ou des vidéos dedans, puis « Relire »."; return; }

  for (const f of p.fichiers) {
    const el = document.createElement("div");
    el.className = "reg-nom-fichier";
    el.textContent = (f.video ? "🎬 " : "🖼 ") + f.nom;
    liste.appendChild(el);
  }
}

async function choisirDossierPubs() {
  const r = await window.studio.choisirDossierPubs();
  if (r?.annule) return;
  if (r?.erreur) { dire(`Dossier illisible : ${r.erreur}`, "erreur"); return; }
  theme().pubs.dossier = r.dossier;
  theme().pubs.fichiers = r.fichiers;
  dessinerDossierPubs();
  dire(`${r.fichiers.length} fichier(s) trouvé(s) dans le dossier.`, r.fichiers.length ? "ok" : "erreur");
  pousser();
}

async function relireDossierPubs(silencieux = false) {
  const dossier = theme().pubs.dossier;
  if (!dossier) { if (!silencieux) dire("Aucun dossier choisi.", "erreur"); return; }
  const r = await window.studio.relireDossierPubs(dossier);
  if (r?.erreur) {
    // Le dossier a pu être déplacé, renommé, ou vivre sur une clé USB retirée.
    if (!silencieux) dire(`Dossier introuvable : ${r.erreur}`, "erreur");
    return;
  }
  theme().pubs.fichiers = r.fichiers;
  dessinerDossierPubs();
  if (!silencieux) dire(`${r.fichiers.length} fichier(s) dans le dossier.`, "ok");
  pousser();
}

function dessinerListePubs() {
  const boite = $("reg-pubs-liste");
  boite.innerHTML = "";
  const images = theme().pubs.images;
  if (!images.length) {
    boite.innerHTML = '<p class="reg-pubs-vide">Aucune image. Une seule image reste affichée en fixe.</p>';
    return;
  }
  images.forEach((src, i) => {
    const cadre = document.createElement("div");
    cadre.className = "reg-pub";
    const img = document.createElement("img");
    img.src = src; img.alt = `Pub ${i + 1}`;
    const sup = document.createElement("button");
    sup.textContent = "×"; sup.title = `Retirer l'image ${i + 1}`;
    sup.onclick = () => {
      theme().pubs.images.splice(i, 1);
      if (!theme().pubs.images.length) theme().pubs.actif = false;
      dessinerParametresTheme();
      pousser();
    };
    cadre.append(img, sup);
    boite.appendChild(cadre);
  });
}

/**
 * Assombrit une couleur vers le noir. `part` = proportion de noir.
 * Sert à déduire les trois teintes du fond de la couleur d'ambiance.
 */
function melangerVersNoir(hex, part) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const canal = (decalage) => {
    const v = (n >> decalage) & 0xff;
    return Math.round(v * (1 - part)).toString(16).padStart(2, "0");
  };
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

function majApercuFond() {
  const t = theme();
  $("reg-angle-val").textContent = t.fondAngle;
  $("reg-fond-apercu").style.background =
    `linear-gradient(${t.fondAngle}deg, ${t.fondHaut} 0%, ${t.fondMilieu} 50%, ${t.fondBas} 100%)`;
}

/**
 * Réduit une image avant de l'enregistrer. Une photo de 4000 px stockée en
 * base64 ferait exploser la sauvegarde locale (limite ~5 Mo).
 *   - logo : PNG, pour garder la transparence
 *   - pub  : JPEG, dix fois plus léger — on peut en mettre plusieurs
 */
function reduireImage(fichier, maxL, maxH, format = "image/png") {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("lecture impossible"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image illisible"));
      img.onload = () => {
        const facteur = Math.min(1, maxL / img.width, maxH / img.height);
        const l = Math.max(1, Math.round(img.width * facteur));
        const h = Math.max(1, Math.round(img.height * facteur));
        const toile = document.createElement("canvas");
        toile.width = l; toile.height = h;
        const ctx = toile.getContext("2d");
        // Le JPEG ne gère pas la transparence : fond noir, comme à l'antenne.
        if (format === "image/jpeg") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, l, h); }
        ctx.drawImage(img, 0, 0, l, h);
        resolve(format === "image/jpeg" ? toile.toDataURL(format, 0.82) : toile.toDataURL(format));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

// ---------------------------------------------------------------------
//  Contrôles antenne — les gestes qu'on fait en direct
// ---------------------------------------------------------------------

function dessinerControles() {
  const t = theme();
  const pubsPretes = t.pubs.images.length > 0;

  $("btn-gen-debut").classList.toggle("actif", etat.ecran === "debut");
  $("btn-gen-fin").classList.toggle("actif", etat.ecran === "fin");
  $("btn-pubs").classList.toggle("actif", t.pubs.actif);
  $("btn-pubs").textContent = t.pubs.actif ? "Revenir à la caméra" : "Passer aux pubs";
  $("btn-musique").classList.toggle("actif", t.sons.musique);
  $("btn-son-regie").classList.toggle("actif", sonRegie);

  const quoi = etat.ecran === "debut" ? "Le générique de début tourne."
    : etat.ecran === "fin" ? "Le générique de fin tourne."
    : t.pubs.actif ? `Les pubs sont à l'antenne (${t.pubs.images.length} image${t.pubs.images.length > 1 ? "s" : ""}).`
    : "Le jeu est à l'antenne.";
  $("etat-antenne").textContent = pubsPretes ? quoi : quoi + " Aucune image de pub chargée.";
}

/**
 * Ouvre le panneau des Paramètres et amène l'écran dessus. Sans ce
 * défilement, le panneau s'ouvre tout en bas d'une page longue et on croit
 * que le bouton ne fait rien.
 */
/**
 * Ouvre la page Paramètres, qui couvre entièrement la régie.
 * `ancre` amène directement à une section (ex. les publicités).
 */
function ouvrirParametres(ancre) {
  $("bloc-reglages").hidden = false;
  $("btn-reglages").classList.add("actif");

  // Défilement immédiat et sans animation. Deux pièges évités ici :
  //   - « smooth » est ignoré dès que « réduire les animations » est actif
  //     sur le poste, et la section visée resterait hors de l'écran ;
  //   - requestAnimationFrame ne se déclenche pas si la fenêtre est en
  //     arrière-plan, donc le défilement n'aurait jamais lieu.
  const corps = document.querySelector(".param-corps");
  if (ancre) $(ancre).scrollIntoView({ block: "start" });
  else corps.scrollTop = 0;
}

function fermerParametres() {
  $("bloc-reglages").hidden = true;
  $("btn-reglages").classList.remove("actif");
}

// ---------------------------------------------------------------------
//  Impression des cartes
// ---------------------------------------------------------------------

let manifesteCartes = { droits: "" };

function optionsImpression() {
  const nums = numerosCatalogue();
  return {
    parFeuille: Number($("imp-par-feuille").value) || 3,
    format: $("imp-format").value || "Letter",
    de: Number($("imp-de").value) || nums[0],
    a: Number($("imp-a").value) || nums.at(-1),
    couleur: $("imp-couleur").value,
    graine: "feuilles",
    droits: manifesteCartes.droits
  };
}

// Mesuré sur une machine ordinaire : le rendu PDF coûte environ 7,6 ms et
// 24 Ko par feuille, à peu près linéairement. On arrondit vers le haut : mieux
// vaut annoncer plus long que laisser croire à un plantage.
const MS_PAR_FEUILLE = 8;
const OCTETS_PAR_FEUILLE = 24 * 1024;
// Seuil réglé sur la demi-minute : en dessous, l'attente reste normale et une
// alerte ne ferait qu'inquiéter pour rien.
const FEUILLES_QUI_INQUIETENT = 4000;

function majResumeImpression() {
  const ligne = $("imp-resume");
  ligne.classList.remove("aide-alerte");
  if (!Object.keys(catalogue).length) { ligne.textContent = "Catalogue non chargé."; return; }
  try {
    const o = optionsImpression();
    const m = monterHtml(catalogue, o);

    // Plage vide : le dire ici plutôt que de laisser cliquer pour rien.
    if (!m.grilles) {
      ligne.textContent = o.de > o.a
        ? `Rien à imprimer : « de la carte » (${o.de}) est plus grand que « à la carte » (${o.a}).`
        : "Aucune carte dans cette tranche.";
      ligne.classList.add("aide-alerte");
      return;
    }

    let texte = `${m.grilles.toLocaleString("fr-CA")} grilles · ${m.feuilles.toLocaleString("fr-CA")} feuilles`
      + (m.derniereIncomplete ? ` · la dernière n'en porte que ${m.derniereIncomplete}` : "");

    // Un gros lot n'est pas une erreur : certaines stations impriment toute
    // leur base d'un coup pour ne commander qu'une fois par année. On annonce
    // donc ce qui s'en vient — sans ça, deux minutes d'attente sans rien à
    // l'écran ressemblent à un plantage — mais on ne suggère rien.
    if (m.feuilles >= FEUILLES_QUI_INQUIETENT) {
      const secondes = Math.round(m.feuilles * MS_PAR_FEUILLE / 1000);
      const duree = secondes >= 90 ? `${Math.round(secondes / 60)} minutes` : `${secondes} secondes`;
      texte += ` — compte environ ${duree} de rendu, pour un fichier de `
             + `${medias.formaterTaille(m.feuilles * OCTETS_PAR_FEUILLE)}. Laisse travailler.`;
      ligne.classList.add("aide-alerte");
    }
    ligne.textContent = texte;
  } catch (err) {
    ligne.textContent = err.message;
  }
}

/** « 1 min 12 s », « 47 s » — jamais « 72 secondes ». */
function enDuree(secondes) {
  const s = Math.max(0, Math.round(secondes));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

let minuterieRendu = null;

/**
 * Ouvre la fenêtre de rendu et fait avancer la jauge.
 *
 * printToPDF est une seule grosse opération : Electron ne dit rien tant
 * qu'elle n'est pas finie. La jauge avance donc sur le TEMPS ÉCOULÉ rapporté
 * à l'estimation, et plafonne à 95 %. Le temps affiché, lui, est réel — on
 * annonce « écoulées » et « environ », jamais un pourcentage inventé.
 */
function ouvrirRendu(feuilles) {
  const secondesPrevues = Math.max(1, feuilles * MS_PAR_FEUILLE / 1000);
  const depart = Date.now();

  $("rendu-quoi").textContent =
    `${feuilles.toLocaleString("fr-CA")} feuille${feuilles > 1 ? "s" : ""} à composer.`;
  $("rendu-jauge").style.width = "0%";
  $("rendu-pdf").hidden = false;

  const battre = () => {
    const ecoulees = (Date.now() - depart) / 1000;
    $("rendu-jauge").style.width = `${Math.min(95, (ecoulees / secondesPrevues) * 100).toFixed(1)}%`;
    $("rendu-temps").textContent = ecoulees > secondesPrevues * 1.15
      // Dépassé l'estimation : on le dit plutôt que de laisser un compteur
      // filer sous une jauge figée.
      ? `${enDuree(ecoulees)} écoulées — c'est plus long que prévu, mais ça travaille.`
      : `${enDuree(ecoulees)} écoulées sur environ ${enDuree(secondesPrevues)}.`;
  };
  battre();
  minuterieRendu = setInterval(battre, 500);
}

function fermerRendu(reussi) {
  clearInterval(minuterieRendu);
  minuterieRendu = null;
  if (reussi) $("rendu-jauge").style.width = "100%";
  $("rendu-pdf").hidden = true;
}

async function produireFeuilles(enPdf) {
  if (!Object.keys(catalogue).length) { dire("Le catalogue n'est pas chargé.", "erreur"); return; }
  let montage;
  try { montage = monterHtml(catalogue, optionsImpression()); }
  catch (err) { dire(err.message, "erreur"); return; }
  if (!montage.grilles) { dire("Aucune carte dans la tranche demandée.", "erreur"); return; }

  const o = optionsImpression();
  if (enPdf && window.studio?.presente) {
    // On demande la destination D'ABORD : la jauge n'a pas à tourner pendant
    // qu'une boîte système attend une réponse.
    const cible = await window.studio.choisirFichierPdf({
      nomSuggere: `feuilles-${o.parFeuille}-grilles-${o.de}-a-${o.a}.pdf`
    });
    if (cible?.annule) { dire("Enregistrement annulé.", ""); return; }
    if (cible?.erreur || !cible?.chemin) { dire("Destination impossible à ouvrir.", "erreur"); return; }

    ouvrirRendu(montage.feuilles);
    let r;
    try {
      r = await window.studio.rendreFeuillesPdf({
        html: montage.html,
        largeurMm: montage.page.l,
        hauteurMm: montage.page.h,
        chemin: cible.chemin
      });
    } finally {
      fermerRendu(!r?.erreur);
    }
    if (r?.erreur) dire(`Rendu impossible : ${r.erreur}`, "erreur");
    else dire(`PDF enregistré — ${montage.feuilles.toLocaleString("fr-CA")} feuilles`
              + `${r?.octets ? `, ${medias.formaterTaille(r.octets)}` : ""}.`, "ok");
    return;
  }

  // Aperçu — et repli sans Electron, où l'impression du navigateur fait le
  // PDF (Fichier → Imprimer → Enregistrer en PDF, marges : aucune).
  //
  // On BORNE l'aperçu : écrire seize mille feuilles dans une fenêtre fige le
  // navigateur pour de bon. Regarder les premières suffit à juger la mise en
  // page, qui est la même partout.
  const APERCU_MAX = 40;
  const borne = montage.feuilles > APERCU_MAX;
  const vu = borne
    ? monterHtml(catalogue, { ...o, de: o.de, a: Math.min(o.a, o.de + APERCU_MAX * o.parFeuille - 1) })
    : montage;

  const f = window.open("", "_blank");
  if (!f) { dire("Le navigateur a bloqué la fenêtre des feuilles.", "erreur"); return; }
  f.document.write(vu.html);
  f.document.close();

  dire(borne
    ? `Aperçu des ${vu.feuilles} premières feuilles sur ${montage.feuilles.toLocaleString("fr-CA")}. `
      + `La mise en page est la même partout — « Produire le PDF » les monte toutes.`
    : `${montage.feuilles} feuilles montées — imprime en PDF depuis cette fenêtre.`, "ok");
}

function brancherImpression() {
  for (const n of Object.keys(DISPOSITIONS).map(Number).sort((a, b) => a - b)) {
    const o = document.createElement("option");
    o.value = n; o.textContent = `${n} grille${n > 1 ? "s" : ""}`;
    $("imp-par-feuille").appendChild(o);
  }
  $("imp-par-feuille").value = "3";

  for (const nom of Object.keys(FORMATS)) {
    const o = document.createElement("option");
    o.value = nom; o.textContent = nom;
    $("imp-format").appendChild(o);
  }

  for (const id of ["imp-par-feuille", "imp-format", "imp-de", "imp-a"]) {
    $(id).oninput = majResumeImpression;
    $(id).onchange = majResumeImpression;
  }
  $("btn-imprimer-pdf").onclick = () => produireFeuilles(true);
  $("btn-imprimer-apercu").onclick = () => produireFeuilles(false);
}

// ---------------------------------------------------------------------
//  Sauvegarder et retrouver ses réglages
//
//  Les médias lourds vivent dans IndexedDB et l'état n'en transporte que la
//  clé. Un fichier qui ne porterait que les réglages rendrait donc, après
//  réinstallation, des renvois vers des fichiers absents : on les embarque.
// ---------------------------------------------------------------------

const TAILLE_QUI_INQUIETE = 200 * 1024 * 1024;   // au-delà, on prévient avant

/** Les fiches des médias auxquels l'habillage courant fait référence. */
function fichesMedias() {
  const t = theme();
  const fiches = [...(t.generique.musiques || [])];
  if (t.fondMedia?.image) fiches.push(t.fondMedia.image);
  if (t.fondMedia?.video) fiches.push(t.fondMedia.video);
  return fiches.filter((f) => f?.cle);
}

function majResumeExport() {
  const t = theme();
  const fiches = fichesMedias();
  const octets = fiches.reduce((s, f) => s + (f.taille || 0), 0);

  const morceaux = [`${etat.parties.length} partie${etat.parties.length > 1 ? "s" : ""}`];
  if (t.logo) morceaux.push("le logo");
  if (t.pubs.images.length) morceaux.push(`${t.pubs.images.length} pub${t.pubs.images.length > 1 ? "s" : ""}`);
  if (fiches.length) morceaux.push(`${fiches.length} média${fiches.length > 1 ? "s" : ""}`);

  const ligne = $("reg-export-resume");
  ligne.textContent = octets
    ? `Le fichier emportera ${morceaux.join(", ")} — environ ${medias.formaterTaille(Math.round(octets * 1.37))}.`
    : `Le fichier emportera ${morceaux.join(", ")}.`;
  // 1,37 : le base64 gonfle d'un tiers, plus le texte des réglages. Mieux vaut
  // annoncer un peu large qu'un peu court.
  ligne.classList.toggle("aide-alerte", octets > TAILLE_QUI_INQUIETE);
}

/** Un fichier du magasin, en adresse data: — seul format qui tient dans du JSON. */
function enDataUrl(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.onerror = () => reject(lecteur.error || new Error("lecture impossible"));
    lecteur.readAsDataURL(fichier);
  });
}

async function exporterReglages() {
  const fiches = fichesMedias();
  const octets = fiches.reduce((s, f) => s + (f.taille || 0), 0);

  if (octets > TAILLE_QUI_INQUIETE) {
    const suite = await demander({
      titre: "Ça va être un gros fichier",
      texte: `Tes médias pèsent ${medias.formaterTaille(octets)}. Le fichier de réglages `
           + `sera encore plus lourd, et sa préparation peut prendre une minute.`,
      detail: "Tu peux continuer, ou retirer la vidéo de fond d'abord et l'exporter à part.",
      oui: "Continue, j'ai le temps",
      non: "Laisse faire"
    });
    if (!suite) { dire("Export annulé.", ""); return; }
  }

  dire("Préparation du fichier…", "ok");

  const paquet = {};
  const introuvables = [];
  for (const fiche of fiches) {
    try {
      const fichier = await medias.lire(fiche.cle);
      if (!fichier) { introuvables.push(fiche.nom || fiche.cle); continue; }
      paquet[fiche.cle] = {
        nom: fiche.nom || fiche.cle,
        type: fiche.type || fichier.type || "",
        donnees: await enDataUrl(fichier)
      };
    } catch {
      introuvables.push(fiche.nom || fiche.cle);
    }
  }

  const jour = new Date().toISOString().slice(0, 10);
  const texte = JSON.stringify(monterDossier(etat, paquet, new Date().toISOString()), null, 1);
  const nom = nomDeFichier(etat.titre, jour);

  // Ce qui n'a pas pu être lu doit se dire, pas se taire : le fichier serait
  // incomplet et personne ne s'en apercevrait avant la réinstallation.
  const reserve = introuvables.length
    ? ` ⚠️ ${introuvables.length} média${introuvables.length > 1 ? "x" : ""} introuvable${introuvables.length > 1 ? "s" : ""} `
      + `au magasin (${introuvables.join(", ")}) — non inclus.`
    : "";

  if (window.studio?.presente) {
    const r = await window.studio.enregistrerFichier({
      texte, nomSuggere: nom, titre: "Enregistrer mes réglages", extension: "json"
    });
    if (r?.annule) { dire("Enregistrement annulé.", ""); return; }
    if (r?.erreur) { dire(`Enregistrement impossible : ${r.erreur}`, "erreur"); return; }
    dire(`Réglages enregistrés.${reserve}`, reserve ? "erreur" : "ok");
    return;
  }

  // Sans Electron : téléchargement ordinaire du navigateur.
  const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
  const lien = document.createElement("a");
  lien.href = url; lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  dire(`Réglages téléchargés — ${nom}.${reserve}`, reserve ? "erreur" : "ok");
}

async function importerReglages(fichier) {
  let dossier;
  try {
    dossier = lireDossier(JSON.parse(await fichier.text()));
  } catch (err) {
    // JSON.parse crache de l'anglais ; on ne le montre pas à l'opératrice.
    const message = err instanceof SyntaxError
      ? "Ce fichier n'est pas lisible — il a peut-être été modifié ou tronqué."
      : err.message;
    dire(message, "erreur");
    return;
  }

  const { reglages, medias: paquet } = dossier;
  const nbParties = Array.isArray(reglages.parties) ? reglages.parties.length : 0;
  const nbMedias = Object.keys(paquet).length;

  const enJeu = etat.tirage.length
    ? `Un bingo est en cours : les ${etat.tirage.length} numéros déjà tirés et les gagnants restent en place. `
    : "";

  const suite = await demander({
    titre: "Remplacer tes réglages ?",
    texte: `${enJeu}Ton habillage actuel, tes textes`
         + (nbParties ? ` et tes parties (${nbParties} arrivent)` : "")
         + ` seront remplacés par ceux du fichier.`,
    detail: nbMedias
      ? `${nbMedias} média${nbMedias > 1 ? "s seront replacés" : " sera replacé"} au passage.`
      : "Ce fichier ne porte aucun média.",
    oui: "Oui, remplace",
    non: "Non, garde les miens"
  });
  if (!suite) { dire("Import annulé.", ""); return; }

  // On remet les médias au magasin sous LEUR clé d'origine : c'est elle que
  // les réglages désignent.
  const manquants = [];
  for (const cle of clesMedias(reglages.theme)) {
    const m = paquet[cle];
    if (!m?.donnees) { manquants.push(cle); continue; }
    try {
      const blob = await (await fetch(m.donnees)).blob();
      await medias.deposerSous(cle, new File([blob], m.nom || cle, { type: m.type || blob.type }));
    } catch {
      manquants.push(cle);
    }
  }

  const { etat: suivant, retires } = appliquerReglages(etat, reglages, manquants);
  etat = suivant;

  pousser();          // enregistre, diffuse à l'antenne et redessine la régie
  majResumeExport();

  dire(
    retires.length
      ? `Réglages importés. ⚠️ Non repris, faute de fichier : ${retires.join(", ")}.`
      : "Réglages importés.",
    retires.length ? "erreur" : "ok"
  );
}

function brancherSauvegarde() {
  majResumeExport();
  $("btn-exporter").onclick = () => exporterReglages();
  $("btn-importer").onclick = () => $("fichier-reglages").click();
  $("fichier-reglages").onchange = (e) => {
    const f = e.target.files?.[0];
    // On vide le champ tout de suite : sinon réimporter le MÊME fichier deux
    // fois de suite ne déclenche rien, la valeur n'ayant pas changé.
    e.target.value = "";
    if (f) importerReglages(f);
  };
}

function brancherControles() {
  const ecran = (nom) => { etat.ecran = nom; pousser(); };
  $("btn-gen-debut").onclick = () => ecran(etat.ecran === "debut" ? "jeu" : "debut");
  $("btn-gen-fin").onclick = () => ecran(etat.ecran === "fin" ? "jeu" : "fin");
  $("btn-gen-stop").onclick = () => ecran("jeu");

  $("btn-pubs").onclick = () => {
    // Le bouton n'est jamais désactivé : un bouton grisé avale le clic et
    // l'opératrice croit que le logiciel ne répond pas. On l'emmène plutôt
    // là où il faut agir.
    if (!theme().pubs.images.length) {
      ouvrirParametres("titre-pubs");
      dire("Ajoute d'abord des images de pub, ici.", "erreur");
      return;
    }
    theme().pubs.actif = !theme().pubs.actif;
    dessinerParametresTheme();
    pousser();
  };
  $("btn-musique").onclick = () => {
    theme().sons.musique = !theme().sons.musique;
    dessinerParametresTheme();
    pousser();
  };
  $("btn-son-regie").onclick = () => {
    sonRegie = !sonRegie;
    localStorage.setItem(CLE_SON_REGIE, sonRegie ? "oui" : "non");
    if (sonRegie) sons.ding();
    rendre();
  };
}

function brancherParametres() {
  const majTheme = (champ, valeur) => { theme()[champ] = valeur; pousserLeger(); };

  $("reg-dateheure").onchange = () => majTheme("dateHeure", $("reg-dateheure").checked);
  $("reg-halo").onchange = () => majTheme("halo", $("reg-halo").checked);
  $("reg-texture").onchange = () => majTheme("texture", $("reg-texture").checked);
  $("reg-chroma-visible").onchange = () => majTheme("chromaVisible", $("reg-chroma-visible").checked);
  $("reg-chroma").oninput = () => majTheme("chroma", $("reg-chroma").value);

  for (const [id, champ] of [
    ["reg-fond-haut", "fondHaut"], ["reg-fond-milieu", "fondMilieu"], ["reg-fond-bas", "fondBas"]
  ]) {
    $(id).oninput = () => { theme()[champ] = $(id).value; majApercuFond(); pousserLeger(); };
  }
  $("reg-fond-angle").oninput = () => {
    theme().fondAngle = Number($("reg-fond-angle").value);
    majApercuFond(); pousserLeger();
  };

  $("btn-fond-defaut").onclick = () => {
    const d = themeNeuf();
    Object.assign(theme(), {
      fondHaut: d.fondHaut, fondMilieu: d.fondMilieu, fondBas: d.fondBas,
      fondAngle: d.fondAngle, halo: d.halo, texture: d.texture
    });
    dessinerParametresTheme();
    pousser();
  };
  $("btn-chroma-defaut").onclick = () => {
    theme().chroma = themeNeuf().chroma;
    dessinerParametresTheme();
    pousser();
  };

  $("reg-logo-fichier").onchange = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";               // permet de reprendre le même fichier
    if (!fichier) return;
    try {
      theme().logo = await reduireImage(fichier, 400, 200, "image/png");
      dessinerParametresTheme();
      dire("Logo mis à l'antenne.", "ok");
      pousser();
    } catch {
      dire("Ce fichier n'est pas une image lisible.", "erreur");
    }
  };
  $("btn-logo-retirer").onclick = () => {
    theme().logo = null;
    dessinerParametresTheme();
    pousser();
  };

  // --- Bandeau défilant ---
  $("reg-bandeau-actif").onchange = () => majTheme2("bandeau", "actif", $("reg-bandeau-actif").checked);
  $("reg-bandeau-messages").oninput = () => {
    theme().bandeau.messages = $("reg-bandeau-messages").value.split("\n").map((l) => l.trim()).filter(Boolean);
    pousserLeger();
  };
  $("reg-bandeau-rss").oninput = () => { theme().bandeau.rssUrl = $("reg-bandeau-rss").value.trim(); pousserLeger(); };
  $("reg-bandeau-vitesse").oninput = () => {
    theme().bandeau.vitesse = Number($("reg-bandeau-vitesse").value);
    $("reg-bandeau-vitesse-val").textContent = theme().bandeau.vitesse;
    pousserLeger();
  };
  $("btn-rss-tester").onclick = chargerRss;

  // --- Pubs ---
  $("btn-pubs-dossier").onclick = () => choisirDossierPubs();
  $("btn-pubs-relire").onclick = () => relireDossierPubs();
  $("btn-pubs-oublier").onclick = () => {
    theme().pubs.dossier = null;
    theme().pubs.fichiers = [];
    dessinerDossierPubs();
    dire("Dossier oublié.", "ok");
    pousser();
  };

  $("reg-pubs-fichiers").onchange = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!fichiers.length) return;
    let ajoutees = 0, refusees = 0;
    for (const f of fichiers) {
      try {
        theme().pubs.images.push(await reduireImage(f, 1280, 720, "image/jpeg"));
        ajoutees++;
      } catch { refusees++; }
    }
    dessinerParametresTheme();
    dire(
      `${ajoutees} image${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}.`
      + (refusees ? ` ${refusees} refusée${refusees > 1 ? "s" : ""} (illisible).` : ""),
      refusees ? "erreur" : "ok"
    );
    pousser();
  };
  $("reg-pubs-secondes").oninput = () => {
    theme().pubs.secondes = Number($("reg-pubs-secondes").value);
    $("reg-pubs-secondes-val").textContent = theme().pubs.secondes;
    pousserLeger();
  };

  // --- Sons ---
  $("reg-son-ding").onchange = () => majTheme2("sons", "ding", $("reg-son-ding").checked);
  $("reg-son-fanfare").onchange = () => majTheme2("sons", "fanfare", $("reg-son-fanfare").checked);
  $("reg-son-musique").onchange = () => { theme().sons.musique = $("reg-son-musique").checked; pousser(); };
  $("reg-vol-musique").oninput = () => {
    theme().sons.volumeMusique = Number($("reg-vol-musique").value) / 100;
    $("reg-vol-musique-val").textContent = $("reg-vol-musique").value;
    sons.reglerVolumes({ musique: theme().sons.volumeMusique });
    pousserLeger();
  };
  $("reg-vol-effets").oninput = () => {
    theme().sons.volumeEffets = Number($("reg-vol-effets").value) / 100;
    $("reg-vol-effets-val").textContent = $("reg-vol-effets").value;
    sons.reglerVolumes({ effets: theme().sons.volumeEffets });
    pousserLeger();
  };

  // --- Fond image ou vidéo ---
  // Les médias ne passent PAS par l'état : ils vont au magasin IndexedDB,
  // et l'état ne garde qu'une fiche { cle, nom, type, taille }.
  const deposerFond = (type) => async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      const ancienne = theme().fondMedia[type];
      if (ancienne) await medias.retirer(ancienne.cle);
      theme().fondMedia[type] = await medias.deposer(`fond-${type}`, fichier);
      dessinerParametresTheme();
      dire(`${type === "video" ? "Vidéo" : "Image"} de fond en place.`, "ok");
      pousser();
    } catch (err) {
      dire(`Impossible d'enregistrer ce fichier (${err.message}).`, "erreur");
    }
  };
  $("reg-fond-image").onchange = deposerFond("image");
  $("reg-fond-video").onchange = deposerFond("video");

  $("btn-fond-media-retirer").onclick = async () => {
    for (const type of ["image", "video"]) {
      const fiche = theme().fondMedia[type];
      if (fiche) await medias.retirer(fiche.cle);
      theme().fondMedia[type] = null;
    }
    dessinerParametresTheme();
    dire("Le fond revient au dégradé.", "ok");
    pousser();
  };
  $("reg-fond-opacite").oninput = () => {
    theme().fondMedia.opacite = Number($("reg-fond-opacite").value) / 100;
    $("reg-fond-opacite-val").textContent = $("reg-fond-opacite").value;
    pousserLeger();
  };

  // --- Génériques ---
  $("reg-reglement-actif").onchange = () => majTheme2("generique", "reglementActif", $("reg-reglement-actif").checked);
  $("reg-reglement").oninput = () => { theme().generique.reglement = $("reg-reglement").value; pousserLeger(); };
  $("reg-gen-volume").oninput = () => {
    theme().generique.volumeMusique = Number($("reg-gen-volume").value) / 100;
    $("reg-gen-volume-val").textContent = $("reg-gen-volume").value;
    pousserLeger();
  };
  $("reg-musiques").onchange = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!fichiers.length) return;
    let ajoutees = 0;
    for (const f of fichiers) {
      try { theme().generique.musiques.push(await medias.deposer("musique", f)); ajoutees++; }
      catch { /* fichier refusé, on continue avec les suivants */ }
    }
    dessinerParametresTheme();
    dire(`${ajoutees} musique${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}.`, ajoutees ? "ok" : "erreur");
    pousser();
  };

  $("reg-gen-debut").oninput = () => { theme().generique.texteDebut = $("reg-gen-debut").value; pousserLeger(); };
  $("reg-gen-fin").oninput = () => { theme().generique.texteFin = $("reg-gen-fin").value; pousserLeger(); };
  $("reg-gen-vitesse").oninput = () => {
    theme().generique.vitesse = Number($("reg-gen-vitesse").value);
    $("reg-gen-vitesse-val").textContent = theme().generique.vitesse;
    pousserLeger();
  };
}

/** Met à jour un réglage d'un sous-groupe du thème, puis diffuse. */
function majTheme2(groupe, champ, valeur) {
  theme()[groupe][champ] = valeur;
  pousser();
}

// ---------------------------------------------------------------------
//  Flux RSS — le serveur local va le chercher (le navigateur refuserait)
// ---------------------------------------------------------------------

async function chargerRss() {
  const url = theme().bandeau.rssUrl;
  if (!url) { $("reg-rss-etat").textContent = "Aucune adresse saisie."; return; }

  $("reg-rss-etat").textContent = "Chargement…";
  try {
    const rep = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
    const donnees = await rep.json();
    if (!rep.ok) throw new Error(donnees.erreur ?? `HTTP ${rep.status}`);

    etat.rssTitres = (donnees.titres ?? []).slice(0, 15);
    $("reg-rss-etat").textContent = etat.rssTitres.length
      ? `${etat.rssTitres.length} titres chargés à ${heureQuebec()}.`
      : "Le flux n'a renvoyé aucun titre.";
    pousser();
  } catch (err) {
    etat.rssTitres = [];
    $("reg-rss-etat").textContent = `Échec : ${err.message}`;
    pousser();
  }
}

function dessinerReglagesParties() {
  const boite = $("reg-parties");
  boite.innerHTML = "";

  etat.parties.forEach((p, i) => {
    const rang = document.createElement("div");
    rang.className = "reg-partie" + (i === etat.partieIndex ? " courante" : "");

    const nom = document.createElement("input");
    nom.type = "text"; nom.value = p.nom; nom.title = "Nom de la partie";
    nom.oninput = () => { etat.parties[i].nom = nom.value; pousserLeger(); };

    const fig = document.createElement("select");
    fig.title = "Figure à compléter";
    for (const id of ORDRE_FIGURES) {
      const o = document.createElement("option");
      o.value = id; o.textContent = FIGURES[id].nom;
      fig.appendChild(o);
    }
    fig.value = p.figure;
    fig.onchange = () => { etat.parties[i].figure = fig.value; rafraichirVerification(); pousser(); };

    const lot = document.createElement("input");
    lot.type = "number"; lot.min = "0"; lot.step = "5"; lot.value = p.lot ?? 0;
    lot.title = "Lot en dollars";
    lot.oninput = () => { etat.parties[i].lot = Number(lot.value) || 0; pousserLeger(); };

    // Réordonner : on déplace aussi la partie en cours si c'est elle qui bouge,
    // sinon l'opératrice se retrouverait sur une autre partie sans l'avoir voulu.
    const deplacer = (vers) => {
      const [item] = etat.parties.splice(i, 1);
      etat.parties.splice(vers, 0, item);
      if (etat.partieIndex === i) etat.partieIndex = vers;
      else if (etat.partieIndex === vers) etat.partieIndex = i;
      pousser();
    };

    const haut = document.createElement("button");
    haut.className = "reg-bouton-mini"; haut.textContent = "↑";
    haut.title = "Monter"; haut.disabled = i === 0;
    haut.onclick = () => deplacer(i - 1);

    const bas = document.createElement("button");
    bas.className = "reg-bouton-mini"; bas.textContent = "↓";
    bas.title = "Descendre"; bas.disabled = i === etat.parties.length - 1;
    bas.onclick = () => deplacer(i + 1);

    const sup = document.createElement("button");
    sup.className = "reg-supprimer"; sup.textContent = "×";
    sup.title = "Supprimer cette partie";
    sup.onclick = () => {
      if (etat.parties.length === 1) { dire("Il faut au moins une partie.", "erreur"); return; }
      etat.parties.splice(i, 1);
      etat.partieIndex = Math.min(etat.partieIndex, etat.parties.length - 1);
      rafraichirVerification();
      pousser();
    };

    rang.append(nom, fig, lot, haut, bas, sup);
    boite.appendChild(rang);
  });
}

// Pour les champs texte : on diffuse sans redessiner (sinon le curseur saute).
function pousserLeger() {
  sauvegarder(etat);
  diffuser(canal, etat);
  $("entete-session").textContent = etat.titre || "";
  // Cette ligne-là doit suivre la frappe. Elle n'écrit que du texte dans un
  // <p> — jamais dans un champ —, donc elle ne déplace pas le curseur.
  majEtatBandeau(theme());
}

// ---------------------------------------------------------------------
//  Rapport de session
// ---------------------------------------------------------------------

function rapport() {
  const date = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Toronto", dateStyle: "full"
  }).format(new Date());

  const echapper = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const lignes = etat.horodatage.map((h, i) =>
    `<tr><td>${i + 1}</td><td>${lettre(h.numero)}-${h.numero}</td><td>${echapper(h.heure)}</td></tr>`).join("");

  const gagnants = (etat.gagnants ?? []).map((g) =>
    `<tr><td>${echapper(g.partie)}</td><td>${echapper(FIGURES[g.figure]?.nom ?? g.figure)}</td>
     <td>Carte ${g.carte}</td><td>${echapper(g.nom || "—")}</td><td>${Number(g.lot).toLocaleString("fr-CA")} $</td><td>${echapper(g.heure)}</td></tr>`).join("")
    || '<tr><td colspan="6">Aucun gagnant consigné.</td></tr>';

  const html = `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8">
<title>Rapport — ${echapper(etat.titre)}</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; margin: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 19px; margin-bottom: 4px; }
  p.sous { color: #555; margin-bottom: 22px; }
  h2 { font-size: 15px; margin: 26px 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
  th { background: #f0f0f0; }
  .ordre { column-count: 4; column-gap: 22px; }
  .ordre table { width: 100%; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<h1>${echapper(etat.titre)}</h1>
<p class="sous">${echapper(date)} — rapport produit par Bingo Studio</p>

<h2>Parties</h2>
<table><tr><th>Partie</th><th>Figure</th><th>Lot</th></tr>
${etat.parties.map((p) => `<tr><td>${echapper(p.nom)}</td><td>${echapper(FIGURES[p.figure]?.nom ?? p.figure)}</td><td>${Number(p.lot || 0).toLocaleString("fr-CA")} $</td></tr>`).join("")}
</table>

<h2>Gagnants</h2>
<table><tr><th>Partie</th><th>Figure</th><th>Carte</th><th>Nom</th><th>Lot</th><th>Heure</th></tr>${gagnants}</table>

<h2>Numéros tirés (${etat.tirage.length})</h2>
<div class="ordre"><table><tr><th>#</th><th>Boule</th><th>Heure</th></tr>${lignes}</table></div>
</body></html>`;

  const f = window.open("", "_blank", "width=900,height=1000");
  if (!f) { dire("Le navigateur a bloqué la fenêtre du rapport.", "erreur"); return; }
  f.document.write(html);
  f.document.close();
}

// ---------------------------------------------------------------------
//  Branchements
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
//  Le tableau — le même qu'à l'antenne, pour voir ce que voit le public.
//
//  Le tableau est une BASCULE : un clic allume le numéro et l'envoie à
//  l'antenne, un second clic l'éteint et le retire. Pas de confirmation —
//  en direct, l'opératrice suit le boulier et n'a pas le temps.
//  Le rattrapage d'un clic malheureux est donc un simple reclic.
//  La saisie au clavier, elle, garde sa confirmation par Entrée.
// ---------------------------------------------------------------------

const casesTableau = new Map();

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
      c.title = `${col}-${n}`;
      c.onclick = () => cliquerCase(n);
      casesTableau.set(n, c);
      tableau.appendChild(c);
    }
  }
}

function cliquerCase(n) {
  if (etat.tirage.includes(n)) retirerNumero(n);
  else envoyerNumero(n);
}

function brancher() {
  // --- saisie ---
  $("saisie").addEventListener("input", majApercu);
  $("saisie").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); envoyer(); }
    if (e.key === "Escape") { e.preventDefault(); $("saisie").value = ""; majApercu(); }
  });
  $("btn-annuler").onclick = annulerDernier;

  // --- vérification ---
  $("verif-num").addEventListener("input", rafraichirVerification);
  $("verif-num").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); montrerCarte(); }
  });
  $("btn-verification").onclick = ouvrirVerification;
  $("btn-retour-antenne").onclick = fermerVerification;
  $("btn-valider").onclick = validerGagnant;
  $("btn-cartes").onclick = () => ouvrirParametres("titre-impression");

  // --- parties ---
  $("partie-figure").onchange = () => {
    etat.parties[etat.partieIndex].figure = $("partie-figure").value;
    rafraichirVerification(); pousser();
  };
  $("partie-lot").oninput = () => {
    etat.parties[etat.partieIndex].lot = Number($("partie-lot").value) || 0;
    pousserLeger();
  };
  $("btn-partie-precedente").onclick = () => {
    etat.partieIndex = Math.max(0, etat.partieIndex - 1);
    rafraichirVerification(); pousser();
  };
  $("btn-partie-suivante").onclick = () => {
    if (etat.partieIndex >= etat.parties.length - 1) { dire("C'est déjà la dernière partie.", "erreur"); return; }
    etat.partieIndex++;
    etat.tirage = []; etat.horodatage = []; etat.verification = null; etat.annonce = null;
    rafraichirVerification();
    dire("Nouvelle partie — le tableau est vide.", "ok");
    pousser();
  };
  $("btn-vider-tirage").onclick = async () => {
    const sortis = etat.tirage.length;
    const gagnants = etat.gagnants.length;
    if (!sortis && !gagnants) { dire("Le jeu est déjà à zéro.", "erreur"); return; }

    // On énumère ce qui va disparaître, pas « des données » : c'est ce qui
    // permet de reconnaître la fausse manœuvre avant de cliquer, pas la peur.
    const perdu = [];
    if (sortis) perdu.push(`<strong>${sortis} numéro${sortis > 1 ? "s" : ""} du tableau</strong>`);
    if (gagnants) perdu.push(`<strong>${gagnants} gagnant${gagnants > 1 ? "s" : ""}</strong>`);

    const ok = await demander({
      titre: "Attention, ça part pour de bon",
      texte: `Tu effaces ${perdu.join(" et ")}, et tu reviens à la première partie. `
           + `L'antenne se vide en même temps, devant tout le monde.`,
      detail: gagnants
        ? "Sors ton rapport de session avant, si tu en as besoin : les gagnants n'y seront plus après."
        : "Si c'est le mauvais bouton, c'est le moment de faire marche arrière.",
      oui: "Oui, on repart à zéro",
      non: "Non, fausse manœuvre"
    });
    if (!ok) return;

    // La soirée s'efface ; l'habillage, les parties et les textes restent —
    // sinon il faudrait tout resaisir entre deux bingos.
    etat.tirage = [];
    etat.horodatage = [];
    etat.gagnants = [];
    etat.verification = null;
    etat.annonce = null;
    etat.partieIndex = 0;
    // On ne touche NI à `ecran` NI à `enOnde` : ce qui est en ondes en ce
    // moment ne regarde pas la remise à zéro du jeu. Remettre le jeu à
    // l'antenne pendant le générique d'ouverture serait pire que le mal.
    verification = null;
    $("verif-num").value = "";
    $("verif-nom").value = "";
    dessinerVerification();
    dire("Jeu réinitialisé — habillage et parties conservés.", "ok");
    pousser();
  };
  $("btn-ajouter-partie").onclick = () => {
    etat.parties.push({ nom: `Partie ${etat.parties.length + 1}`, figure: "PLEINE", lot: 100 });
    pousser();
  };
  $("btn-vers-parties").onclick = () => ouvrirParametres("titre-parties");

  // --- antenne ---
  $("btn-pause").onclick = () => { etat.enOnde = !etat.enOnde; pousser(); };
  $("btn-reglages").onclick = () => {
    if ($("bloc-reglages").hidden) ouvrirParametres();
    else fermerParametres();
  };
  $("btn-param-retour").onclick = fermerParametres;
  $("btn-param-enregistrer").onclick = () => {
    // Les réglages s'appliquent déjà au fil de la saisie ; ce bouton force
    // l'écriture et confirme, pour qu'on ne quitte pas dans le doute.
    if (sauvegarder(etat)) dire("Paramètres enregistrés.", "ok");
    else dire("Sauvegarde impossible — stockage plein. Retire des images de pub.", "erreur");
    fermerParametres();
  };
  $("reg-titre").oninput = () => { etat.titre = $("reg-titre").value; pousserLeger(); };
  $("btn-ajouter-telephone").onclick = () => {
    if (!Array.isArray(etat.telephones)) etat.telephones = [];
    etat.telephones.push("");
    pousser();
    // La main tombe directement dans le champ qu'on vient de créer.
    $("reg-telephones").querySelector("input:last-of-type")?.focus();
  };

  for (const [id, champ] of [["reg-ambiance", "ambiance"], ["reg-accent", "accent"], ["reg-marquage", "marquage"]]) {
    $(id).oninput = () => { theme()[champ] = $(id).value; pousserLeger(); };
  }
  // Le fond ne suit PAS l'ambiance automatiquement : ce serait écraser sans
  // prévenir un dégradé réglé à la main. Un bouton, un geste volontaire.
  $("btn-accorder-fond").onclick = () => {
    const a = theme().ambiance;
    Object.assign(theme(), {
      fondHaut: melangerVersNoir(a, 0.90),
      fondMilieu: melangerVersNoir(a, 0.72),
      fondBas: melangerVersNoir(a, 0.38)
    });
    dessinerParametresTheme();
    dire("Le fond reprend la couleur d'ambiance.", "ok");
    pousser();
  };

  $("btn-couleurs-defaut").onclick = () => {
    const d = themeNeuf();
    Object.assign(theme(), { ambiance: d.ambiance, accent: d.accent, marquage: d.marquage });
    dessinerParametresTheme();
    pousser();
  };

  for (const id of ["reg-source-messages", "reg-source-rss"]) {
    $(id).onchange = () => {
      theme().bandeau.source = $("reg-source-rss").checked ? "rss" : "messages";
      pousser();
    };
  }
  $("reg-commanditaire").oninput = () => { etat.commanditaire = $("reg-commanditaire").value; pousserLeger(); };
  $("btn-rapport").onclick = rapport;
  // Il n'y a plus qu'UNE remise à zéro, « Réinitialiser le jeu », dans la
  // régie. « Nouvelle session » faisait exactement la même chose sous un autre
  // nom, deux écrans plus loin : dans une régie en direct, deux boutons pour
  // un seul geste, c'est comme ça qu'on se trompe.

  brancherParametres();
  brancherControles();
  brancherImpression();
  brancherSauvegarde();

  // --- écrans ---
  $("confirm-oui").onclick = () => repondreConfirmation(true);
  $("confirm-non").onclick = () => repondreConfirmation(false);
  $("confirmation").onclick = (e) => { if (e.target.id === "confirmation") repondreConfirmation(false); };

  $("btn-ecrans").onclick = ouvrirChoixEcran;
  $("btn-fermer-ecrans").onclick = () => { $("choix-ecran").hidden = true; };
  $("btn-antenne-fenetre").onclick = async () => {
    if (window.studio?.presente) await window.studio.antenneEnFenetre();
    $("choix-ecran").hidden = true;
  };

  // --- raccourcis globaux ---
  document.addEventListener("keydown", (e) => {
    // Une confirmation ouverte capte Échap et Entrée : on ne veut surtout
    // pas qu'un numéro parte à l'antenne pendant qu'elle est affichée.
    if (!$("confirmation").hidden) {
      if (e.key === "Escape") { e.preventDefault(); repondreConfirmation(false); }
      if (e.key === "Enter" && e.target.id === "confirm-oui") { e.preventDefault(); repondreConfirmation(true); }
      return;
    }
    const dansUnChamp = ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annulerDernier(); return; }
    if (e.key === "F1") { e.preventDefault(); $("saisie").focus(); $("saisie").select(); return; }
    if (e.key === "F2") { e.preventDefault(); $("verif-num").focus(); $("verif-num").select(); return; }
    // Un chiffre tapé hors champ ramène la main sur la saisie du boulier.
    if (!dansUnChamp && /^[0-9]$/.test(e.key)) { $("saisie").focus(); }
  });
}

/**
 * Passe l'antenne en mode vérification : l'incrustation caméra disparaît et
 * laisse la place au bloc de vérification, qui suit la saisie en direct.
 *
 * Une musique part en même temps, plus forte que le fond sonore habituel.
 * Il n'y a pas de voix d'animateur pendant une vérification : sans musique,
 * le téléspectateur n'entend rien du tout pendant que l'opératrice cherche.
 */
function ouvrirVerification() {
  etat.modeVerification = true;
  etat.verification = verification;
  dire("Vérification à l'antenne. Tape le numéro : il s'affiche en direct.", "ok");
  pousser();
}

function fermerVerification() {
  etat.modeVerification = false;
  etat.verification = null;
  dire("Retour à l'antenne.", "ok");
  pousser();
}

function validerGagnant() {
  if (!verification || verification.statut !== "GAGNANTE") {
    dire("Cette carte n'est pas gagnante — rien n'a été validé.", "erreur");
    return;
  }
  // Un même numéro validé deux fois, c'est un double clic ou une carte déjà
  // appelée. On refuse plutôt que de partager le lot avec un fantôme.
  const partie = partieCourante();
  if ((etat.gagnants ?? []).some((g) => g.carte === verification.numero && g.partie === partie.nom)) {
    dire(`La carte ${verification.numero} est déjà gagnante de cette partie.`, "erreur");
    return;
  }

  const nom = $("verif-nom").value.trim();
  const numero = verification.numero;   // relevé AVANT de vider la vérification

  etat.gagnants = etat.gagnants ?? [];
  etat.gagnants.push({
    partie: partie.nom, figure: partie.figure,
    carte: numero, nom, lot: Number(partie.lot || 0), heure: heureQuebec()
  });

  // Le lot se partage entre tous les gagnants de la partie, et se recalcule
  // à chaque ajout. L'antenne fait le même calcul de son côté.
  const memePartie = etat.gagnants.filter((g) => g.partie === partie.nom);
  const part = Number(partie.lot || 0) / memePartie.length;

  etat.annonce = {
    texte: `BINGO !\n${nom || `Carte ${numero}`}`
      + (part ? `\n${part.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $` : "")
      + (memePartie.length > 1 ? `\n(lot partagé à ${memePartie.length})` : "")
  };
  $("verif-nom").value = "";
  $("verif-num").value = "";
  verification = null;

  dire(memePartie.length > 1
    ? `Gagnant validé. Lot partagé à ${memePartie.length} — chacun ${part.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $.`
    : `Gagnant validé : ${nom || `carte ${numero}`}.`, "ok");

  rafraichirVerification();
  pousser();

  // La grosse annonce s'efface d'elle-même ; le bloc de vérification reste,
  // prêt pour le prochain appel — il y a souvent plusieurs gagnants.
  setTimeout(() => { etat.annonce = null; pousser(); }, 10000);
}

async function ouvrirChoixEcran() {
  const liste = $("liste-ecrans");
  liste.innerHTML = "";

  if (!window.studio?.presente) {
    liste.innerHTML = `<p class="aide">Mode navigateur : ouvre
      <strong>${location.origin}/antenne</strong> dans une seconde fenêtre,
      glisse-la sur l'écran de diffusion, puis appuie sur F11 pour le plein écran.
      Pour OBS ou Tricaster, utilise cette même adresse comme source navigateur.</p>`;
  } else {
    const ecrans = await window.studio.ecrans();
    for (const e of ecrans) {
      const b = document.createElement("button");
      b.className = "ecran-choix";
      b.innerHTML = `<strong>${e.nom}</strong>${e.principal ? " — écran principal" : ""}
                     <small>${e.largeur} × ${e.hauteur} pixels</small>`;
      b.onclick = async () => {
        await window.studio.antenneVersEcran(e.id);
        $("choix-ecran").hidden = true;
        dire(`Antenne envoyée en plein écran sur « ${e.nom} ».`, "ok");
      };
      liste.appendChild(b);
    }
  }
  $("choix-ecran").hidden = false;
}

// ---------------------------------------------------------------------
//  Démarrage
// ---------------------------------------------------------------------

async function demarrer() {
  // Liste des figures dans le sélecteur de la partie en cours
  const sel = $("partie-figure");
  for (const id of ORDRE_FIGURES) {
    const o = document.createElement("option");
    o.value = id; o.textContent = `${FIGURES[id].nom} — ${FIGURES[id].aide}`;
    sel.appendChild(o);
  }

  construireTableau();
  brancher();

  // L'adresse doit refléter le port RÉEL : si le 7777 était occupé, le
  // serveur a pris le suivant, et c'est celui-là qu'il faut mettre dans OBS.
  //
  // Enveloppé : c'est un CONFORT. Sans ce filet, un échec de ce seul appel
  // interrompait tout le reste de `demarrer()` — le catalogue de cartes ne
  // se chargeait plus et la vérification devenait muette, sans rien afficher.
  let adresse = `${location.origin}/antenne`;
  try {
    if (window.studio?.presente) adresse = await window.studio.adresseAntenne();
  } catch { /* on garde l'adresse déduite de la page */ }
  $("adresse-antenne").textContent = "Source navigateur pour OBS ou Tricaster : " + adresse;

  try {
    const rep = await fetch("/data/cartes.json");
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    catalogue = await rep.json();
    $("verif-verdict").textContent = descriptionCatalogue();

    const nums = numerosCatalogue();
    $("imp-de").value = nums[0];
    $("imp-a").value = nums.at(-1);
    $("imp-de").min = nums[0]; $("imp-a").max = nums.at(-1);

    // Le champ de vérification se règle sur la base RÉELLEMENT chargée. En dur
    // à 4 chiffres, il aurait avalé le « 4 » de la carte 12345 sans un bruit :
    // l'opératrice aurait lu « introuvable » en ondes, avec la bonne carte en
    // main. Une station qui génère sa propre base est couverte aussi.
    const chiffres = String(nums.at(-1)).length;
    $("verif-num").maxLength = chiffres;
    $("verif-num").placeholder = "0".repeat(chiffres);
    try {
      const m = await fetch("/data/cartes.manifeste.json");
      if (m.ok) manifesteCartes = await m.json();
    } catch { /* pas de manifeste : la mention de droits sera vide */ }
    majResumeImpression();
  } catch (err) {
    dire("Catalogue de cartes introuvable — la vérification est indisponible.", "erreur");
    $("verif-num").disabled = true;
  }

  // Au redémarrage, le serveur ne sait plus où est le dossier de publicités :
  // il n'a jamais rien retenu. On le lui redit en silence, sinon « Passer aux
  // pubs » afficherait du noir sans que rien n'explique pourquoi.
  if (window.studio?.presente && theme().pubs.dossier) relireDossierPubs(true);

  majApercu();
  dessinerVerification();
  pousser();
  $("saisie").focus();
}

demarrer();
