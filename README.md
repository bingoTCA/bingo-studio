# Bingo Studio

Régie de bingo télé. Le boulier reste devant la caméra — le logiciel ne tire
rien. Il fait les deux choses qui font mal en direct : **l'habillage à
l'antenne** et **la vérification d'une carte au téléphone**.

**Compatible avec les cartes papier Arrow Games** (Capitol™, Bingo Vézina) :
les séries 1–9 000 et 27 001–34 200 sont déjà dans le logiciel, vérification
instantanée contre les numéros déjà sortis.

Offert gratuitement aux organismes communautaires. Un projet personnel de
Marc Bert.

---

## Lancer

```bash
npm install
npm start
```

Deux fenêtres s'ouvrent :

| Fenêtre | Pour qui | Quoi |
|---|---|---|
| **Régie** | l'opératrice | saisie du boulier, vérification, réglages |
| **Antenne** | le téléviseur | boule, tableau 1-75, figure, lot, commandite |

Pour arrêter : ferme la fenêtre **Régie** (la fenêtre Antenne, elle, refuse de
se fermer par accident pendant que tu es en ondes — elle se cache).

## Contrôles antenne — les gestes du direct

Bloc **Contrôles antenne** dans la Régie. Tout est instantané.

| Bouton | Effet |
|---|---|
| **Générique de début / de fin** | Plein écran sur l'antenne, texte qui remonte. Recliquer revient au jeu |
| **Retour au jeu** | Coupe le générique |
| **Passer aux pubs** | Les images remplacent le carré d'incrustation, à la même place |
| **Musique** | Musique de fond, volume bas pour ne pas couvrir l'animateur |
| **Son régie** | La clochette de confirmation sur **ta** machine — indépendante de ce qui part à l'antenne |

Le générique de début reprend automatiquement les **prix du jour** et le
**règlement**, celui de fin les **gagnants de la session**, le commanditaire et
les téléphones. Il tourne en boucle tant que tu ne reviens pas au jeu, avec une
musique tirée au hasard parmi celles que tu as déposées.

Le **règlement** est fourni avec un texte général de bingo télé — cartes en
vente chez les détaillants, appel immédiat, vérification en ondes, partage des
lots, 18 ans et plus. À adapter : les montants, les délais et la licence sont
propres à chaque organisme.

## L'entracte

Bloc **Contrôles antenne** : une durée en minutes, un bouton, deux cases.

Un bingo télé a des pauses, et pendant ce temps l'écran ne dit rien. Un compte
à rebours visible, c'est une pratique de vraie télé : le monde sait combien de
temps attendre et ne change pas de poste.

- **Passer les publicités pendant l'entracte** — la pause se remplit avec le
  contenu des commanditaires. Un temps mort devient un temps payé.
- **Afficher le rebours à l'antenne** — il apparaît en **pastille dans un
  coin** tant que les pubs tournent, puis **en grand au centre dans la
  dernière minute**. C'est ce que font les chaînes avant un retour de pause :
  les commanditaires gardent leur temps d'antenne complet, et personne ne rate
  la reprise.

À zéro, les publicités s'arrêtent et l'incrustation revient toute seule.

Le rebours retient une **heure de fin**, pas un nombre de secondes qui
décroît. Les deux fenêtres calculent le reste chacune de leur côté : elles ne
peuvent pas dériver, et un redémarrage en pleine pause retrouve le bon temps
au lieu de repartir de zéro.

## Sons

Trois sons : la **clochette** à chaque boule, la **fanfare** à l'annonce d'un
gagnant, et une **musique de fond** tirée au hasard parmi 7 pistes (sac sans
répétition : aucune ne repasse avant que les autres soient sorties).

Pas de voix qui annonce les numéros : l'animateur le fait en direct, devant la
caméra — et le boulier est filmé.

Quand l'antenne est coupée, **tout se tait**. Et l'antenne ne sonne jamais en
s'ouvrant sur une partie déjà commencée.

## Paramètres (dans la Régie)

Bouton **Paramètres**, en haut à droite. Tout part à l'antenne immédiatement.

| Réglage | Ce que ça fait |
|---|---|
| **Logo** | Téléversé, réduit automatiquement à 400 px max, affiché en haut à gauche |
| **Couleurs** | Une **couleur d'ambiance** donne le ton à tous les blocs et cadres ; un **accent** pour les mises en valeur ; la couleur des **numéros sortis**. Tout le reste s'en déduit |
| **Couleur de fond** | Trois teintes du dégradé + angle, avec aperçu. Bouton « Accorder le fond à l'ambiance » |
| **Halo · texture** | Le réflecteur de scène et la texture pointillée, désactivables |
| **Zone caméra** | La couleur d'incrustation — bleu pur par défaut, vert si ta régie key en vert. Masquable |
| **Date et heure** | Heure du Québec, quelle que soit la machine. Masquable |
| **Bandeau défilant** | Au choix : **tes messages** (un par ligne) **ou** un vrai **flux RSS**. Jamais les deux mélangés. Durée du passage réglable |
| **Publicités** | Un **dossier** sur l'ordinateur : le logiciel y prend images et vidéos et les passe en boucle. Les images tiennent le délai réglé, les vidéos jouent jusqu'au bout. Format conseillé 1920 × 1080 |
| **Sons** | Clochette, fanfare, musique, et les deux volumes |
| **Son des publicités** | Celui des vidéos, une musique à soi, ou le silence — réglé une fois pour toutes plutôt qu'à chaque diffusion |
| **Musique du rebours** | Une pièce **choisie**, jamais tirée au hasard : un compte à rebours veut une musique qui monte. Entrée et sortie en fondu |
| **Fond de l'antenne** | Un fond est **livré avec le logiciel**, à 60 % de transparence. Remplaçable par une **image** ou une **vidéo MP4 en boucle** ; « Retirer le fond » rend le dégradé seul |
| **Génériques** | Textes de début et de fin, **règlement du bingo**, **musiques** jouées en boucle, vitesse de défilement |
| **Textes** | Titre, **un ou plusieurs téléphones** (côte à côte dans le même bloc), mention de commandite |
| **Parties** | Nom, figure et lot de chaque partie de la session |
| **Sauvegarde** | Exporte tous les réglages dans un fichier `.json`, médias compris, et les réimporte sur une autre machine |

Le **flux RSS** est chargé par le serveur local, pas par le navigateur : sans
ce relais, le navigateur bloquerait la requête (CORS). Seuls les titres des
articles sont extraits. Clique « Charger » pour rafraîchir.

Cocher **Afficher le bandeau** ne suffit pas : sans message écrit — ou sans
flux chargé —, l'antenne n'affiche rien. Une ligne sous la case dit d'avance
ce qui va défiler, et vire à l'ambre quand la réponse est « rien ». Le texte
gris dans le champ des messages est un exemple, pas du contenu.

### Sauvegarder ses réglages

**Paramètres → Sauvegarder tes réglages**. Le fichier emporte l'habillage, les
parties, les textes, le logo, les pubs, et **les fichiers du magasin de
médias** — musiques et fond — encodés dans le JSON. Sans eux, une
réinstallation ne récupérerait que des renvois vers des fichiers absents.

Ce qui ne voyage **pas** : la soirée en cours — numéros tirés, gagnants,
horodatage. Ce sont les traces d'un bingo précis. Importer par-dessus une
partie en cours ne l'efface donc pas ; la confirmation le rappelle.

Un média que le fichier ne porte pas est **retiré du réglage et nommé** dans le
message de fin, plutôt que laissé à pointer dans le vide.

La **couleur d'ambiance** est le seul réglage qui compte vraiment : elle
recolore les blocs, les cadres, le bandeau et la colonne des lettres d'un coup.
Le fond ne la suit pas automatiquement — ce serait écraser sans prévenir un
dégradé réglé à la main — mais un bouton l'accorde en un geste.

**Où vont les fichiers.** Le logo et les images de pub sont enregistrés dans le
navigateur, dont la réserve tourne autour de 5 Mo — si tu en mets trop, la Régie
te le dit au lieu de perdre tes réglages en silence.

Les **musiques et les fonds vidéo**, eux, vont dans un magasin séparé
(`src/core/medias.js`) qui se compte en gigaoctets. La session ne garde qu'une
référence : une musique de 200 Ko déposée laisse la sauvegarde à 4 Ko.

L'habillage appartient à la station, pas à la session : « Réinitialiser le
jeu » efface les numéros et les gagnants, mais **garde le logo et les
couleurs**.

### Les publicités viennent d'un dossier

La station choisit un dossier sur son ordinateur. Le logiciel y prend les
images et les vidéos et les passe en boucle tant qu'on n'a pas repris
l'antenne. Elle remplace ses pubs en **déposant des fichiers**, sans rouvrir le
logiciel ni rien réimporter — réimporter une à une chaque semaine, c'est une
corvée qu'on finit par ne plus faire.

- Les **images** tiennent le nombre de secondes réglé.
- Les **vidéos** jouent **jusqu'au bout** avant de passer à la suivante :
  couper une pub payée au milieu, c'est fâcher le commanditaire. Elles sont
  muettes — le son de l'antenne appartient au bingo.
- L'**ordre suit les noms de fichiers**. Nommer `01-…`, `02-…` suffit à le
  maîtriser.
- Format conseillé **1920 × 1080**. Un fichier d'un autre format s'affiche en
  entier sur fond noir plutôt que rogné : une pub tronquée, c'est un
  commanditaire mécontent.

Le serveur local sert ce dossier — et lui seul — sur `/pubs/`. Il ne retient
que le nom de base : un `../../` dans l'adresse ne remonte nulle part.

## Envoyer l'antenne à la diffusion

Trois façons, toutes prêtes :

1. **Écran secondaire ou recopie d'écran** — bouton « Envoyer l'antenne… »,
   choisis l'écran, elle passe en plein écran dessus.
2. **OBS ou Tricaster** — ajoute une **source navigateur** sur
   `http://127.0.0.1:7777/antenne`. Pour incruster par-dessus le plateau sans
   fond noir : `http://127.0.0.1:7777/antenne?fond=transparent`.

   L'adresse exacte est rappelée dans **Paramètres → Diffusion**. Si le port
   7777 était déjà pris, l'application prend le suivant toute seule — c'est
   l'adresse affichée là qui fait foi.
3. **Sans installer l'application** — lance juste le serveur, puis ouvre les
   deux adresses dans un navigateur et fais `F11` sur celle de l'antenne.

## L'écran de la Régie

Tout tient sur un écran, sans défiler. En haut **le tableau 1 à 75, le même
qu'à l'antenne** — tu vois exactement ce que voit le public. Sous le tableau,
la ligne de service : saisie, « Annuler le dernier », compteurs et ordre de
sortie. Puis, côte à côte : la **vérification de carte** à gauche, les
**contrôles antenne** et la **partie en cours** à droite.

Les **Paramètres** sont une page à part : elle couvre la régie, avec sa propre
barre — « ← Revenir à la régie » et « Enregistrer et revenir ». Les réglages
s'appliquent au fil de la saisie ; « Enregistrer » force l'écriture et
confirme, pour ne pas quitter dans le doute.

Deux façons d'envoyer un numéro, au choix de l'opératrice :

| Geste | Effet |
|---|---|
| **Clic** sur une case du tableau | l'allume et l'envoie à l'antenne, tout de suite |
| **Second clic** sur la même case | l'éteint et la retire |
| Taper le numéro puis **Entrée** | l'envoie à l'antenne |
| **Échap** | efface ce qui est tapé, sans rien envoyer |
| **Cmd/Ctrl + Z** | retire le dernier numéro du tableau |
| **F1** | revient sur la saisie du boulier |
| **F2** | saute à la vérification de carte |

Le tableau est une **bascule** : un clic allume, un clic éteint. Pas de
confirmation — en direct, on suit le boulier et on n'a pas le temps. Le
rattrapage d'un clic malheureux est donc un simple reclic sur la même case.
Au survol, la couleur annonce ce que le clic va faire : jaune pour allumer,
rouge sombre pour éteindre.

La **saisie au clavier**, elle, garde sa confirmation : tu vois « G 54 » en
gros avant d'appuyer sur Entrée. Un numéro déjà sorti ou hors de 1-75 est
refusé avec un message, et le téléviseur ne bouge pas.

## Les parties

En régie, le bloc **Partie en cours** donne les puces pour changer de partie,
la figure et le lot de celle qui joue. La liste complète est dans
**Paramètres → Les parties** : chaque télé communautaire a sa formule, alors
tout est modifiable — ajouter, renommer, choisir la figure parmi les 11, fixer
le lot, réordonner avec ↑ ↓, supprimer.

Les parties, les textes et l'habillage appartiennent à la **station**, pas à la
session : « Réinitialiser le jeu » efface les numéros et les gagnants, mais tu
retrouves ta formule telle quelle à la prochaine ouverture.

## Vérifier une carte à l'antenne

Bouton **Vérification**. Le carré d'incrustation disparaît et laisse la place à
un bloc *Vérification de la carte*, au centre de l'écran, aux couleurs de
l'ambiance de la station.

Il **suit la frappe en direct** : le numéro se compose à l'écran pendant que
l'opératrice le tape, puis la carte apparaît avec ses numéros déjà sortis et le
verdict. C'est ce qui remplace la voix de l'animateur, qui n'a rien à dire
pendant qu'on cherche.

Une **musique part en même temps**, à trois fois le volume du fond sonore. Sans
elle, le téléspectateur n'entendrait rien du tout pendant la recherche. Elle
suspend le fond et le rend au retour.

**Retour à l'antenne** referme le bloc et rend l'incrustation.

### Plusieurs gagnants sur une même partie

**Valider le gagnant** l'ajoute au bloc *Gagnants*. Le lot de la partie se
divise entre tous ses gagnants et **se recalcule à chaque ajout** : le premier
annoncé voit sa part diminuer quand un deuxième appelle. C'est la règle
habituelle du bingo, et elle est écrite dans le règlement livré par défaut.

Sans nom saisi, c'est le numéro de carte qui s'affiche. Une même carte validée
deux fois est refusée — c'est un double clic, pas un deuxième gagnant.

La liste se **resserre par paliers** à mesure qu'elle s'allonge. Un bingo peut
faire quinze gagnants dans une soirée et le bloc a une hauteur fixe : dix noms
un peu petits valent mieux que six gros et quatre invisibles.

## Vérifier une carte

Tape le numéro de série de la carte. Verdict immédiat : **gagnante**, ou
**il reste N cases**. La grille montre les cases marquées et surligne la figure
retenue en jaune.

- **Montrer à l'antenne** — affiche la carte dans le coin, et elle se met à
  jour toute seule au fil des tirages.
- **Annoncer le gagnant** — refusé si la carte n'est pas réellement gagnante.
  Tu peux saisir le **nom du gagnant** : il s'affiche en grand à l'antenne avec
  son numéro de carte, dans le bloc des gagnants — donc visible dès qu'aucune
  carte n'est montrée. Le nom est consigné dans le rapport de session.

## Le rapport de session

Réglages → **Rapport de session**. Ouvre une page imprimable : parties, figures,
lots, gagnants avec l'heure, et les numéros tirés dans l'ordre avec leur
horodatage (heure du Québec). `Cmd+P` → « Enregistrer en PDF » pour la Régie et
pour la comptabilité.

## Ce qui est sauvegardé

La session s'enregistre à chaque geste dans le navigateur. Si l'application
ferme en plein direct, relance-la : tu retrouves les numéros déjà tirés.

**Une mise à jour n'efface rien.** Les réglages, les parties et les médias
vivent dans le dossier de données du système — `~/Library/Application
Support/bingo-studio` sur Mac, `%APPDATA%\bingo-studio` sur Windows — pas dans
l'application. Installer une nouvelle version remplace l'application seule ; le
dossier de données n'est pas touché. Vérifié : la version empaquetée ouvre
exactement le même dossier que les précédentes.

⚠️ **Mais le rangement dépend du PORT.** Le navigateur classe les données sous
l'adresse complète : `http://127.0.0.1:7777` et `http://127.0.0.1:7778` sont
deux rangements séparés. Si le port habituel est occupé et que l'application se
replie sur le suivant, l'opératrice retrouve un logiciel vierge et croit tout
avoir perdu. Deux garde-fous :

1. **Une seule copie à la fois** (`requestSingleInstanceLock`). Deux copies
   ouvertes étaient la première cause de port occupé ; une deuxième ouverture
   ramène maintenant la fenêtre existante.
2. Si le repli arrive quand même, une **boîte de dialogue** le dit au
   démarrage, explique que rien n'est perdu, et donne la nouvelle adresse pour
   OBS.

L'export des réglages reste la vraie ceinture de sécurité : un fichier gardé de
côté se réimporte n'importe où, quel que soit le port.

## Repartir à zéro

**Réinitialiser le jeu**, sous le tableau de la régie. Efface les numéros
tirés, le journal, les gagnants, et ramène à la première partie. L'habillage,
les parties et les textes restent.

Ce qui n'est **pas** touché : ce qui est en ondes à cet instant — générique ou
jeu, antenne coupée ou pas. Remettre le jeu à l'antenne pendant le générique
d'ouverture serait pire que le mal.

La confirmation énumère ce qui va disparaître (« 15 numéros du tableau et
3 gagnants ») et rappelle de sortir le rapport de session d'abord, quand il y a
des gagnants à perdre.

---

## La base de cartes — les séries papier Arrow Games

Bingo Studio est **compatible avec les cartes papier Arrow Games** (gamme
Capitol™, distribuées au Québec par Bingo Vézina). La base contient les séries
numérisées page par page à partir des cartables des télévisions communautaires :

| Série | Dans le logiciel |
|---|---|
| 1 à 9 000 | intégrée — 9 000 cartes, éprouvées en ondes depuis des années |
| 27 001 à 36 000 | en cours — 27 001 à 34 200 intégrées |
| 45 001 à 54 000 | à venir |

**16 200 cartes** aujourd'hui, **27 000** à terme.

### Vérifiée contre le papier

- Les cartes lues par OCR ont été confrontées aux pages scannées (lecture
  triple, corrections à la main consignées).
- Six cartes d'une vraie feuille Capitol™ 1-9000 — 1509, 1634, 1759, 1884,
  2009, 2134 — sont gravées dans `tests/papier.test.mjs` : 144 cases sur 144
  identiques. Une réinstallation qui décalerait une série est attrapée là.

### Une carte hors de la base

Le logiciel ne devine jamais. La régie affiche « pas dans la base — vérifie au
cartable », l'antenne « vérification au cartable » : rien qui laisse croire que
la carte est fausse. Sa série n'est simplement pas encore numérisée.

### Ajouter une série

Une télé scanne son cartable et envoie le PDF ; on le lit (chaîne OCR du
projet BINGO 1.0 v2, dossier `ocr_arrow/`), puis on installe le CSV complet :

```bash
node scripts/importer-base.mjs --csv=chemin/cartes.csv --verifier   # contrôle seul
node scripts/importer-base.mjs --csv=chemin/cartes.csv              # installe et scelle
```

Format : `carte,B1..B5,I1..I5,N1,N2,N4,N5,G1..G5,O1..O5` — la carte lue colonne
par colonne, N3 (case libre) absente ou présente. L'import refuse tout numéro
hors de sa colonne, toute case illisible, tout numéro de carte en double, et
n'installe rien tant qu'il reste un problème. Il écrit `data/cartes.json` et
`data/cartes.manifeste.json` (tranches, empreinte SHA-256).

Puis **mettre à jour la section `#cartes` du site** : `tests/site.test.mjs`
refuse une page qui annonce d'autres chiffres que ceux de la base.

### Le fichier de la base n'est pas dans ce dépôt

Les pages des séries portent la mention *« Any reproduction requires the
approved written consent of Arrow International Inc. »*. `data/cartes.json`
est donc exclu du dépôt public (`.gitignore`) : il voyage dans les
installateurs du logiciel, pas en fichier brut téléchargeable par n'importe
qui. Le manifeste, lui, est publié — on voit ce que contient la base sans la
diffuser. Pour construire le logiciel, installer d'abord la base avec
`importer-base.mjs`.

### L'impression des cartes est mise de côté

Bingo Studio a d'abord livré sa propre base de 50 000 cartes générées par
programme, avec un module d'impression. Ce projet est mis de côté : imprimer
les séries Arrow Games reviendrait à reproduire les cartes d'un fournisseur,
et les cartes se commandent chez un fournisseur licencié. Le bouton et la
section d'impression sont **masqués** dans la régie (`hidden`) —
`tests/site.test.mjs` vérifie qu'ils le restent. Le code (`src/core/feuilles.js`,
`scripts/generer-cartes.mjs`, `scripts/feuilles-cartes.mjs`) reste en place, et
l'ancienne base se régénère à l'identique avec la graine `bingo studio 2026`.

## Structure

```
main.js              fenêtres Electron + choix de l'écran de diffusion
preload.js           le seul pont Electron (écrans) — tout le reste est du web
src/server.js        mini-serveur local 127.0.0.1:7777 + relais RSS
src/core/bingo.js    logique pure : figures, gagnants, validation de saisie
src/core/canal.js    lien régie -> antenne (BroadcastChannel) + sauvegarde
src/core/sons.js     clochette, fanfare, musique de fond
src/regie/           l'écran de l'opératrice
src/antenne/         l'habillage télé
data/cartes.json     la base de cartes en service, scellée par son manifeste
scripts/             génération de la base, scellement, feuilles imprimables
site/                le site public : présentation, téléchargements, don
assets/sons/         ding.mp3, winner.mp3
assets/musiques/     7 pistes de fond
tests/               33 tests — à lancer avant chaque diffusion
```

Le dossier `src/` ne contient **aucune** API Electron hors de `preload.js`.
C'est ce qui permet au même code de tourner en logiciel, en navigateur et en
source OBS sans être écrit trois fois.

## Tests

```bash
npm test
```

Vérifie les figures, la case libre, la détection de gagnant, l'intégrité de
la base (tranches complètes, empreinte, six cartes contrôlées sur le papier),
l'accord entre le site et la base, et les refus de saisie. Une erreur de
détection de gagnant est une erreur devant public : lance-les avant chaque
diffusion.

## Empaqueter

```bash
npm run dist:mac    # .dmg
npm run dist:win    # .exe
```

Sans signature, macOS affiche « développeur non identifié » et Windows
SmartScreen avertit. Pour distribuer à d'autres stations, il faut un compte
Apple Developer (99 $ US/an) et un certificat Windows.
