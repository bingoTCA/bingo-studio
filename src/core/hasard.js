// =====================================================================
//  Hasard reproductible — partagé par le générateur de cartes et le
//  monteur de feuilles.
//
//  À graine égale, la suite produite est rigoureusement identique. C'est
//  ce qui permet de régénérer une base ou un lot de feuilles à l'identique,
//  et de montrer qu'ils n'ont pas été bricolés après coup.
// =====================================================================

/** Transforme une graine texte en entier 32 bits (FNV-1a). */
export function grainEntier(texte) {
  let h = 0x811c9dc5;
  const s = String(texte);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — court, rapide, et surtout : même graine, même suite. */
export function generateur(graine) {
  let a = grainEntier(graine);
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange une liste (Fisher-Yates), sans toucher à l'originale. */
export function melanger(liste, hasard) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}
