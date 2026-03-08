# Recensement Agricole France — Visualisation Diachronique

![Croquis du projet](croquis.png)

**Application déployée en production :** [french-farming-diachronic.vercel.app](https://french-farming-diachronic.vercel.app/)

---

## Résultats principaux

- **SAU totale** : ~26,75 millions d'hectares en France métropolitaine (données Recensement Agricole 2020)
- **Nouvelle-Aquitaine = 1ère région agricole** : 14,5% de la SAU nationale, soit ~3,87 M ha
- **Grandes exploitations dominantes** dans les régions de grandes cultures : Île-de-France, Centre-Val de Loire, Hauts-de-France (classes 100-200 ha et 200+ ha)
- **Agriculture familiale et petites structures** prédominent en Occitanie et PACA (dominance des classes < 20 ha et 20-50 ha)
- **Évolution temporelle (SAA 2016-2024)** : la SAU nationale reste stable autour de 26-27 M ha malgré la pression foncière

---

## Description du projet

Application interactive de visualisation des données agricoles françaises, combinant données du Recensement Agricole 2020 et des Statistiques Agricoles Annuelles (SAA) 2016-2024.

Trois onglets de visualisation :

| Onglet | Description |
|--------|-------------|
| **Carte choroplèthe** | Carte de France interactive par régions ou départements, colorée selon l'indicateur sélectionné |
| **Répartition SAU** | Graphique en donut montrant la part de chaque région dans la SAU nationale |
| **Flux par taille** | Diagramme de Sankey représentant les flux de SAU par classe de taille d'exploitation |

---

## Fonctionnalités

- **Filtre géographique** : basculer entre vue régions et vue départements ; clic sur une région pour zoomer sur ses départements
- **Indicateur** : nombre d'exploitations ou superficie agricole utilisée (SAU en ha)
- **Évolution temporelle** : slider d'années de 2016 à 2024 (uniquement pour l'indicateur SAU, données SAA)
- **Taille d'exploitation** : filtrer par classe de taille (< 20 ha, 20-50 ha, 50-100 ha, 100-200 ha, 200+ ha) — disponible uniquement pour le Recensement 2020
- **Tooltip** : survol d'une région/département pour afficher les valeurs détaillées

---

## Sources de données

| Source | URL |
|--------|-----|
| Recensement Agricole 2020 (RA2020) | [agreste.agriculture.gouv.fr — RA2020](https://agreste.agriculture.gouv.fr/agreste-web/disaron/RA2020_001/detail/) |
| Statistiques Agricoles Annuelles — Séries longues SAA | [agreste.agriculture.gouv.fr — SAA Séries Longues](https://agreste.agriculture.gouv.fr/agreste-web/disaron/SAA-SeriesLongues/detail/) |
| GeoJSON administratif France | [github.com/gregoiredavid/france-geojson](https://github.com/gregoiredavid/france-geojson) |

---

## Limites et bugs connus

- **DOM-TOM absents** : les départements et régions d'outre-mer ne sont pas affichés sur la carte (données GeoJSON France métropolitaine uniquement)
- **Filtre taille désactivé hors recensement** : le filtre par classe de taille d'exploitation est désactivé lorsqu'une année SAA est sélectionnée, car les données SAA ne sont pas disponibles par classe de taille
- **Pas de données nb_exploitations dans les SAA** : l'indicateur "Nombre d'exploitations" n'est disponible que pour le Recensement 2020 ; les années SAA ne fournissent que la SAU
- **Comparaison temporelle limitée à la SAU** : l'évolution 2016-2024 ne couvre que la superficie agricole, pas le nombre d'exploitations ni leur répartition par taille

---

## Stack technique

| Technologie | Usage |
|------------|-------|
| React 18 + TypeScript | Interface utilisateur |
| Vite | Bundler et serveur de développement |
| D3.js | Carte choroplèthe et projections géographiques |
| Tailwind CSS + shadcn/ui | Design system et composants UI |
| Zustand | Gestion d'état global |
| Vitest | Tests unitaires |

---

## Lancer en local

Nous avons fait un makefile pour rendre l'installation et le développement plus simple.

```bash
# help
make help

# Installer les dépendances
make install

# Lancer le serveur de développement (port 8080)
make dev
```

> Requiert Node.js 18+
