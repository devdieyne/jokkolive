# tiktok-live-commerce — MVP V1

Capture et matching en temps réel des commandes dans les lives TikTok de vendeurs sénégalais.

---

## Prérequis

- Node.js 20 LTS
- MongoDB 7.x en local (`mongod` lancé sur le port 27017)
- Un compte OpenAI avec accès à `gpt-4o-mini`
- Un username TikTok **actuellement en live** pour les tests end-to-end

---

## Installation

```bash
# 1. Cloner et installer les dépendances
npm install

# 2. Créer le fichier d'environnement
cp .env.example .env

# 3. Remplir .env avec vos valeurs
#    OPENAI_API_KEY=sk-...
#    MONGODB_URI=mongodb://localhost:27017/tiktok-live-commerce
```

---

## Commandes

| Commande | Action |
|----------|--------|
| `npm run start:dev` | Lance l'app en mode watch (développement) |
| `npm run build` | Compile TypeScript → dist/ |
| `npm start` | Lance la version compilée |
| `npm test` | Lance les tests unitaires Jest |
| `npm run test:cov` | Tests avec rapport de couverture |
| `npm run lint` | ESLint sur src/ et test/ |

---

## Valider la connexion TikTok avant tout

Avant de démarrer l'app, validez que vous pouvez capturer des commentaires :

```bash
node test-connection.js nom_utilisateur_en_live
# Exemple :
node test-connection.js momo_rassoul
```

Si vous voyez `✅ Connecté !` et des `💬` dans la console, vous êtes prêt.

---

## Scénario de démo bout-en-bout

### 1. Démarrer l'app

```bash
npm run start:dev
# → 🚀 App running on http://localhost:3000
```

### 2. Connecter le client Socket.IO (terminal séparé)

```bash
npm install socket.io-client  # une seule fois
SELLER_ID=default-seller node demo-client.js
```

### 3. Créer un produit

```bash
curl -s -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "sellerId": "default-seller",
    "name": "Robe wax rouge",
    "priceFCFA": 15000,
    "variants": [
      {"name": "taille", "options": ["S","M","L","XL"]},
      {"name": "couleur", "options": ["rouge","bleu"]}
    ],
    "stock": 20
  }' | python3 -m json.tool
```

Notez le `_id` retourné → `PRODUCT_ID`.

### 4. Démarrer un live sur un username TikTok réel en live

```bash
curl -s -X POST http://localhost:3000/live/start \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"default-seller","tiktokUsername":"nom_en_live"}' \
  | python3 -m json.tool
```

Le client Socket.IO affiche `🟢 [LIVE] Connecté`.

### 5. Définir le produit en vedette

```bash
curl -s -X POST http://localhost:3000/live/current-product \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"default-seller","productId":"PRODUCT_ID"}' \
  | python3 -m json.tool
```

### 6. Observer les commandes en temps réel

Dans le terminal du `demo-client.js`, vous verrez apparaître des `✅ COMMANDE CAPTURÉE` à chaque commentaire d'achat détecté.

### 7. Lister les commandes

```bash
curl -s "http://localhost:3000/orders?sellerId=default-seller" \
  | python3 -m json.tool
```

### 8. Exporter en CSV

```bash
curl -s "http://localhost:3000/orders/export/SESSION_ID.csv" \
  -o commandes.csv
open commandes.csv  # macOS
```

### 9. Stopper le live

```bash
curl -s -X POST http://localhost:3000/live/stop \
  -H "Content-Type: application/json" \
  -d '{"sellerId":"default-seller"}' \
  | python3 -m json.tool
```

---

## Architecture

```
src/
├── config/           Configuration typée (@nestjs/config)
├── schemas/          Modèles Mongoose (LiveSession, Product, Comment, Order)
├── live/             Capture TikTok, reconnexion, 5 routes REST
├── matching/         IA GPT-4o-mini, pré-filtrage, matching FR+Wolof
├── orders/           6 routes REST + export CSV
└── events/           Gateway Socket.IO namespace /live
```

## Socket.IO — namespace `/live`

| Sens | Event | Payload |
|------|-------|---------|
| Client → Serveur | `seller:join` | `{ sellerId }` |
| Serveur → Client | `live:status` | `{ status, roomId? }` |
| Serveur → Client | `live:comment` | `{ author, content, timestamp }` |
| Serveur → Client | `order:new` | `{ order, buyer, confidence, needsReview }` |
| Serveur → Client | `live:product-changed` | `{ productId }` |
| Serveur → Client | `live:ended` | `{ sessionId }` |

---

## Tests

```bash
npm test
# PASS test/live.service.spec.ts   (9 tests)
# PASS test/matching.service.spec.ts (9 tests)
# Tests: 18 passed, 18 total
```

---

## Hors scope V1

- Authentification JWT / multi-vendeurs
- Paiement Wave / Orange Money
- Bot WhatsApp / DM automatique
- Livraisons
- App mobile React Native (projet Expo séparé)
- Docker / CI-CD
- Swagger / OpenAPI
