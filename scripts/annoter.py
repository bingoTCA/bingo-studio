#!/usr/bin/env python3
# =====================================================================
#  Les repères rouges du diaporama.
#
#  `diapos.cjs` a photographié les écrans et relevé, dans le DOM, la
#  position exacte de chaque zone. Ici on trace : un cadre rouge autour
#  de la zone, une étiquette qui dit ce que c'est, et une flèche quand
#  l'étiquette se pose loin.
#
#  Les CADRES viennent du navigateur — ils restent justes même si la mise
#  en page bouge. Les ÉTIQUETTES, elles, sont posées à la main : il n'y a
#  qu'une poignée de repères, et un placement choisi vaut mieux qu'un
#  placement calculé qui finit par cacher l'écran qu'on veut montrer.
#
#    python3 scripts/annoter.py
# =====================================================================

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "captures/diapo"          # les captures brutes, hors du site
DOSSIER = RACINE / "site/images/diapo"      # ce qui part en ligne
REFERENCE = 1920              # repère de dessin : cadres, étiquettes, flèches
LARGEUR_SORTIE = 1600         # ce que le site sert vraiment — le bloc fait 992 px
QUALITE = 82
ROUGE = (232, 32, 42)
BLANC = (255, 255, 255)
POLICE = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# ---------------------------------------------------------------------
#  Ce qu'on montre, diapo par diapo.
#
#  « zones »  : une ou plusieurs zones relevées ; plusieurs = un seul
#               cadre autour de l'ensemble.
#  « centre » : où poser l'étiquette, en fractions de l'image.
#  « fleche » : un trait de l'étiquette vers le cadre.
# ---------------------------------------------------------------------
REPERES = {
    "1-antenne-jeu.png": [
        {"zones": ["camera"],   "texte": "Ton animateur s'incruste ici",
         "centre": (0.51, 0.32)},
        {"zones": ["derniere"], "texte": "Le dernier numéro, énorme",
         "centre": (0.50, 0.50), "fleche": True},
    ],
    "2-regie.png": [
        {"zones": ["tableau"],           "texte": "Un clic par boule sortie du boulier",
         "centre": (0.50, 0.395)},
        {"zones": ["verdict", "carte"],  "texte": "Tape le numéro : gagnante ou non",
         "centre": (0.72, 0.505), "fleche": True},
    ],
    "3-verification.png": [
        {"zones": ["carte", "verdict"], "texte": "La carte, en grand, devant tout le monde",
         "centre": (0.51, 0.615)},
    ],
    "4-gagnants.png": [
        {"zones": ["gagnants"], "texte": "Deux gagnants : le lot se partage tout seul",
         "centre": (0.51, 0.34), "fleche": True},
    ],
    "5-entracte.png": [
        {"zones": ["rebours"], "texte": "L'entracte se compte tout seul",
         "centre": (0.51, 0.545)},
    ],
}


def police(taille):
    try:
        return ImageFont.truetype(POLICE, taille)
    except OSError:
        return ImageFont.load_default()


def union(boites):
    x = min(b[0] for b in boites)
    y = min(b[1] for b in boites)
    return (x, y,
            max(b[0] + b[2] for b in boites) - x,
            max(b[1] + b[3] for b in boites) - y)


def cadre(d, boite, echelle):
    x, y, l, h = boite
    e = max(2, int(6 * echelle))
    d.rounded_rectangle([x - e, y - e, x + l + e, y + h + e],
                        radius=int(14 * echelle), outline=ROUGE, width=e)


def etiquette(d, texte, centre, img, echelle):
    f = police(int(30 * echelle))
    marge = int(18 * echelle)
    g, t, dr, b = d.textbbox((0, 0), texte, font=f)
    lc = (dr - g) + 2 * marge
    hc = (b - t) + int(1.6 * marge)

    cx = centre[0] * img.width - lc / 2
    cy = centre[1] * img.height - hc / 2
    d.rounded_rectangle([cx, cy, cx + lc, cy + hc], radius=int(10 * echelle), fill=ROUGE)
    d.text((cx + marge - g, cy + int(0.8 * marge) - t), texte, font=f, fill=BLANC)
    return (cx, cy, lc, hc)


def fleche(d, depuis, vers, echelle):
    """Un trait de l'étiquette au bord du cadre, avec une pointe."""
    cx, cy, lc, hc = depuis
    x, y, l, h = vers
    x1, y1 = cx + lc / 2, cy + hc / 2
    x2, y2 = x + l / 2, y + h / 2
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return

    # Partir du bord de l'étiquette, s'arrêter au bord du cadre : une
    # flèche qui traverse les deux boîtes se lit mal.
    def bord(demi_l, demi_h):
        t = min(demi_l / abs(dx) if dx else 9e9, demi_h / abs(dy) if dy else 9e9)
        return dx * t, dy * t
    ax, ay = bord(lc / 2, hc / 2)
    bx, by = bord(l / 2 + 10 * echelle, h / 2 + 10 * echelle)
    x1, y1 = x1 + ax, y1 + ay
    x2, y2 = x2 - bx, y2 - by

    e = max(2, int(6 * echelle))
    d.line([x1, y1, x2, y2], fill=ROUGE, width=e)
    a = math.atan2(y2 - y1, x2 - x1)
    p = 24 * echelle
    for sens in (+1, -1):
        d.line([x2, y2,
                x2 - p * math.cos(a - sens * 0.45),
                y2 - p * math.sin(a - sens * 0.45)], fill=ROUGE, width=e)


def main():
    if not SOURCE.exists():
        raise SystemExit("Captures absentes. Lance d'abord :  npm run diapos")
    DOSSIER.mkdir(parents=True, exist_ok=True)
    zones = json.loads((SOURCE / "reperes.json").read_text())
    for nom, liste in REPERES.items():
        src = SOURCE / nom
        if not src.exists():
            print(f"  {nom} : image absente, ignorée")
            continue
        img = Image.open(src).convert("RGB")
        echelle = img.width / REFERENCE        # les captures sont en 2×
        d = ImageDraw.Draw(img)
        poses = 0

        for r in liste:
            boites = [zones.get(nom, {}).get(k) for k in r["zones"]]
            if not all(boites):
                manquantes = [k for k, b in zip(r["zones"], boites) if not b]
                print(f"  {nom} : zone(s) introuvable(s) — {', '.join(manquantes)}")
                continue
            boite = union(boites)
            cadre(d, boite, echelle)
            pose = etiquette(d, r["texte"], r["centre"], img, echelle)
            if r.get("fleche"):
                fleche(d, pose, boite, echelle)
            poses += 1

        sortie = DOSSIER / (src.stem + ".webp")
        img.resize((LARGEUR_SORTIE, round(img.height * LARGEUR_SORTIE / img.width)),
                   Image.LANCZOS).save(sortie, "WEBP", quality=QUALITE, method=6)
        print(f"  {sortie.name:<26} {poses} repère(s)   {sortie.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    print("Repères :")
    main()
