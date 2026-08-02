// =====================================================================
//  Canal régie -> antenne, et sauvegarde de la session.
//
//  BroadcastChannel relie deux fenêtres de même origine. Ça marche à
//  l'identique dans Electron et dans un navigateur — c'est ce qui permet
//  d'avoir UN seul code pour les deux modes de diffusion.
//
//  La régie est la seule source de vérité. L'antenne ne fait qu'écouter
//  et afficher : elle n'émet jamais rien.
// =====================================================================

const NOM_CANAL = "bingo-studio";
const CLE_SAUVEGARDE = "bingo-studio-session";

/**
 * Habillage de l'antenne — repris du modèle BINGO 2.0 (jeu-main).
 * Violet profond, Impact, cases rouges, caméra en chroma bleu pur.
 */
export function themeNeuf() {
  return {
    logo: null,              // image téléversée (data URL) ; null = pas de logo

    // Couleur d'ambiance : la teinte dominante de l'antenne — blocs, cadres,
    // bandeau. L'accent sert aux mises en valeur : dernier numéro, prix,
    // figure en cours. Tout le reste s'en déduit.
    ambiance: "#4a1f7a",
    accent: "#ffd700",
    marquage: "#c8102e",     // les numéros sortis, sur le tableau

    fondHaut: "#080313",     // dégradé du fond, du plus foncé…
    fondMilieu: "#140928",
    fondBas: "#2a1456",      // …au plus clair
    fondAngle: 135,
    halo: true,              // réflecteur de scène blanc venant du haut
    texture: true,           // texture pointillée en diagonale
    chroma: "#0033cc",       // bleu d'incrustation — animateur + caméra du boulier
    chromaVisible: true,
    dateHeure: true,         // date et heure du moment dans le bandeau

    // Bandeau qui défile sous le haut de l'écran. Soit tes propres messages,
    // soit un vrai flux de nouvelles — jamais les deux mélangés.
    bandeau: {
      actif: false,
      source: "messages",    // "messages" | "rss"
      messages: [],          // une ligne = un message
      rssUrl: "",            // flux relayé par le serveur local
      vitesse: 90            // secondes pour un défilement complet
    },

    // Publicités à la place du carré d'incrustation
    pubs: {
      actif: false,
      images: [],            // data URLs ; une seule image = image fixe
      secondes: 8
    },

    // Sons — l'animateur annonce les numéros en direct, donc pas de voix
    sons: {
      ding: true,            // à chaque boule envoyée
      fanfare: true,         // à l'annonce d'un gagnant
      musique: false,        // fond musical aléatoire
      volumeMusique: 0.15,
      volumeEffets: 0.55
    },

    // Génériques de début et de fin
    generique: {
      texteDebut: "Bienvenue à votre bingo communautaire.\n\nMerci à nos commanditaires et à nos bénévoles.",
      texteFin: "Merci d'avoir joué avec nous.\n\nÀ la semaine prochaine !",
      vitesse: 60            // secondes pour un défilement complet
    }
  };
}

/**
 * Fusionne des réglages sauvegardés avec les valeurs par défaut, groupe par
 * groupe. Un `{...defaut, ...sauve}` écraserait un sous-objet entier : une
 * session enregistrée avant l'ajout des pubs perdrait alors `pubs.secondes`.
 */
export function fusionnerTheme(sauve) {
  const base = themeNeuf();
  if (!sauve || typeof sauve !== "object") return base;

  const sortie = { ...base, ...sauve };
  for (const groupe of ["bandeau", "pubs", "sons", "generique"]) {
    sortie[groupe] = { ...base[groupe], ...(sauve[groupe] ?? {}) };
  }
  return sortie;
}

/** État d'une session neuve. */
export function etatNeuf() {
  return {
    titre: "Bingo communautaire",
    telephones: [],       // un ou plusieurs numéros, affichés côte à côte
    commanditaire: "",
    theme: themeNeuf(),
    parties: [
      { nom: "Partie 1", figure: "LIGNE", lot: 100 },
      { nom: "Partie 2", figure: "X", lot: 200 },
      { nom: "Partie 3", figure: "PLEINE", lot: 500 }
    ],
    partieIndex: 0,
    tirage: [],
    enOnde: true,
    annonce: null,        // { texte } affiché en grand sur l'antenne
    verification: null,   // carte montrée à l'antenne, si l'animateur le veut
    ecran: "jeu",         // "jeu" | "debut" | "fin" — générique à l'antenne
    horodatage: [],       // [{ numero, heure }] — journal pour le rapport
    gagnants: [],         // [{ partie, figure, carte, lot, heure }]
    rssTitres: [],        // titres du flux, rafraîchis par la régie
    tic: 0                // incrémenté à chaque boule : déclenche le ding
  };
}

export function creerCanal() {
  return new BroadcastChannel(NOM_CANAL);
}

/** Régie : pousse l'état complet vers l'antenne. */
export function diffuser(canal, etat) {
  canal.postMessage({ type: "etat", etat });
}

/** Antenne : demande l'état courant (au cas où elle démarre après la régie). */
export function reclamerEtat(canal) {
  canal.postMessage({ type: "reclame" });
}

/**
 * Sauvegarde locale — pour survivre à une fermeture accidentelle en ondes.
 * Renvoie false si le stockage a refusé : l'appelant doit le dire à
 * l'opératrice, sinon elle croirait ses réglages enregistrés alors qu'ils
 * seront perdus au prochain démarrage (typiquement : trop d'images de pub).
 */
export function sauvegarder(etat) {
  try {
    localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(etat));
    return true;
  } catch {
    return false;
  }
}

export function restaurer() {
  try {
    const brut = localStorage.getItem(CLE_SAUVEGARDE);
    if (!brut) return null;
    const etat = JSON.parse(brut);
    // Fusion avec l'état neuf : une session sauvegardée par une version
    // plus ancienne ne doit pas faire planter la nouvelle.
    const fusionne = { ...etatNeuf(), ...etat, theme: fusionnerTheme(etat.theme) };

    // Le numéro unique d'avant devient le premier de la liste. Sans ça,
    // une station qui met à jour verrait son téléphone disparaître de
    // l'antenne sans comprendre pourquoi.
    if (!Array.isArray(fusionne.telephones)) fusionne.telephones = [];
    if (typeof etat.telephone === "string" && etat.telephone.trim() && !fusionne.telephones.length) {
      fusionne.telephones = [etat.telephone.trim()];
    }
    delete fusionne.telephone;

    return fusionne;
  } catch {
    return null;
  }
}

export function effacerSauvegarde() {
  try { localStorage.removeItem(CLE_SAUVEGARDE); } catch { /* sans effet */ }
}
