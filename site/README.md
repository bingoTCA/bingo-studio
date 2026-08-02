# Site de Bingo Studio

Page unique, en français, qui présente le logiciel, le donne à télécharger et
invite au don. Aucun cadriciel, aucune dépendance : trois fichiers.

```
index.html     toute la page
style.css      l'habillage
firebase.json  configuration d'hébergement
.firebaserc    le projet Firebase visé
```

## Voir la page en local

```bash
cd site && python3 -m http.server 8080
```

Puis ouvre <http://localhost:8080>.

---

## Les fichiers vont sur GitHub Releases

Gratuit, **2 Go par fichier**, et surtout **aucune limite de bande passante**.
C'est la façon normale de distribuer un logiciel de bureau.

1. Dans le dépôt GitHub (il doit être **public** pour que tout le
   monde puisse télécharger), crée une version : *Releases → Draft a new
   release*, par exemple `v1.0.0`.
2. Joins-y `Bingo Studio-1.0.0.dmg` et `Bingo Studio Setup 1.0.0.exe`.
3. Publie, puis copie les deux adresses de téléchargement.
4. Dans `index.html`, remplace les `href="#"` des deux tuiles
   `.telechargement` par ces adresses, retire `aria-disabled="true"`, et
   remplace le texte de `.tele-etat` par la version et le poids du fichier.

⚠️ **Ne jamais déposer le .dmg ni le .exe avec le site.** Une application
Electron pèse autour de 100 Mo ; sur Firebase Spark, trois téléchargements
épuiseraient le quota du jour. `firebase.json` refuse d'ailleurs de les
téléverser — c'est un garde-fou volontaire, pas un oubli.

---

## Héberger le site : deux chemins, tous deux gratuits

|  | Firebase Spark | GitHub Pages |
|---|---|---|
| Bande passante | 360 Mo/jour ≈ 11 Go/mois | **100 Go/mois** |
| Taille du site | 10 Go | 1 Go |
| Domaine perso + HTTPS | oui | oui |

Le site pèse une vingtaine de kilo-octets : les deux suffisent très largement.

### GitHub Pages — recommandé

Puisque les fichiers sont déjà sur GitHub, tout vit au même endroit et il n'y a
qu'un compte à gérer. `.github/workflows/site.yml` publie le dossier `site/`
à chaque poussée sur `main`.

À activer une seule fois : dépôt → **Settings → Pages → Source = GitHub
Actions**. Le site sort ensuite sur
`https://<compte>.github.io/<depot>/`, ou sur ton propre domaine.

### Firebase Spark — si tu préfères rester chez Firebase

```bash
firebase login          # une seule fois
firebase use --add      # choisir le projet
firebase deploy
```

**Crée un projet neuf sur Spark**, dédié à Bingo Studio. N'ajoute pas le site
à un projet Firebase déjà en **Blaze** : là-bas, un dépassement se traduirait
par une **facture** au lieu d'une simple coupure.

Pense à inscrire le projet retenu dans `.firebaserc`.

---

## Trois choses à brancher avant la mise en ligne

1. **Le lien de don.** L'ancre `#lien-don` pointe encore sur
   `https://ko-fi.com`. Remplace-la par l'adresse de la page Ko-fi de Marc
   Bert.

2. **Les fichiers à télécharger** — voir la marche à suivre ci-dessus.

3. ~~Des captures d'écran.~~ ✅ Faites — `npm run captures` les régénère à partir
   d'une session de démonstration, si l'habillage change.


## Ce que la page dit du cadre légal

Une section rappelle que le logiciel **ne tire jamais les numéros** et que
chaque organisme demeure responsable de sa propre licence. Ce n'est pas une
formalité : c'est ce qui distingue un outil de régie d'un jeu en ligne, que le
Code criminel réserve à l'État provincial. Ne pas la retirer.
