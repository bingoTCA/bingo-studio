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
  creerCanal, diffuser, etatNeuf, themeNeuf, sauvegarder, restaurer, effacerSauvegarde
} from "../core/canal.js";
import * as sons from "../core/sons.js";
import * as medias from "../core/medias.js";

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
  if (brut === "") { verification = null; dessinerVerification(); return; }
  verification = verifierCarte(catalogue, brut, etat.tirage, partieCourante().figure);
  dessinerVerification();

  // Si la carte est déjà à l'antenne, on la garde à jour au fil des tirages.
  if (etat.verification && etat.verification.numero === verification.numero) {
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

  // Pubs
  $("reg-pubs-secondes").value = t.pubs.secondes;
  $("reg-pubs-secondes-val").textContent = t.pubs.secondes;
  dessinerListePubs();

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
  $("btn-montrer").onclick = montrerCarte;
  $("btn-cacher").onclick = () => { etat.verification = null; pousser(); };
  $("btn-annoncer").onclick = annoncerGagnant;

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
  $("btn-vider-tirage").onclick = () => {
    if (!confirm("Vider tous les numéros du tableau ?")) return;
    etat.tirage = []; etat.horodatage = []; etat.verification = null;
    rafraichirVerification(); pousser();
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
  $("btn-nouvelle").onclick = () => {
    if (!confirm(
      "Effacer la session et tout recommencer ?\n\n"
      + "Les numéros tirés et les gagnants sont effacés.\n"
      + "L'habillage, les parties et les textes sont conservés."
    )) return;

    // Ce qui appartient à la STATION se garde ; seule la partie du jour part.
    // Sans ça, il faudrait retéléverser le logo et resaisir les quatre
    // parties chaque semaine — et chaque télé communautaire a sa formule.
    const station = {
      theme: theme(),
      parties: etat.parties,
      titre: etat.titre,
      telephones: etat.telephones,
      commanditaire: etat.commanditaire
    };
    effacerSauvegarde();
    etat = { ...etatNeuf(), ...station, ecran: "jeu" };
    verification = null;
    $("verif-num").value = "";
    dessinerVerification();
    dire("Nouvelle session — parties et habillage conservés.", "ok");
    pousser();
  };

  brancherParametres();
  brancherControles();

  // --- écrans ---
  $("btn-ecrans").onclick = ouvrirChoixEcran;
  $("btn-fermer-ecrans").onclick = () => { $("choix-ecran").hidden = true; };
  $("btn-antenne-fenetre").onclick = async () => {
    if (window.studio?.presente) await window.studio.antenneEnFenetre();
    $("choix-ecran").hidden = true;
  };

  // --- raccourcis globaux ---
  document.addEventListener("keydown", (e) => {
    const dansUnChamp = ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annulerDernier(); return; }
    if (e.key === "F1") { e.preventDefault(); $("saisie").focus(); $("saisie").select(); return; }
    if (e.key === "F2") { e.preventDefault(); $("verif-num").focus(); $("verif-num").select(); return; }
    // Un chiffre tapé hors champ ramène la main sur la saisie du boulier.
    if (!dansUnChamp && /^[0-9]$/.test(e.key)) { $("saisie").focus(); }
  });
}

function montrerCarte() {
  if (!verification || verification.statut === "INTROUVABLE") {
    dire("Saisis d'abord un numéro de carte valide.", "erreur");
    return;
  }
  etat.verification = verification;
  dire(`Carte ${verification.numero} affichée à l'antenne.`, "ok");
  pousser();
}

function annoncerGagnant() {
  if (!verification || verification.statut !== "GAGNANTE") {
    dire("Cette carte n'est pas gagnante — rien n'a été annoncé.", "erreur");
    return;
  }
  const partie = partieCourante();
  const lot = Number(partie.lot || 0);

  const nom = $("verif-nom").value.trim();

  etat.gagnants = etat.gagnants ?? [];
  etat.gagnants.push({
    partie: partie.nom, figure: partie.figure,
    carte: verification.numero, nom, lot, heure: heureQuebec()
  });
  etat.annonce = {
    texte: `BINGO !\n${nom ? nom + "\n" : ""}Carte ${verification.numero}`
      + (lot ? ` — ${lot.toLocaleString("fr-CA")} $` : "")
  };
  $("verif-nom").value = "";
  etat.verification = verification;
  dire(`Gagnant annoncé : carte ${verification.numero}. Reclique « Annoncer » pour retirer l'annonce.`, "ok");
  pousser();

  // La grosse annonce s'efface d'elle-même après 12 s ; la carte reste.
  setTimeout(() => { etat.annonce = null; pousser(); }, 12000);
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
  } catch (err) {
    dire("Catalogue de cartes introuvable — la vérification est indisponible.", "erreur");
    $("verif-num").disabled = true;
  }

  majApercu();
  dessinerVerification();
  pousser();
  $("saisie").focus();
}

demarrer();
