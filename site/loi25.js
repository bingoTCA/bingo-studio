// =====================================================================
//  Consentement — Loi 25 (Québec)
//
//  Ce site ne dépose AUCUN témoin qui lui soit propre, n'a ni mesure
//  d'audience ni pisteur. Le seul élément tiers est le formulaire Brevo,
//  chargé dans un cadre. C'est donc de lui — et de lui seul — que parle
//  ce bandeau. Un bandeau générique « nous utilisons des cookies » serait
//  faux, et un texte faux ne vaut pas mieux que pas de texte du tout.
//
//  Le cadre Brevo reste DÉSACTIVÉ tant que le visiteur n'a rien accepté :
//  c'est ce qu'exige la disposition entrée en vigueur en septembre 2023.
//  Sans consentement, aucune requête ne part vers Brevo et son adresse IP
//  ne lui est jamais transmise.
//
//  Le choix vit dans le stockage local du visiteur. Il ne remonte nulle
//  part — pas même à nous.
// =====================================================================

(function () {
  "use strict";

  var CLE = "bingo-studio-consentement";

  function lire() {
    try { return localStorage.getItem(CLE); } catch (e) { return null; }
  }
  function ecrire(valeur) {
    try { localStorage.setItem(CLE, valeur); } catch (e) { /* navigation privée */ }
  }

  // Un lien « ?revoir-consentement=1 » permet de revenir sur son choix
  // sans avoir à fouiller les réglages du navigateur.
  if (new URLSearchParams(location.search).get("revoir-consentement")) {
    try { localStorage.removeItem(CLE); } catch (e) { /* rien à faire */ }
  }

  // ------------------------------------------------------------------
  //  Le cadre Brevo : remplacé par une invitation tant qu'on n'a pas dit oui
  // ------------------------------------------------------------------

  function cadre() { return document.querySelector(".cadre-inscription"); }

  function chargerFormulaire() {
    var boite = cadre();
    if (!boite) return;
    var adresse = boite.getAttribute("data-src");
    if (!adresse || boite.querySelector("iframe")) return;

    var f = document.createElement("iframe");
    f.src = adresse;
    f.title = "Formulaire d'inscription pour recevoir le lien de téléchargement";
    boite.innerHTML = "";
    boite.classList.remove("cadre-en-attente");
    boite.appendChild(f);
  }

  function afficherInvitation() {
    var boite = cadre();
    if (!boite || boite.querySelector("iframe")) return;
    boite.classList.add("cadre-en-attente");
    boite.innerHTML =
      '<div class="cadre-invite">' +
        "<p><strong>Le formulaire d'inscription est fourni par Brevo</strong>, " +
        "un service d'envoi de courriels établi dans l'Union européenne.</p>" +
        "<p>Il ne se charge pas tant que tu ne l'as pas demandé : d'ici là, " +
        "ton adresse IP ne lui est pas transmise.</p>" +
        '<button type="button" class="bouton bouton-fort" id="btn-charger-formulaire">' +
        "Afficher le formulaire</button>" +
        '<p class="petit">Tu préfères t\'en passer ? ' +
        '<a href="mailto:marcbert@mailo.com?subject=Bingo%20Studio%20—%20le%20lien%20de%20téléchargement">' +
        "Écris-moi et je t'envoie le lien à la main.</a></p>" +
      "</div>";
    var b = document.getElementById("btn-charger-formulaire");
    if (b) b.addEventListener("click", function () { ecrire("oui"); chargerFormulaire(); });
  }

  // ------------------------------------------------------------------
  //  Le bandeau
  // ------------------------------------------------------------------

  function chemin(vers) {
    // Les pages vivent à des profondeurs différentes ; on retrouve la racine
    // du site à partir de l'adresse plutôt que de la coder en dur.
    var base = location.pathname.replace(/\/(confidentialite|telecharger|preparer-les-cartes)\/.*$/, "/");
    return base.replace(/\/$/, "/") + vers;
  }

  function bandeau() {
    var boite = document.createElement("div");
    boite.className = "loi25";
    boite.setAttribute("role", "dialog");
    boite.setAttribute("aria-label", "Renseignements personnels");
    boite.innerHTML =
      '<div class="loi25-dedans">' +
        "<div class=\"loi25-texte\">" +
          "<strong>Ce site ne te piste pas.</strong> Aucun témoin, aucune " +
          "mesure d'audience, aucun pisteur publicitaire. La seule chose que " +
          "je recueille, c'est ce que tu écris toi-même dans le formulaire " +
          "d'inscription — et ce formulaire est hébergé par Brevo, dans " +
          "l'Union européenne." +
          ' <a href="' + chemin("confidentialite/") + '">Lire le détail</a>.' +
        "</div>" +
        '<div class="loi25-boutons">' +
          '<button type="button" class="bouton" id="loi25-refuser">Ne pas charger</button>' +
          '<button type="button" class="bouton bouton-fort" id="loi25-accepter">J\'accepte</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(boite);

    function repondre(valeur) {
      ecrire(valeur);
      boite.remove();
      if (valeur === "oui") chargerFormulaire();
    }
    document.getElementById("loi25-accepter").addEventListener("click", function () { repondre("oui"); });
    document.getElementById("loi25-refuser").addEventListener("click", function () { repondre("non"); });
  }

  function demarrer() {
    var choix = lire();
    if (choix === "oui") { chargerFormulaire(); return; }
    afficherInvitation();
    if (choix !== "non") bandeau();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})();
