// =====================================================================
//  Magasin de médias — musiques, images et vidéos de fond.
//
//  POURQUOI PAS localStorage : sa réserve tourne autour de 5 Mo, et il ne
//  garde que du texte. Un MP3 en fait déjà 4, une vidéo de fond dix fois
//  plus. IndexedDB accepte des fichiers bruts et dispose d'une réserve
//  qui se compte en gigaoctets.
//
//  L'ÉTAT NE TRANSPORTE QU'UNE CLÉ. Le fichier reste au magasin ; la régie
//  y dépose, l'antenne y relit. Les deux fenêtres partagent la même origine,
//  donc le même magasin — exactement comme pour BroadcastChannel.
// =====================================================================

const BASE = "bingo-studio-medias";
const RAYON = "fichiers";
const VERSION = 1;

let connexion = null;

function ouvrir() {
  if (connexion) return connexion;
  connexion = new Promise((resolve, reject) => {
    const demande = indexedDB.open(BASE, VERSION);
    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains(RAYON)) db.createObjectStore(RAYON);
    };
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(demande.error);
    // onblocked : une autre copie du logiciel tient le magasin. Sans ce
    // renvoi, la demande n'aboutit NI ne rate — elle attend pour toujours, et
    // l'import reste figé sans le moindre message.
    demande.onblocked = () => reject(new Error(
      "Le magasin de médias est retenu par une autre fenêtre de Bingo Studio. " +
      "Ferme les autres copies, puis réessaie."
    ));
  });
  // Une ouverture ratée ne doit pas condamner les suivantes : on oublie la
  // promesse en échec pour qu'un nouvel essai reparte à zéro.
  connexion.catch(() => { connexion = null; });
  return connexion;
}

function transaction(mode, action) {
  return ouvrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(RAYON, mode);
    const demande = action(tx.objectStore(RAYON));
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(demande.error);
  }));
}

/** Clé courte et unique, sans Math.random pour rester lisible dans le journal. */
let compteur = 0;
function nouvelleCle(prefixe) {
  compteur++;
  return `${prefixe}-${Date.now().toString(36)}-${compteur}`;
}

/**
 * Dépose un fichier et renvoie sa fiche : { cle, nom, type, taille }.
 * C'est cette fiche — et elle seule — qui va dans l'état de la session.
 */
export async function deposer(prefixe, fichier) {
  const cle = nouvelleCle(prefixe);
  await transaction("readwrite", (rayon) => rayon.put(fichier, cle));
  return { cle, nom: fichier.name, type: fichier.type, taille: fichier.size };
}

/**
 * Dépose un fichier sous une clé imposée. Sert à la réimportation : les
 * réglages exportés désignent leurs médias par clé, donc il faut pouvoir les
 * remettre exactement là où ils étaient.
 */
export async function deposerSous(cle, fichier) {
  await transaction("readwrite", (rayon) => rayon.put(fichier, cle));
  return { cle, nom: fichier.name || cle, type: fichier.type, taille: fichier.size };
}

export async function lire(cle) {
  if (!cle) return null;
  try { return (await transaction("readonly", (r) => r.get(cle))) ?? null; }
  catch { return null; }
}

export async function retirer(cle) {
  if (!cle) return;
  try { await transaction("readwrite", (r) => r.delete(cle)); } catch { /* déjà parti */ }
}

/**
 * Adresse utilisable dans <audio>, <video> ou background-image.
 * L'appelant doit libérer l'adresse avec `libererUrl` quand il n'en a plus
 * besoin — sinon le fichier reste en mémoire tant que la page vit.
 */
export async function urlDe(cle) {
  const fichier = await lire(cle);
  return fichier ? URL.createObjectURL(fichier) : null;
}

export function libererUrl(url) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

/** Place occupée par le magasin, pour l'afficher dans les Paramètres. */
export async function placeOccupee() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { utilise: usage ?? 0, total: quota ?? 0 };
  } catch {
    return { utilise: 0, total: 0 };
  }
}

export function formaterTaille(octets) {
  if (!octets) return "0 o";
  const unites = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(unites.length - 1, Math.floor(Math.log(octets) / Math.log(1024)));
  const valeur = octets / Math.pow(1024, i);
  return `${valeur.toFixed(valeur < 10 && i > 0 ? 1 : 0)} ${unites[i]}`;
}
