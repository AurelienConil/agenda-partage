# Exemple d'événement à créer dans Nextcloud

Cet exemple montre **chaque champ** à remplir dans l'app Agenda. Le texte du
bloc « Description » se copie-colle tel quel.

## Les champs

| Champ Nextcloud | À mettre                                   | Effet sur le site                     |
|-----------------|--------------------------------------------|---------------------------------------|
| **Titre**       | `Nocturne audiovisuelle : Signal/Bruit`    | Titre de la carte                     |
| **Début / Fin** | `18/10/2026 20:30` → `18/10/2026 23:00`    | Date et heure (ou « Toute la journée » si la case est cochée) |
| **Lieu**        | `ARCAN` (ou `Le Ciel, 2 rue…`)             | Lien vers la fiche du lieu si elle existe |
| **URL**         | `https://www.exemple.fr/signal-bruit`      | Bouton « En savoir plus »             |
| **Description** | voir ci-dessous                            | Texte, genres, photos                 |

## La description (à copier-coller)

```
#Concert #Installation #ArtsNumériques

IMAGE=https://www.exemple.fr/images/affiche-signal-bruit.jpg

**Signal/Bruit** est une soirée consacrée aux *paysages sonores génératifs*
et à la vidéo en temps réel.

**Au programme**

- 20h30 : ouverture, installation immersive
- 21h30 : concert audiovisuel
- 22h30 : discussion avec les artistes

Une deuxième image, au milieu du texte :

IMAGE=https://www.exemple.fr/images/salle.webp

---

Plus d'informations sur [le site de l'artiste](https://www.exemple.fr/artiste).

Tarifs : **8 €** plein tarif, *gratuit* pour les moins de 12 ans.
```

Résultat :
- les hashtags `#Concert #Installation #ArtsNumériques` servent de **genres**
  (tri et filtres) ; ils ne sont pas affichés dans le texte ;
- la **première** image devient la vignette de la carte ;
- chaque image s'affiche **à sa place** dans la fenêtre de détail, en pleine
  largeur.

---

# Aide-mémoire

## Image

Une ligne seule dans la description :

```
IMAGE=https://site-du-lieu.fr/photo.jpg
```

- Sur le site source : clic droit sur l'image → **Copier l'adresse de l'image**.
- Une ligne par image, autant qu'on veut. La première sert de vignette.
- L'adresse doit commencer par `http://` ou `https://`.
- Si l'image ne charge pas, elle est simplement masquée.
- Il n'y a pas de téléversement : l'image reste hébergée sur le site d'origine.

## Lien « En savoir plus »

Champ **URL** de l'événement (pas la description). Seuls `http://` et
`https://` sont acceptés.

## Genres (hashtags)

Dans la description, n'importe où : `#Théâtre #Concert #Performance`.

- Un hashtag = un genre. Plusieurs possibles.
- Pas d'espace dans un hashtag : `#ArtsNumériques`, `#Nouveaux-médias`.
- Les hashtags sont retirés de l'affichage.
- Écrivez-les toujours de la même façon (`#Concert`, pas `#concert` et
  `#Concerts`) pour ne pas créer des genres en double.

## Brouillon / privé

Ajouter `#Brouillon` ou `#Privé` (ou `#Draft`, `#Private`) dans la
description : l'événement n'est **jamais** affiché sur le site. Retirer le
hashtag pour publier.

## Lieu

Champ **Lieu** : le nom de la fiche dans le dossier `Lieux` de Nextcloud,
sans `.md`. Casse, accents, tirets et article initial sont ignorés (« ciel »,
« Le Ciel », « le-ciel » désignent le même lieu). Une adresse après une
virgule est ignorée : `Le Ciel, 2 rue Général Marchand`.

## Mise en forme autorisée

| Pour obtenir     | Écrire                    |
|------------------|---------------------------|
| **gras**         | `**gras**`                |
| *italique*       | `*italique*`              |
| Lien             | `[texte](https://…)`      |
| Liste à puces    | `- un` / `- deux`         |
| Séparateur       | `---` sur une ligne seule |
| Image            | `IMAGE=https://…`         |

Astuces :
- Un **simple retour à la ligne** suffit pour passer à la ligne.
- Laisser une **ligne vide** avant une liste ou un séparateur.
- Rien d'autre n'est prévu : pas de titres, citations ni code.
