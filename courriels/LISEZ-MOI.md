# Les courriels envoyés par Brevo

`confirmation.html` est le message reçu par une télévision qui s'inscrit sur
le site. C'est le **modèle n° 1** dans Brevo, celui que le formulaire déclenche
(`tag: simple_confirmation`).

Il est gardé ici, dans le dépôt, pour trois raisons : on peut le relire sans
ouvrir Brevo, on voit son historique de modifications, et on peut le réinstaller
d'une commande si quelqu'un l'écrase par accident dans l'interface.

## L'installer dans Brevo

Depuis la racine du projet, en remplaçant `TA_CLE` :

```bash
python3 -c "
import json,sys
print(json.dumps({'htmlContent': open('courriels/confirmation.html').read()}))
" > /tmp/modele.json && curl -s -X PUT \
  -H "api-key: TA_CLE" -H "Content-Type: application/json" \
  --data @/tmp/modele.json \
  "https://api.brevo.com/v3/smtp/templates/1" -w "code HTTP : %{http_code}\n"
```

Un **204** veut dire que c'est passé.

## Vérifier

```bash
curl -s -H "api-key: TA_CLE" "https://api.brevo.com/v3/smtp/templates/1" \
  | python3 -c "
import json,sys
d = json.load(sys.stdin)
print('expéditeur :', d['sender']['email'])
print('objet      :', d['subject'])
print('actif      :', d['isActive'])
print('lien de téléchargement présent :', 'telecharger' in d['htmlContent'])
print('reste-t-il de l anglais :', 'Thank you for subscribing' in d['htmlContent'])
"
```

## Pourquoi ce balisage démodé

Tableaux imbriqués, styles à même les balises, pas une feuille de style
externe. Ce n'est pas de la négligence : Outlook lit encore le HTML avec le
moteur de rendu de Word, qui ignore flexbox, grid et la moitié du CSS moderne.
Un courriel se fabrique comme en 2005, sinon il se présente de travers chez une
partie des destinataires — et on ne saura jamais lesquels.

## Le champ `{{ contact.NOM }}`

Brevo remplace cette balise par le nom saisi dans le formulaire. Si le contact
n'a pas de nom, elle rend une chaîne vide et la phrase se lit quand même :
« Bonjour , » — pas idéal, mais le champ NOM est obligatoire dans le
formulaire, donc le cas ne devrait pas se présenter.

## Ce qui ne part toujours pas

Un courriel n'arrive que si le domaine d'envoi est authentifié. `myprospire.app`
l'est : DKIM (`brevo1`/`brevo2._domainkey`) et DMARC sont publiés et vérifiés
par Brevo.

Il reste une amélioration à faire chez le registraire — l'enregistrement SPF du
domaine ne mentionne pas Brevo :

```
actuel    v=spf1 include:secureserver.net -all
souhaité  v=spf1 include:secureserver.net include:spf.brevo.com -all
```

L'alignement DKIM suffit à satisfaire DMARC, donc les courriels passent. Mais
certains serveurs vérifient le SPF de leur côté, et un `-all` qui échoue peut
coûter des livraisons.
