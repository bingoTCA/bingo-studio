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

✅ **Déjà en place.** Le site est en ligne sur
<https://bingotca.github.io/bingo-studio/> et se met à jour à chaque poussée
sur `main`. Un domaine personnalisé peut s'ajouter dans Settings → Pages.

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

## Ce qui reste à brancher

Quatre repères `REMPLACER` dans les fichiers. Cherche-les, ils sont commentés.

### 1. ~~Le formulaire Brevo~~ ✅ branché

Dans Brevo (gratuit : contacts illimités, 300 courriels par jour) :

1. **Contacts → Attributs** : crée `NOM`, `ORGANISME`, `REGION` en type texte.
   `EMAIL` existe déjà.
2. **Contacts → Listes** : crée une liste, par exemple « Bingo Studio ».
3. **Contacts → Formulaires** : crée un formulaire avec ces champs, rattaché à
   la liste. Récupère son **URL de partage**, de la forme
   `https://sibforms.com/serve/MUIF...`
4. Colle-la dans l'attribut `action` du `<form class="inscription">`.
5. Dans les réglages du formulaire, mets la **redirection après envoi** sur
   `https://bingotca.github.io/bingo-studio/telecharger/` — la personne arrive
   directement sur la page de téléchargement, sans attendre son courriel.
6. **Automatisations** : « à l'inscription à la liste », envoie un courriel
   contenant ce même lien. C'est lui qui sert de trace et de rappel.

Pour le rappel annuel : une campagne ordinaire, une fois l'an, à cette liste.

Champs envoyés : `EMAIL`, `NOM`, `ORGANISME`, plus `email_address_check`
(piège à robots, doit rester vide) et `locale`.

⚠️ Ces noms doivent correspondre **exactement** aux attributs du compte Brevo.
Si tu modifies un attribut là-bas, modifie-le ici aussi : un nom qui ne
correspond pas est jeté en silence, sans message d'erreur. Tu recevrais des
inscriptions sans nom ni organisme sans jamais t'en rendre compte.

### 2. ~~Le lien Ko-fi~~ ✅ branché — `https://ko-fi.com/marcoso77`

### 3. ~~L'adresse de contact~~ ✅ branchée — `marcbert@mailo.com`

### 4. Les fichiers à télécharger — `telecharger/index.html`

Deux `href="#"` à remplacer par les adresses des fichiers dans GitHub Releases,
puis retirer `aria-disabled="true"` et mettre à jour `.tele-etat`.

---

## Ce que l'inscription protège — et ce qu'elle ne protège pas

Le formulaire sert à **savoir qui utilise le logiciel** et à pouvoir recontacter
ces personnes : mises à jour, rappel annuel. Ce n'est **pas une serrure** : les
fichiers sont sur GitHub Releases, publiquement accessibles, et le dépôt est
public. Quelqu'un de déterminé contourne le formulaire en trente secondes.
C'est assumé — la page `telecharger/` porte d'ailleurs `noindex`, pas un mot de
passe.

**Loi 25 :** la case à cocher est obligatoire et annonce précisément l'usage
(lien, mises à jour, rappel annuel). Brevo fournit le lien de désabonnement et
l'hébergement conforme. Ne retire pas la case.


## Ce que la page dit du cadre légal

Une section rappelle que le logiciel **ne tire jamais les numéros** et que
chaque organisme demeure responsable de sa propre licence. Ce n'est pas une
formalité : c'est ce qui distingue un outil de régie d'un jeu en ligne, que le
Code criminel réserve à l'État provincial. Ne pas la retirer.
