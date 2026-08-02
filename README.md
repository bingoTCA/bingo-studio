# Bingo Studio

Régie de bingo télé. Le boulier reste devant la caméra — le logiciel ne tire
rien. Il fait les deux choses qui font mal en direct : **l'habillage à
l'antenne** et **la vérification d'une carte au téléphone**.

Catalogue de **50 000 cartes libres de droits**, vérification instantanée contre les
numéros déjà sortis.

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
| **Publicités** | Images téléversées, réduites en JPEG 1280×720. Délai entre les changements réglable. Une seule image reste fixe |
| **Sons** | Clochette, fanfare, musique, et les deux volumes |
| **Fond de l'antenne** | Une **image** ou une **vidéo MP4 en boucle** par-dessus le dégradé, avec réglage de transparence. Sans média, le dégradé s'affiche seul |
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

## Vérifier une carte

Tape le numéro de carte (1 à 50 000). Verdict immédiat : **gagnante**, ou
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

## La base de cartes — scellée

`data/cartes.json` porte **50 000 cartes, numérotées de 1 à 50 000**, générées
avec la graine `bingo-studio 2026`. Elle est **libre de droits pour les
télévisions communautaires autonomes**.

**Cette base ne change jamais, et c'est essentiel.** Les cartes papier vivent
des années dans les salles ; si la carte n° 4321 portait d'autres numéros après
une mise à jour, toutes celles déjà vendues deviendraient fausses et la
vérification en ondes donnerait de mauvais verdicts. Trois garde-fous :

1. **L'empreinte.** `data/cartes.manifeste.json` consigne le SHA-256 du
   fichier. `npm test` le recalcule à chaque exécution : un seul octet modifié
   fait échouer les tests, avant la diffusion et non devant public.
2. **La graine.** À graine égale, le générateur reproduit la base
   *rigoureusement* à l'identique — vérifié : régénérer avec
   `bingo-studio 2026` redonne un fichier identique octet pour octet. La base
   est donc reconstructible même si le fichier était perdu.
3. **La numérotation.** De 1 à 50 000, sans trou. (Il n'y a pas de carte n° 0 :
   une série commence à 1.)

### D'où viennent ces numéros

Ils ne sont **repris à personne** : ni à Bingo Vézina, ni à aucun autre
fournisseur. Ils sortent de `scripts/generer-cartes.mjs`.

La graine (`bingo-studio 2026`) est hachée en FNV-1a pour donner un entier de
départ, qui alimente un générateur **mulberry32** — un PRNG de 32 bits en
quelques lignes, déterministe et sans dépendance. Pour chaque carte on y puise
5 numéros dans 1-15 (colonne B), 5 dans 16-30 (I), 4 dans 31-45 (N, centre
libre), 5 dans 46-60 (G), 5 dans 61-75 (O). Chaque carte est validée puis
comparée aux précédentes par signature, pour qu'aucune ne se répète.

Conséquence pratique : **ces numéros de série ne valent que pour ce logiciel**.
La carte n° 4321 d'ici et celle d'un autre fournisseur portent le même chiffre
et deux grilles sans rapport. Vérifier une carte achetée ailleurs afficherait
la mauvaise grille et donnerait un mauvais verdict en ondes.

**Étendre une base ne casse rien.** Vérifié : régénérer de 1 à 50 000 avec la
même graine redonne les 10 000 premières cartes *à l'identique* — le générateur
avance séquentiellement, donc une base plus courte est un préfixe exact de la
plus longue. Une station peut donc passer à une base plus grande sans invalider
les cartes déjà imprimées.

Tu n'as donc **rien à régénérer**. Après un changement volontaire, resceller :

```bash
npm run sceller -- --graine="bingo-studio 2026"
```

## Imprimer les cartes

```bash
npm run feuilles -- --par-feuille=3 --pdf
```

Produit `data/feuilles-3-grilles.html` **et le PDF** à envoyer à l'imprimeur.

| Option | Rôle |
|---|---|
| `--par-feuille=N` | 1, 2, 3, 4, 6, 9, 12 ou 18 grilles par feuille |
| `--de=N --a=N` | ne monter qu'une tranche de la base |
| `--format=NOM` | Letter (défaut), Legal ou A4 |
| `--couleur=#HEX` | couleur des blocs B-I-N-G-O (défaut noir) — une par série pour les distinguer |
| `--graine=TEXTE` | graine de répartition, à noter |
| `--pdf` | produit le PDF (rendu par Electron, aucune bibliothèque en plus) |

**Les numéros de série sont éparpillés.** Une feuille ne porte jamais 1-2-3,
mais par exemple 24, 27, 6 : la liste complète est brassée avant d'être
découpée en feuilles. Un acheteur ne peut pas deviner ce qu'il aura, et les
grilles voisines ne se retrouvent pas dans la même main. À graine égale la
répartition est identique — un lot perdu se réimprime à l'identique.

**Seuls les blocs B-I-N-G-O prennent la couleur.** Le papier reste blanc et les
carreaux noir sur blanc : c'est ce qui s'imprime le mieux, coûte le moins cher
en encre et se lit de plus loin. L'encre des lettres bascule toute seule entre
noir et blanc selon la luminance du fond choisi — un jaune vif ne donnera pas
des lettres blanches illisibles.

La mention de droits du manifeste est imprimée au bas de chaque feuille.

### Plus de 50 000 numéros de série

Une station qui écoule beaucoup de cartes peut en vouloir davantage. Générer
une base plus grande ne pose aucun problème de fond : il existe environ
**5,5 × 10²⁶** cartes de bingo distinctes, donc les collisions sont
impensables. Mesuré sur cette machine :

| Cartes | Fichier | Temps |
|---|---|---|
| 10 000 | 878 Ko | 0,11 s |
| 50 000 | 4,3 Mo | 0,30 s |
| 200 000 | 17 Mo | 1,12 s |
| 500 000 | 44 Mo | 2,85 s |

La limite n'est pas la génération mais la **mémoire du navigateur** : le
catalogue entier est chargé pour la vérification en ondes. Jusqu'à 50 000, rien
à signaler. Au-delà de 200 000, il faudrait charger la base par tranches.

> **Format du papier.** Le PDF sort en Letter 8,5 × 11 po par défaut. Je n'ai
> pas trouvé de source fiable sur les formats de papier de bingo en usage au
> Québec — les fournisseurs nord-américains vendent du 3-on, 6-on, 9-on
> jusqu'à 18-on, en séries numérotées 1–9 000, 9–18 000, 18–27 000, mais sans
> dimension publiée. **À confirmer avec ton imprimeur** avant un gros tirage :
> `--format` et `--par-feuille` s'ajustent en conséquence.

## Regénérer une base (si un jour tu en veux une autre)

Pour ne plus dépendre du fichier acheté — et posséder tes numéros.

```bash
npm run cartes -- --graine="ma graine" --debut=1 --fin=50000
```

Ça produit deux fichiers dans `data/` :

| Fichier | Pour qui |
|---|---|
| `cartes-nouvelles.json` | le logiciel |
| `cartes-nouvelles.csv` | **l'imprimeur** — même format que `A09036original.csv` |

**Note ta graine.** À graine égale, la base produite est rigoureusement
identique : tu peux la régénérer si le fichier est perdu, et montrer à la
Régie qu'elle n'a pas été bricolée après coup. Une graine différente donne une
base entièrement différente.

Le générateur refuse d'écrire quoi que ce soit tant que tout n'est pas
irréprochable : 24 numéros distincts par carte, case centrale libre, chaque
colonne dans sa plage (B 1-15, I 16-30, N 31-45, G 46-60, O 61-75), et
**aucune carte identique à une autre** — deux cartes jumelles, ce sont deux
gagnants en même temps.

Pour basculer sur une nouvelle base :

```bash
npm run cartes -- --graine="AUTRE GRAINE" --fin=50000 --installer
npm run sceller -- --graine="AUTRE GRAINE"
```

L'ancienne base est copiée dans `data/cartes-precedentes.json` avant d'être
remplacée. ⚠️ À ne faire qu'avec les cartes imprimées depuis le **nouveau**
CSV : les anciennes cartes papier ne correspondront plus.

Autres options : `--sortie=CHEMIN`, `--sans-csv`, `--aide`.


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

Vérifie les figures, la case libre, la détection de gagnant, l'intégrité des
Les 50 000 cartes et les refus de saisie. Une erreur de détection de gagnant est une
erreur devant public : lance-les avant chaque diffusion.

## Empaqueter

```bash
npm run dist:mac    # .dmg
npm run dist:win    # .exe
```

Sans signature, macOS affiche « développeur non identifié » et Windows
SmartScreen avertit. Pour distribuer à d'autres stations, il faut un compte
Apple Developer (99 $ US/an) et un certificat Windows.
