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
 * Règlement de bingo télé — un point de départ général, à adapter par
 * chaque station. Les montants, les délais et le mode de paiement varient
 * d'un organisme à l'autre, et la licence est propre à chacun.
 */
const REGLEMENT_PAR_DEFAUT = `Les cartes sont en vente chez nos détaillants jusqu'au début de la diffusion.

Une carte porte un numéro de série unique. Conservez-la : c'est elle qui fait foi.

Suivez le tirage à l'écran et marquez votre carte. Les numéros sont tirés au boulier, en direct.

Dès que votre carte complète la figure annoncée, téléphonez immédiatement au numéro affiché à l'écran. Un appel reçu après le tirage de la boule suivante n'est plus recevable.

Votre numéro de carte sera vérifié en ondes avant toute annonce.

En cas de gagnants multiples sur une même figure, le lot est partagé également.

La décision de l'organisme est finale.

Le jeu est réservé aux personnes de 18 ans et plus.`;

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
      dossier: null,         // dossier choisi par la station (Electron)
      fichiers: [],          // [{ nom, url, video }] relus depuis ce dossier
      images: [],            // ancien mode : data URLs téléversées une à une
      secondes: 8,           // durée d'une IMAGE ; une vidéo joue jusqu'au bout
      // Le son pendant les pubs : celui des vidéos, ou une musique à soi.
      // Réglé une fois pour toutes ici plutôt qu'à chaque diffusion.
      son: "videos",         // "videos" | "musique" | "aucun"
      musique: null          // fiche du magasin, si son === "musique"
    },

    // Compte à rebours d'entracte : « on revient dans 5 minutes ».
    compteur: {
      musique: null,         // fiche du magasin — choisie, jamais au hasard :
                             // un rebours veut une musique qui monte
      volume: 0.55
    },

    // Sons — l'animateur annonce les numéros en direct, donc pas de voix
    sons: {
      ding: true,            // à chaque boule envoyée
      fanfare: true,         // à l'annonce d'un gagnant
      musique: false,        // fond musical aléatoire
      volumeMusique: 0.15,
      volumeEffets: 0.55
    },

    // Fond de l'antenne : une image ou une vidéo par-dessus le dégradé.
    // Sans média déposé, c'est le dégradé seul qui s'affiche.
    fondMedia: {
      image: null,           // fiche { cle, nom, type, taille }
      video: null,
      // Le logiciel est livré avec un fond, pour qu'une station branchée
      // le dimanche matin ait déjà l'air de quelque chose. Dès qu'elle
      // dépose le sien, `livre` passe à false et le fond fourni s'efface.
      livre: true,
      opacite: 0.60          // 0 = invisible, 1 = couvre le dégradé
    },

    // Génériques de début et de fin
    generique: {
      texteDebut: "Bienvenue à votre bingo communautaire.\n\nMerci à nos commanditaires et à nos bénévoles.",
      texteFin: "Merci d'avoir joué avec nous.\n\nÀ la semaine prochaine !",
      reglement: REGLEMENT_PAR_DEFAUT,
      reglementActif: true,
      musiques: [],          // fiches de fichiers audio, jouées en boucle
      volumeMusique: 0.35,
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
  for (const groupe of ["bandeau", "pubs", "sons", "generique", "fondMedia", "compteur"]) {
    sortie[groupe] = { ...base[groupe], ...(sauve[groupe] ?? {}) };
  }
  return sortie;
}

/**
 * Ce que le bandeau va réellement faire défiler — liste vide s'il ne doit
 * rien afficher. Soit tes messages, soit le flux, jamais les deux mélangés :
 * un bandeau qui alterne entre « Merci à nos commanditaires » et un titre de
 * nouvelle n'a plus de propos.
 *
 * La règle vit ici et nulle part ailleurs : l'antenne s'en sert pour
 * afficher, la régie pour te dire d'avance ce qui passera. Autrement les deux
 * finissent par ne plus dire la même chose.
 */
export function messagesDuBandeau(theme, etat = {}) {
  const b = theme?.bandeau;
  if (!b || !b.actif) return [];
  const source = b.source === "rss" ? (etat.rssTitres || []) : (b.messages || []);
  return source.map((m) => String(m).trim()).filter(Boolean);
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
    verification: null,   // carte en cours de vérification, suivie en direct
    modeVerification: false,  // le bloc de vérification remplace l'incrustation

    // Compte à rebours. On retient l'HEURE DE FIN, pas les secondes qui
    // restent : les deux fenêtres calculent le reste chacune de leur côté et
    // ne peuvent pas dériver, et un rechargement en pleine pause retrouve le
    // bon temps au lieu de repartir de zéro.
    rebours: {
      finLe: null,           // horodatage (ms) de la fin, ou null
      minutes: 5,            // durée réglée, retenue d'une fois à l'autre
      avecPubs: true,        // les pubs occupent la zone pendant l'entracte
      enGros: true           // le rebours s'affiche dans la zone d'incrustation
    },
    ecran: "jeu",         // "jeu" | "debut" | "fin" — générique à l'antenne
    horodatage: [],       // [{ numero, heure }] — journal pour le rapport
    gagnants: [],         // [{ partie, figure, carte, nom, lot, heure }]
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

    // `rebours` est un sous-objet : un « ...etat » l'écraserait en entier si
    // la session vient d'une version qui n'en avait qu'une partie.
    fusionne.rebours = { ...etatNeuf().rebours, ...(etat.rebours ?? {}) };

    return fusionne;
  } catch {
    return null;
  }
}
