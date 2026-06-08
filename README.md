# AfricaCulture — Interface de chat React + BFF pour Microsoft AI Foundry

SPA React (Vite + TypeScript) qui dialogue avec l'agent conversationnel
**AfricaCulture** (modèle **gpt-4.1**) hébergé sur **Microsoft AI Foundry**.
La clé API n'est **jamais** exposée au navigateur : toutes les requêtes passent
par un proxy **BFF (Backend For Frontend)** Node/Express.

```
Navigateur (SPA React)  ──►  /api/chat  ──►  BFF (Node/Express)  ──►  Microsoft AI Foundry
   pas de secret              même origine        détient la clé           Responses API
```

---

## 1. Arborescence du projet

```
africaculture-chat/
├── .env                      # Secrets (gitignored) — lus par le BFF uniquement
├── .env.example              # Modèle d'environnement
├── .gitignore
├── index.html
├── package.json              # Frontend (Vite + React + TS)
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts            # Proxy dev: /api -> http://localhost:8787
│
├── server/                   # ── BFF : seul composant qui détient la clé ──
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # App Express, CORS, /api/health
│       ├── config.ts         # Chargement + validation des variables d'env
│       ├── foundryClient.ts  # Appels à Foundry (agent_reference / model)
│       └── routes/
│           └── chat.ts       # POST /api/chat (JSON + streaming SSE)
│
└── src/                      # ── SPA React ──
    ├── main.tsx              # Point d'entrée
    ├── App.tsx
    ├── index.css             # Tailwind + styles de base
    ├── vite-env.d.ts
    ├── assets/
    ├── types/
    │   └── chat.ts           # Typage fort des requêtes/réponses
    ├── services/
    │   └── agentService.ts   # Client HTTP/SSE vers le BFF (jamais Foundry direct)
    ├── hooks/
    │   └── useAgentChat.ts    # État + communication isolés de l'UI
    ├── utils/
    │   └── sanitize.ts       # Sanitisation des entrées (anti-XSS)
    └── components/
        ├── ChatInterface.tsx # Composant principal (compose tout)
        ├── MessageList.tsx
        ├── MessageBubble.tsx
        ├── ChatInput.tsx
        └── TypingIndicator.tsx
```

**Séparation des préoccupations**
- `types/` : contrats de données partagés (TypeScript strict).
- `services/` : I/O réseau, aucun JSX.
- `hooks/` : état + orchestration (`useAgentChat`), réutilisable et testable.
- `components/` : présentation pure, déclarative.
- `utils/` : fonctions pures (sanitisation).

---

## 2. Intégration Microsoft AI Foundry

### URL correcte (vérifiée)

Le SDK Python `azure-ai-projects` (`project_client.get_openai_client()`)
résout sa `base_url` à **`{endpoint_du_projet}/openai/v1`**. L'appel à l'agent
se fait donc sur :

```
POST https://africaculture-resource.services.ai.azure.com/api/projects/africaculture/openai/v1/responses
```

avec la référence d'agent transmise **dans le corps** de la requête :

```jsonc
{
  "input": [{ "role": "user", "content": "..." }],
  "stream": true,
  "agent_reference": { "name": "AfricaCulture", "version": "2", "type": "agent_reference" }
}
```

> Équivalent du sample Python (`extra_body={"agent_reference": {...}}`),
> transposé en React/TypeScript via le BFF.

### Deux modes (variable `FOUNDRY_MODE`)

| Mode    | Endpoint utilisé                                   | Corps                         |
| ------- | -------------------------------------------------- | ----------------------------- |
| `agent` | `{projet}/openai/v1/responses`                     | `agent_reference` (AfricaCulture v2) |
| `model` | `{ressource}.openai.azure.com/openai/v1/responses` | `model: "gpt-4.1"`            |

### À propos de gpt-4.1

- Version du modèle : **`2025-04-14`** (le `2025-10-06` de
  `azureml://registries/azure-openai/models/gpt-4.1/versions/2025-10-06` est la
  version de packaging du registre).
- Fenêtre de contexte ~1 047 576 tokens en entrée, 32 768 tokens en sortie.
- Compatible **Responses API**, function calling, sorties structurées,
  streaming SSE.

### États granulaires de l'IA

`useAgentChat` expose un statut : `idle` → `loading` → `streaming` → (`idle` | `error`).

---

## 3. Sécurité

- **Aucune clé dans le code React.** Les variables sans préfixe `VITE_` ne sont
  jamais incluses dans le bundle navigateur par Vite. La clé est lue uniquement
  côté serveur (`server/`).
- **Proxy BFF obligatoire.** Le navigateur ne contacte que `/api/chat`
  (même origine). Le BFF ajoute l'en-tête d'authentification et appelle Foundry.
- **Authentification** : `FOUNDRY_AUTH_MODE=key` (en-tête `api-key`) ou
  `entra` (jeton Microsoft Entra ID via `DefaultAzureCredential`, recommandé en
  production — aucune clé statique).
- **Sanitisation anti-XSS** (`utils/sanitize.ts`) : suppression du HTML via
  DOMPurify + retrait des caractères de contrôle + limite de longueur, avant
  envoi. L'UI rend le contenu en texte (échappé par React, jamais de
  `dangerouslySetInnerHTML`).
- **Robustesse** : validation/clamp des messages côté BFF, propagation des
  annulations (`AbortController`) pour stopper la facturation des tokens.

---

## 4. Design / UI-UX

- **Mobile-first**, 100 % responsive (Tailwind CSS), hauteur `100dvh`,
  `safe-area-inset` pour les encoches.
- Thème sombre, épuré, minimaliste.
- **Aucun emoji.** Icônes SVG professionnelles via **`lucide-react`**
  (`SendHorizontal`, `Square`, `RefreshCw`, `RotateCcw`, `Bot`, `User`,
  `Landmark`, `AlertTriangle`).
- Streaming token par token, auto-scroll, bouton Stop, réessai sur erreur,
  indicateur de saisie, compteur de caractères.

---

## 5. Démarrage

### Prérequis
- Node.js 18+ (testé sur Node 24).

### Installation
```bash
npm run install:all        # installe le frontend ET le serveur
```

### Configuration
Copiez `.env.example` vers `.env` puis renseignez vos valeurs :
```bash
cp .env.example .env
```
Le fichier `.env` fourni est déjà configuré pour le projet **africaculture**
(mode `agent`, agent `AfricaCulture` v2).

### Lancement (dev — frontend + BFF en parallèle)
```bash
npm run dev
```
- SPA : http://localhost:5173
- BFF : http://localhost:8787 (proxifié via `/api`)

### Production
```bash
npm run build           # build du frontend -> dist/
npm run build:bff       # build du BFF -> server/dist/
npm --prefix server start
```

---

## 6. API du BFF

`POST /api/chat`
```jsonc
// Requête
{ "messages": [{ "role": "user", "content": "Bonjour" }], "stream": true }
```
- `stream: true`  → `text/event-stream`, événements `data: {"type":"delta","text":"..."}`
  puis `data: {"type":"done","id":"resp_..."}`.
- `stream: false` → `{ "id": "resp_...", "content": "..." }`.

`GET /api/health` → `{ "status": "ok", "mode": "agent", "authMode": "key" }`

---

> Note de sécurité : la clé API présente dans `.env` est un secret. Faites-la
> tourner si elle a été partagée, et ne committez jamais `.env`
> (déjà couvert par `.gitignore`).

---

## Déploiement sur Vercel

### Architecture Vercel
Ce projet est une **full-stack monorepo** sur Vercel :
- **Frontend** (React SPA) : déployé comme assets statiques (dist/)
- **Backend** (BFF Node) : déployé comme serverless functions (`/api`)
- Vercel gère automatiquement le routing entre les deux

### 1. Pré-requis
- Compte GitHub avec le repo pushé
- Compte Vercel (connexion via GitHub)
- Vercel CLI installé (optionnel) : `npm i -g vercel`

### 2. Connexion du repo GitHub à Vercel
1. Allez sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Cliquez **"Add New"** → **"Project"**
3. Sélectionnez le repo **AfricaCulture** depuis GitHub
4. Vercel détecte automatiquement :
   - **Framework** : Vite (React)
   - **Build Command** : `npm run build && npm run build:server`
   - **Output Directory** : `dist`
5. Cliquez **"Deploy"**

### 3. Ajouter les variables d'environnement en production
En attendant que le déploiement initial se termine, configurez les secrets :

1. Dans le dashboard Vercel, allez dans **Settings** → **Environment Variables**
2. Ajoutez les variables suivantes :

| Variable | Valeur | Notes |
|----------|--------|-------|
| `FOUNDRY_API_KEY` | Votre clé API Foundry | Secret — Vercel masque |
| `FOUNDRY_PROJECT_ENDPOINT` | `https://africaculture-resource.services.ai.azure.com/api/projects/africaculture` | |
| `FOUNDRY_AGENT_NAME` | `AfricaCulture` | |
| `FOUNDRY_AGENT_VERSION` | `2` | |
| `FOUNDRY_AUTH_MODE` | `api-key` | `api-key` ou `entra` |
| `NODE_ENV` | `production` | |

3. **Important** : pour chaque variable sensible, cochez **"Encrypt"** (Vercel le fait par défaut).

### 4. Déploiement local test (avant push)
```bash
# Test local avec les mêmes conditions Vercel
npm run build
npm run build:server
npx vercel --prod  # Requiert login Vercel CLI
```

### 5. URLs après déploiement
- **Frontend** : `https://africaculture.vercel.app`
- **API** : `https://africaculture.vercel.app/api/chat`
- **Health check** : `https://africaculture.vercel.app/api/health`

### 6. Logs et monitoring
1. Allez dans **Deployments** → votre déploiement → **Functions**
2. Consultez les logs des serverless functions
3. Accédez à **Analytics** pour la performance et les erreurs

### 7. Rollback rapide
Vercel stocke l'historique de tous les déploiements :
1. **Deployments** → sélectionnez une version précédente
2. Cliquez les 3 points → **Promote to Production**
3. Rollback instantané (< 1 sec)

### Configuration détaillée (vercel.json)
Le fichier `vercel.json` configure :
- **buildCommand** : compile le frontend + BFF
- **outputDirectory** : `dist/` (assets React statiques)
- **functions** : `/api/**` comme serverless Node.js functions
- **rewrites** : `/*` → `/index.html` (SPA routing)
- **headers** : cache control optimal pour les assets
- **env** : passerelle vers Vercel dashboard secrets

### Notes supplémentaires
- **Scaling** : Vercel scale automatiquement de 0 à N fonctions
- **Cold starts** : premier appel ~1-2s, puis instant (reuse warm instance)
- **Coûts** : gratuit jusqu'à 100GB-hours/mois, puis pay-as-you-go
- **Streaming** : ✅ SSE streaming fonctionne natif sur Vercel Functions
- **Logs** : accessible via `vercel logs` ou dashboard

---
