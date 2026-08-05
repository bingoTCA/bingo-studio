// =====================================================================
//  Le diaporama de l'accueil.
//
//  Cinq écrans du logiciel qui défilent tout seuls. Trois choses
//  comptent ici, et aucune n'est de la décoration :
//
//  1. On ne télécharge que ce qu'on montre. Les images 2 à 5 attendent
//     dans « data-src ». Chaque fois qu'on affiche un écran, on prépare
//     le suivant : il est prêt bien avant son tour.
//
//  2. Le défilement s'arrête vraiment. Au survol, au clavier, au doigt,
//     quand l'onglet passe en arrière-plan, quand le bloc sort de
//     l'écran — et par un bouton, parce qu'un texte qui bouge tout seul
//     doit pouvoir être arrêté par qui le lit lentement.
//
//  3. Les écrans cachés sont « inert » : ni tabulation, ni lecture
//     d'écran. Sinon on tabulerait dans des textes invisibles.
// =====================================================================

(() => {
  const boite = document.getElementById("diaporama");
  if (!boite) return;

  const diapos = Array.from(boite.querySelectorAll(".diapo"));
  if (diapos.length < 2) return;

  const pellicule = boite.querySelector(".diapo-pellicule");
  const pointsBoite = boite.querySelector(".diapo-points");
  const boutonPause = boite.querySelector(".diapo-pause");
  const motPause = boite.querySelector(".diapo-pause-mot");

  const DUREE = 6500;
  const doucement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let actuel = 0;
  let minuteur = null;
  let arrete = doucement;      // qui préfère moins d'animation ne défile pas
  let survole = false;
  let auClavier = false;
  let visible = true;

  boite.classList.remove("sans-js");

  // ------------------------------------------------------------------
  //  Les points, un par écran, construits à partir des titres.
  // ------------------------------------------------------------------
  const points = diapos.map((d, k) => {
    const titre = d.querySelector(".diapo-titre")?.textContent.trim() ?? `Écran ${k + 1}`;
    const p = document.createElement("button");
    p.type = "button";
    p.className = "diapo-point";
    p.setAttribute("aria-label", `Écran ${k + 1} sur ${diapos.length} : ${titre}`);
    p.addEventListener("click", () => { montrer(k); relancer(); });
    pointsBoite.appendChild(p);
    return p;
  });

  // ------------------------------------------------------------------
  //  Afficher
  // ------------------------------------------------------------------
  function charger(k) {
    const img = diapos[k]?.querySelector("img[data-src]");
    if (!img) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  }

  function montrer(k) {
    actuel = (k + diapos.length) % diapos.length;
    diapos.forEach((d, i) => {
      const actif = i === actuel;
      d.toggleAttribute("data-actif", actif);
      d.inert = !actif;
    });
    points.forEach((p, i) => p.setAttribute("aria-selected", String(i === actuel)));
    charger(actuel);
    charger((actuel + 1) % diapos.length);   // le suivant est prêt d'avance
  }

  const suivant = () => montrer(actuel + 1);
  const precedent = () => montrer(actuel - 1);

  // ------------------------------------------------------------------
  //  Le rythme
  // ------------------------------------------------------------------
  function relancer() {
    clearInterval(minuteur);
    minuteur = null;
    if (arrete || survole || auClavier || !visible) return;
    minuteur = setInterval(suivant, DUREE);
  }

  function direLEtat() {
    boutonPause.setAttribute("aria-pressed", String(arrete));
    if (motPause) motPause.textContent = arrete ? "Reprendre le défilement" : "Arrêter le défilement";
  }

  boutonPause.addEventListener("click", () => {
    arrete = !arrete;
    direLEtat();
    relancer();
  });

  boite.querySelector(".diapo-avant").addEventListener("click", () => { precedent(); relancer(); });
  boite.querySelector(".diapo-apres").addEventListener("click", () => { suivant(); relancer(); });

  // Survol : on suspend sans toucher au bouton, pour que retirer le
  // pointeur reprenne le défilement de lui-même.
  boite.addEventListener("pointerenter", () => { survole = true; relancer(); });
  boite.addEventListener("pointerleave", () => { survole = false; relancer(); });

  // Focus : on suspend seulement s'il vient du CLAVIER. Un clic à la
  // souris laisse le focus sur le bouton cliqué — sans « :focus-visible »,
  // appuyer sur « Reprendre » relançait puis resuspendait aussitôt, et
  // le diaporama restait figé jusqu'à ce qu'on clique ailleurs.
  boite.addEventListener("focusin", (e) => {
    if (!e.target.matches?.(":focus-visible")) return;
    auClavier = true;
    relancer();
  });
  boite.addEventListener("focusout", () => { auClavier = false; relancer(); });

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    relancer();
  });

  // Hors de l'écran, rien ne tourne : inutile de faire travailler la
  // machine d'une régie pendant qu'on lit le bas de la page.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden;
      relancer();
    }, { threshold: 0.15 }).observe(boite);
  }

  // ------------------------------------------------------------------
  //  Le clavier et le doigt
  // ------------------------------------------------------------------
  boite.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { precedent(); relancer(); e.preventDefault(); }
    if (e.key === "ArrowRight") { suivant(); relancer(); e.preventDefault(); }
  });

  let departX = null, departY = null;
  pellicule.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    departX = e.clientX; departY = e.clientY;
  });
  pellicule.addEventListener("pointerup", (e) => {
    if (departX === null) return;
    const dx = e.clientX - departX;
    const dy = e.clientY - departY;
    departX = departY = null;
    // Un geste franchement horizontal : sinon c'est la page qu'on fait défiler.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      dx < 0 ? suivant() : precedent();
      relancer();
    }
  });

  montrer(0);
  direLEtat();
  relancer();
})();
