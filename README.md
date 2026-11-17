# DM — Dungeon Mistress

Application web personnelle d'histoires interactives pilotées par l'IA (Claude, API Anthropic).
Installable sur Android (PWA). Les données restent sur l'appareil.

## Fonctionnement du dépôt

- Chaque `push` sur `main` lance GitHub Actions : vérification des types, tests, build, puis déploiement sur GitHub Pages.
- Adresse de l'application : `https://<utilisateur>.github.io/dm/`

## Mise en place (une seule fois)

1. Dépôt GitHub → **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Après le premier déploiement réussi, ouvrir l'adresse sur le téléphone avec Chrome, puis **menu ⋮ → Installer l'application**.

## Développement local (facultatif)

```bash
npm install
npm run dev       # serveur de développement
npm test          # tests unitaires
npm run build     # build de production
```

## Sécurité

La clé API Anthropic n'est jamais stockée dans ce dépôt : elle est saisie dans l'application et conservée uniquement sur l'appareil.
