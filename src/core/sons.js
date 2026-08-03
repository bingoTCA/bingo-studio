// =====================================================================
//  Sons — repris de BINGO 2.0, réduit à ce qu'un bingo télé demande.
//
//  Pas de voix qui annonce les numéros : l'animateur le fait en direct,
//  devant la caméra. C'est la conclusion tirée dans BINGO 2.0 en juin 2026,
//  et elle vaut encore plus ici puisque le boulier est filmé.
//
//  Il reste trois choses :
//    ding     — confirme qu'une boule est partie à l'antenne
//    fanfare  — à l'annonce d'un gagnant
//    musique  — fond aléatoire, volume bas pour ne pas couvrir l'animateur
// =====================================================================

const DING = "/assets/sons/ding.mp3";
const FANFARE = "/assets/sons/winner.mp3";
const PISTES = [1, 2, 3, 4, 6, 7, 8].map((n) => `/assets/musiques/${n}.mp3`);

let volumeEffets = 0.55;
let volumeMusique = 0.15;

let audioDing = null;
let audioFanfare = null;
let audioFond = null;
let sacRestant = [];        // pistes pas encore jouées dans ce cycle
let musiqueVoulue = false;

export function reglerVolumes({ effets, musique }) {
  if (typeof effets === "number") volumeEffets = Math.max(0, Math.min(1, effets));
  if (typeof musique === "number") volumeMusique = Math.max(0, Math.min(1, musique));
  if (audioFond) { try { audioFond.volume = volumeMusique; } catch { /* sans effet */ } }
}

function jouer(chemin, volume, precedent) {
  // On coupe l'occurrence précédente : deux boules rapprochées ne doivent
  // pas empiler deux dings qui se chevauchent.
  try { if (precedent) precedent.pause(); } catch { /* sans effet */ }
  const a = new Audio(chemin);
  a.volume = volume;
  // Un navigateur peut refuser de jouer sans geste de l'utilisateur : on
  // laisse tomber silencieusement plutôt que de polluer la console en ondes.
  a.play().catch(() => {});
  return a;
}

export function ding() { audioDing = jouer(DING, volumeEffets, audioDing); }
export function fanfare() { audioFanfare = jouer(FANFARE, volumeEffets, audioFanfare); }

// ---------------------------------------------------------------------
//  Musique de fond — sac sans répétition : chaque piste passe une fois
//  par cycle, on ne réentend pas deux fois la même de suite.
// ---------------------------------------------------------------------

function melanger(liste) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function pisteSuivante() {
  if (!sacRestant.length) sacRestant = melanger(PISTES);
  return sacRestant.pop();
}

function enchainer() {
  if (!musiqueVoulue) return;
  audioFond = new Audio(pisteSuivante());
  audioFond.volume = volumeMusique;
  audioFond.onended = enchainer;
  audioFond.play().catch(() => {});
}

export function demarrerMusique() {
  if (musiqueVoulue) return;
  musiqueVoulue = true;
  enchainer();
}

export function arreterMusique(fondu = 800) {
  musiqueVoulue = false;
  const a = audioFond;
  audioFond = null;
  if (!a) return;

  const pas = Math.max(1, Math.round(fondu / 50));
  let restant = pas;
  const minuterie = setInterval(() => {
    restant--;
    try {
      a.volume = Math.max(0, a.volume * (restant / (restant + 1)));
      if (restant <= 0) { clearInterval(minuterie); a.pause(); }
    } catch {
      clearInterval(minuterie);
    }
  }, 50);
}

export function musiqueEnCours() { return musiqueVoulue; }

// ---------------------------------------------------------------------
//  Musique d'attente pendant une vérification de carte
//
//  Ce n'est PAS du fond sonore : pendant qu'on vérifie, l'animateur ne dit
//  rien et le téléspectateur n'entendrait que du silence. La musique occupe
//  ce temps-là, donc elle se joue franchement plus fort.
//
//  Elle suspend le fond sonore le temps de la vérification, puis le rend.
// ---------------------------------------------------------------------

let audioAttente = null;
let fondSuspendu = false;

export function musiqueAttente(actif, volumeFond = 0.15) {
  if (actif) {
    if (audioAttente) return;
    if (musiqueVoulue) { fondSuspendu = true; arreterMusique(300); }

    // Trois fois le volume du fond, jamais sous 0,45 : le fond est réglé
    // pour se faire oublier, l'attente doit s'entendre.
    audioAttente = new Audio(pisteSuivante());
    audioAttente.volume = Math.min(1, Math.max(0.45, volumeFond * 3));
    audioAttente.onended = () => {
      if (!audioAttente) return;
      audioAttente.src = pisteSuivante();
      audioAttente.play().catch(() => {});
    };
    audioAttente.play().catch(() => {});
    return;
  }

  const a = audioAttente;
  audioAttente = null;
  if (a) { a.onended = null; try { a.pause(); } catch { /* déjà arrêtée */ } }
  if (fondSuspendu) { fondSuspendu = false; demarrerMusique(); }
}

export function attenteEnCours() { return audioAttente !== null; }

/** Coupe tout, immédiatement — utilisé quand l'antenne est coupée. */
export function toutCouper() {
  musiqueAttente(false);
  fondSuspendu = false;
  arreterMusique(0);
  for (const a of [audioDing, audioFanfare]) {
    try { if (a) a.pause(); } catch { /* sans effet */ }
  }
}
