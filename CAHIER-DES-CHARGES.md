# Cahier des charges — Live Commerce Capture (V1)

## Projet : `tiktok-live-commerce`

Version : 1.0 — MVP Local
Stack : NestJS 10 + MongoDB + Socket.IO + OpenAI
Auteur : Dieyné
Cible marché : Vendeurs sénégalais sur TikTok Live (Colobane, Sandaga, etc.)

---

## 1. Vision du produit

### 1.1 Le problème

Au Sénégal, TikTok Shop n'est pas disponible. Pourtant, des milliers de vendeurs (textile, accessoires, cosmétiques, alimentation) font des **lives commerce TikTok** quotidiennement. Pendant ces lives :

- La vendeuse présente un produit à l'oral
- Les acheteurs commentent leur intention d'achat ("je prends", "moi 1", "coumb")
- Les commentaires défilent vite — beaucoup sont **perdus**
- Après le live, la vendeuse doit retrouver chaque acheteur en DM
- Elle court après les paiements pendant des jours

**Résultat** : 30 à 50 % des intentions d'achat exprimées en live ne se transforment jamais en commandes réelles.

### 1.2 La solution V1

Une application qui se connecte au live TikTok d'une vendeuse, capture **tous** les commentaires en temps réel, identifie automatiquement les intentions d'achat grâce à l'IA, et génère une **liste de commandes structurée** consultable depuis l'app mobile de la vendeuse.

### 1.3 Périmètre V1 (et seulement V1)

**Ce qui est dans la V1** :
- Connexion à un live TikTok via username
- Capture temps réel des commentaires
- Catalogue produit basique avec variantes (taille, couleur)
- Désignation d'un produit "en vedette" pendant le live
- Matching IA commentaire → commande
- Liste des commandes générées en temps réel via Socket.IO
- Validation/édition manuelle d'une commande
- Export CSV des commandes en fin de live

**Ce qui est explicitement HORS V1** (ne pas coder) :
- Paiement Wave/Orange Money
- Bot WhatsApp / DM automatique
- Gestion des livraisons et transporteurs
- Authentification multi-vendeurs (la V1 est mono-vendeur en local)
- App mobile React Native (le frontend RN sera fait dans un projet séparé)
- Multi-langue (français uniquement pour les UI ; l'IA traite français + wolof)

---

## 2. Stack technique imposée

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Backend | NestJS | ^10.0.0 |
| Runtime | Node.js | 20 LTS |
| Base de données | MongoDB | 7.x |
| ODM | Mongoose | ^8.0.0 |
| WebSocket | Socket.IO via `@nestjs/platform-socket.io` | ^10.0.0 |
| Event bus interne | `@nestjs/event-emitter` | ^2.0.0 |
| Capture TikTok | `tiktok-live-connector` | ^2.0.0 (latest) |
| IA matching | `openai` | ^4.0.0 |
| Validation DTO | `class-validator` + `class-transformer` | latest |
| Configuration | `@nestjs/config` | ^3.0.0 |

**À ne PAS utiliser** :
- TypeORM (on est sur Mongoose)
- Express (NestJS gère ça nativement)
- Redis (sera ajouté en V2 pour scaling, pas en V1)
- BullMQ (idem V2)

---

## 3. Arborescence du projet

```
tiktok-live-commerce/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── schemas/
│   │   ├── live-session.schema.ts
│   │   ├── product.schema.ts
│   │   ├── comment.schema.ts
│   │   └── order.schema.ts
│   ├── live/
│   │   ├── live.module.ts
│   │   ├── live.service.ts
│   │   ├── live.controller.ts
│   │   └── dto/
│   │       ├── start-live.dto.ts
│   │       ├── stop-live.dto.ts
│   │       └── set-current-product.dto.ts
│   ├── matching/
│   │   ├── matching.module.ts
│   │   ├── matching.service.ts
│   │   └── prompts/
│   │       └── order-detection.prompt.ts
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.service.ts
│   │   ├── orders.controller.ts
│   │   └── dto/
│   │       ├── update-order.dto.ts
│   │       └── confirm-order.dto.ts
│   ├── products/
│   │   ├── products.module.ts
│   │   ├── products.service.ts
│   │   ├── products.controller.ts
│   │   └── dto/
│   │       ├── create-product.dto.ts
│   │       └── update-product.dto.ts
│   └── events/
│       ├── events.module.ts
│       └── events.gateway.ts
├── test/
│   ├── live.service.spec.ts
│   └── matching.service.spec.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## 4. Modèle de données (Mongoose)

### 4.1 `LiveSession`

Représente une session de live TikTok en cours ou terminée.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `sellerId` | string | oui | Identifiant interne de la vendeuse (en V1 : valeur fixe `default-seller`) |
| `tiktokUsername` | string | oui | @username TikTok sans le @ |
| `roomId` | string | non | ID de room TikTok rempli après connexion |
| `status` | enum | oui | `active` / `ended` / `failed` (default: `active`) |
| `currentProductId` | ObjectId ref Product | non | Produit en vedette actuellement |
| `startedAt` | Date | oui | default: `Date.now` |
| `endedAt` | Date | non | rempli au stop |
| `totalComments` | number | oui | default: 0 |
| `totalOrdersCaptured` | number | oui | default: 0 |
| `createdAt`, `updatedAt` | Date | auto | `timestamps: true` |

**Contrainte métier** : il ne peut y avoir **qu'une seule** session avec `status: active` par `sellerId` à un instant T. Si un nouveau `start` est appelé alors qu'une session active existe, on doit la fermer proprement avant.

### 4.2 `Product`

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `sellerId` | string | oui | |
| `name` | string | oui | Nom du produit |
| `keywords` | string[] | oui | default: `[]` — mots-clés pour aider le matching IA |
| `priceFCFA` | number | oui | Prix en FCFA (entier) |
| `variants` | Array<{name, options}> | oui | default: `[]` — ex: `[{name: "taille", options: ["S","M","L"]}, {name: "couleur", options: ["rouge","bleu"]}]` |
| `stock` | number | oui | default: 0 |
| `imageUrl` | string | non | |

### 4.3 `Comment`

Chaque commentaire capturé dans le live, avec son verdict de matching.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `liveSessionId` | ObjectId ref LiveSession | oui | |
| `tiktokCommentId` | string | oui | msgId TikTok pour dédup |
| `authorUniqueId` | string | oui | @username de l'acheteur |
| `authorNickname` | string | non | nom affiché |
| `authorProfilePicture` | string | non | URL avatar |
| `content` | string | oui | texte brut du commentaire |
| `contextProductId` | ObjectId ref Product | non | produit en vedette à ce moment-là |
| `matchStatus` | enum | oui | `pending` / `order_intent` / `question` / `noise` / `failed` (default: `pending`) |
| `resultingOrderId` | ObjectId ref Order | non | si une commande a été créée |
| `capturedAt` | Date | oui | timestamp réel du commentaire (≠ createdAt qui est l'insertion en base) |

**Index** : créer un index unique sur `(liveSessionId, tiktokCommentId)` pour empêcher tout doublon en cas de reconnexion TikTok.

### 4.4 `Order`

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `sellerId` | string | oui | |
| `liveSessionId` | ObjectId ref LiveSession | oui | |
| `sourceCommentId` | ObjectId ref Comment | oui | trace d'audit |
| `buyerTiktokUsername` | string | oui | |
| `buyerPhone` | string | non | rempli plus tard manuellement |
| `items` | Array | oui | `[{ productId, productName, quantity, variant: Map<string,string>, unitPriceFCFA }]` |
| `totalFCFA` | number | oui | calculé à la création |
| `status` | enum | oui | `captured` / `confirmed` / `cancelled` (default: `captured`) — V1 simplifiée, on n'a pas de statut paiement/livraison |
| `matchConfidence` | number | oui | 0 à 1 — confiance de l'IA |
| `needsManualReview` | boolean | oui | true si `matchConfidence < 0.7` |

---

## 5. Modules et services

### 5.1 `LiveModule`

#### 5.1.1 `LiveService`

**Méthodes publiques** :

```typescript
startLive(sellerId: string, tiktokUsername: string): Promise<LiveSessionDocument>
stopLive(sellerId: string): Promise<void>
setCurrentProduct(sellerId: string, productId: string): Promise<void>
getActiveSession(sellerId: string): Promise<LiveSessionDocument | null>
```

**Comportement attendu** :

1. **`startLive`** :
   - Vérifie qu'aucune session active n'existe pour ce seller (sinon `stopLive` d'abord)
   - Crée la `LiveSession` en base (status `active`)
   - Instancie `TikTokLiveConnection` avec les options : `processInitialData: false`, `requestPollingIntervalMs: 2000`
   - Branche les listeners (cf. 5.1.2)
   - Appelle `connection.connect()` — si échec, marque la session `failed` et throw
   - Stocke la connexion dans une `Map<sellerId, TikTokLiveConnection>` interne
   - Retourne le document de session

2. **`stopLive`** :
   - Si pas de connexion active : ne rien faire (idempotent)
   - Appelle `connection.disconnect()`
   - Retire de la Map
   - Met à jour la session : `status: 'ended'`, `endedAt: now`
   - Émet `live.ended` sur l'event bus

3. **`setCurrentProduct`** :
   - Update la session active avec `currentProductId`
   - Émet `live.product.changed` sur l'event bus
   - **Important** : si aucune session active → throw `BadRequestException('No active live session')`

4. **Reconnexion automatique** : sur `DISCONNECTED` non volontaire, tenter reconnexion avec backoff exponentiel (5s, 10s, 20s, 40s, max 30s plafond) jusqu'à 5 tentatives. Au-delà, log error et émettre `live.failed`.

5. **`onModuleDestroy`** : déconnecter toutes les connexions actives proprement.

#### 5.1.2 Événements émis sur l'event bus interne

| Event name | Payload | Émis quand |
|------------|---------|------------|
| `live.connected` | `{ sellerId, sessionId, roomId }` | Connexion TikTok établie |
| `live.comment.received` | `{ sellerId, sessionId, tiktokCommentId, author, content, timestamp }` | Chaque commentaire capturé |
| `live.gift.received` | `{ sellerId, sessionId, from, diamonds, giftName }` | Cadeau TikTok reçu |
| `live.product.changed` | `{ sellerId, productId }` | Vendeuse change le produit en vedette |
| `live.disconnected` | `{ sellerId }` | Déconnexion TikTok |
| `live.ended` | `{ sellerId, sessionId }` | Live terminé volontairement |
| `live.failed` | `{ sellerId, error }` | Échec définitif après 5 retries |

#### 5.1.3 `LiveController`

| Verb | Route | Body / Params | Description |
|------|-------|---------------|-------------|
| POST | `/live/start` | `{ sellerId, tiktokUsername }` | Démarrer un live |
| POST | `/live/stop` | `{ sellerId }` | Arrêter le live |
| POST | `/live/current-product` | `{ sellerId, productId }` | Changer le produit en vedette |
| GET | `/live/active/:sellerId` | params | Récupérer la session active |
| GET | `/live/sessions/:sellerId` | params + query `limit`, `skip` | Historique paginé |

Tous les endpoints valident leur input via DTOs `class-validator`.

### 5.2 `MatchingModule`

#### 5.2.1 `MatchingService`

**Méthode publique** : aucune (le service est event-driven).

**Listeners** :

```typescript
@OnEvent('live.comment.received', { async: true })
async handleComment(event: CommentEvent): Promise<void>
```

**Comportement attendu** :

1. Récupérer la `LiveSession` avec `populate('currentProductId')`
2. Si pas de session : ignorer
3. Persister le `Comment` en base avec status `pending` (et l'index unique sur tiktokCommentId protège des doublons)
4. **Pré-filtrage** sans IA (économie de tokens) :
   - Si pas de `currentProduct` → status `noise`, sortir
   - Si `content.trim().length < 2` → status `noise`, sortir
   - Si content uniquement constitué d'emojis → status `noise`, sortir
5. Appeler GPT-4o-mini avec le prompt système (cf. 5.2.2)
6. Mettre à jour le `Comment` avec le résultat
7. Si `intent === 'order_intent' && confidence > 0.5` :
   - Créer un `Order` avec status `captured`
   - `needsManualReview` = `true` si confidence < 0.7
   - Lier le comment à l'order (`resultingOrderId`)
   - Émettre `order.captured`
   - Incrémenter `totalOrdersCaptured` sur la session

#### 5.2.2 Prompt IA — `order-detection.prompt.ts`

Le prompt est un export d'une fonction qui prend le produit en contexte et retourne le `system_prompt` :

```typescript
export function buildOrderDetectionPrompt(product: Product): string {
  // Le prompt complet est défini dans le code fourni au paragraphe 7.
}
```

**Spécifications du prompt** :
- Doit comprendre le **français**, le **wolof**, et les **mix franco-wolof**
- Doit reconnaître les expressions wolof d'achat : `coumb`, `koumb`, `may ma`, `mayma`, `bagn naa`, `nob naa ko`
- Doit reconnaître les expressions françaises : `je prends`, `moi 1`, `je veux`, `réservez`, `gardez moi`
- Doit extraire la **quantité** (`2`, `deux`, `ñaar`...)
- Doit extraire les **variantes** mentionnées (taille, couleur)
- Doit extraire un éventuel **numéro de téléphone** (formats sénégalais : 70/75/76/77/78 XXX XX XX)
- Sortie format **JSON strict** avec `response_format: { type: 'json_object' }`
- Modèle : `gpt-4o-mini`, `temperature: 0.1`, `max_tokens: 200`

### 5.3 `ProductsModule`

CRUD classique sur Product. Endpoints :

| Verb | Route | Description |
|------|-------|-------------|
| POST | `/products` | Créer un produit |
| GET | `/products?sellerId=` | Lister les produits |
| GET | `/products/:id` | Détail d'un produit |
| PATCH | `/products/:id` | Modifier |
| DELETE | `/products/:id` | Supprimer |

### 5.4 `OrdersModule`

#### 5.4.1 `OrdersService`

**Méthodes publiques** :

```typescript
findAll(filters: { sellerId?, liveSessionId?, status? }, pagination): Promise<Order[]>
findOne(id: string): Promise<OrderDocument>
update(id: string, dto: UpdateOrderDto): Promise<OrderDocument>
confirm(id: string): Promise<OrderDocument>      // Vendeuse valide manuellement
cancel(id: string): Promise<OrderDocument>
exportToCsv(sessionId: string): Promise<string>  // Retourne le CSV en string
```

#### 5.4.2 `OrdersController`

| Verb | Route | Description |
|------|-------|-------------|
| GET | `/orders?sellerId=&liveSessionId=&status=` | Liste filtrée |
| GET | `/orders/:id` | Détail |
| PATCH | `/orders/:id` | Update (qty, variants, phone, etc.) |
| POST | `/orders/:id/confirm` | Marquer comme confirmé |
| POST | `/orders/:id/cancel` | Annuler |
| GET | `/orders/export/:sessionId.csv` | Export CSV |

### 5.5 `EventsModule` — Gateway Socket.IO

Namespace : `/live`

#### 5.5.1 Messages reçus du client

| Event | Payload | Effet |
|-------|---------|-------|
| `seller:join` | `{ sellerId }` | Le client rejoint la room `seller:{sellerId}` |

#### 5.5.2 Messages émis vers le client (room `seller:{sellerId}`)

| Event | Payload | Source |
|-------|---------|--------|
| `live:status` | `{ status: 'connected' \| 'disconnected', roomId? }` | `live.connected` / `live.disconnected` |
| `live:comment` | `{ author, content, timestamp }` | `live.comment.received` |
| `order:new` | `{ order, buyer, confidence, needsReview }` | `order.captured` |
| `live:product-changed` | `{ productId }` | `live.product.changed` |
| `live:ended` | `{ sessionId }` | `live.ended` |

---

## 6. Configuration et environnement

### 6.1 `.env.example`

```env
# Application
NODE_ENV=development
PORT=3000

# MongoDB local
MONGODB_URI=mongodb://localhost:27017/tiktok-live-commerce

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# CORS (pour Socket.IO depuis l'app mobile en dev)
CORS_ORIGIN=*

# TikTok signing (laisser vide en V1 — la lib utilise le signing gratuit)
EULERSTREAM_API_KEY=
```

### 6.2 `configuration.ts`

Utiliser `@nestjs/config` avec un fichier de configuration typé. Toutes les valeurs ci-dessus doivent être accessibles via `ConfigService.get('mongodb.uri')` etc.

---

## 7. Code de référence

Le développeur reçoit en annexe les fichiers de référence suivants (à utiliser comme base, à compléter et raffiner) :

- `02-schemas.ts` — schémas Mongoose complets
- `03-live.service.ts` — service de capture TikTok
- `04-matching.service.ts` — service IA + prompt français/wolof complet
- `05-gateway-controller.ts` — gateway Socket.IO + controller live
- `test-connection.js` — script standalone de test de connexion TikTok

**Le développeur doit** :
- Reprendre la structure et la logique de ces fichiers
- Compléter ce qui manque (DTOs, modules, controllers products/orders, export CSV)
- Adapter les imports à l'arborescence définie en §3
- Ajouter la validation `class-validator` sur tous les DTOs
- Wrapper toutes les routes dans un `ValidationPipe` global

---

## 8. Critères d'acceptation V1

Le projet est livré quand **tous** les critères suivants sont satisfaits.

### 8.1 Démarrage et configuration

- [ ] `npm install` s'exécute sans erreur
- [ ] `npm run start:dev` lance l'app sur `http://localhost:3000`
- [ ] La connexion à MongoDB local s'établit au boot
- [ ] Un fichier `.env.example` est fourni et le `README.md` explique comment le copier en `.env`
- [ ] Le `README.md` documente les commandes : install, start, build, test, et l'exemple de scénario de test manuel

### 8.2 Capture live

- [ ] `POST /live/start` avec un username TikTok actuellement en live → la session passe `active`, le roomId est rempli en moins de 10 secondes
- [ ] Les commentaires arrivent dans la base `comments` au fur et à mesure (vérifiable avec `db.comments.find()`)
- [ ] L'index unique sur `(liveSessionId, tiktokCommentId)` empêche les doublons
- [ ] `POST /live/stop` ferme proprement la connexion et met `status: 'ended'`
- [ ] Si TikTok déconnecte, l'app retente jusqu'à 5 fois avec backoff exponentiel
- [ ] Au shutdown de l'app (`Ctrl+C`), toutes les connexions TikTok sont fermées proprement

### 8.3 Matching IA

- [ ] Un commentaire `"je prends"` avec un produit en vedette → crée un `Order` avec `confidence > 0.8`
- [ ] Un commentaire `"coumb taille M"` sur un produit avec variante taille → crée un `Order` avec `variant: { taille: "M" }`
- [ ] Un commentaire `"sa prix?"` → reste en `matchStatus: 'question'`, pas de commande créée
- [ ] Un commentaire `"❤️❤️"` → `matchStatus: 'noise'`, pas d'appel à l'IA (économie tokens)
- [ ] Sans produit en vedette, aucun appel IA n'est fait sur les commentaires
- [ ] Les commandes avec `confidence < 0.7` ont `needsManualReview: true`

### 8.4 API REST

- [ ] Tous les endpoints répondent correctement (200/201 succès, 400 validation, 404 not found)
- [ ] Validation `class-validator` active sur tous les body
- [ ] L'export CSV retourne un fichier avec colonnes : `Date`, `Acheteur (TikTok)`, `Téléphone`, `Produit`, `Variantes`, `Quantité`, `Total FCFA`, `Statut`, `Confiance IA`

### 8.5 Socket.IO

- [ ] Un client Socket.IO peut se connecter au namespace `/live`
- [ ] Après `seller:join`, le client reçoit bien les events `live:comment`, `order:new`, `live:status`
- [ ] Le test fourni dans le README (un script Node de démo client) fonctionne

### 8.6 Qualité de code

- [ ] Aucun warning ESLint au build
- [ ] TypeScript en `strict: true`
- [ ] Pas de `any` dans le code applicatif (sauf typings tiers inévitables)
- [ ] Tous les services ont au moins un test unitaire couvrant le happy path
- [ ] Aucune clé API ni secret committé dans le code

### 8.7 Démo de bout en bout

Le développeur doit fournir un scénario de démo manuel reproductible dans le README :

1. Démarrer MongoDB local
2. Démarrer l'app
3. Créer un produit via l'API
4. Démarrer un live sur un username TikTok réel actuellement live
5. Définir le produit en vedette
6. Observer dans la console des commandes capturées en temps réel
7. Lister les commandes via l'API
8. Exporter en CSV
9. Stopper le live

---

## 9. Étapes de développement recommandées (ordre)

Pour Claude Code : il est conseillé de suivre cet ordre pour un développement incrémental et testable à chaque étape :

1. **Bootstrap** : projet NestJS vierge, config, MongoDB, `.env`
2. **Schémas Mongoose** : créer les 4 schemas et leurs index
3. **ProductsModule** : CRUD basique testable via Postman
4. **LiveService standalone** : connexion TikTok + log des commentaires en console (sans encore de matching)
5. **Persistance des comments** : brancher l'event `live.comment.received` pour stocker en base
6. **MatchingService** : ajouter l'IA et la création d'orders
7. **OrdersModule** : endpoints REST + export CSV
8. **EventsGateway** : Socket.IO + tests avec un client de démo
9. **Tests unitaires** sur LiveService et MatchingService
10. **README.md** complet avec scénario de démo

À chaque étape, **valider que ça tourne** avant de passer à la suivante. Ne pas tout coder d'un coup.

---

## 10. Points d'attention pour Claude Code

### 10.1 Le piège des connexions WebSocket

`tiktok-live-connector` ouvre un WebSocket persistant. Le service doit :
- Stocker les connexions dans une Map locale au service
- Implémenter `OnModuleDestroy` pour les fermer toutes au shutdown
- Ne **jamais** créer une nouvelle connexion sans avoir fermé l'ancienne pour le même seller

### 10.2 Le piège des appels IA en cascade

Sur un live actif, on peut recevoir 10+ commentaires/seconde. L'event listener `@OnEvent('live.comment.received', { async: true })` doit traiter chaque commentaire **en parallèle** sans bloquer. C'est déjà géré par `async: true`, mais il faut aussi :
- **Pré-filtrer** sans appel IA les commentaires triviaux (cf. règles §5.2.1)
- Ne **pas** awaiter les calls dans des chaînes synchrones

### 10.3 Le piège des variantes

Le matching IA peut retourner `variants: { taille: "M" }` même si le produit n'a pas cette variante. Il faut **valider** que les variantes retournées correspondent à celles du produit avant de les mettre dans l'order, sinon ignorer cette variante (et laisser `needsManualReview: true`).

### 10.4 Sécurité de base

Même en V1 locale, prévoir :
- `helmet` activé
- CORS configuré via `.env`
- Rate limiting basique (`@nestjs/throttler`) sur les endpoints publics : 100 req/min/IP

---

## 11. Livrables attendus

À la fin du développement, le développeur livre :

1. Le code source complet sur Git (avec `.gitignore` correct)
2. Un `README.md` complet et exécutable de bout en bout
3. Un fichier `.env.example` complet
4. Une collection Postman ou un fichier `.http` (REST Client) avec tous les endpoints prêts à tester
5. Un script Node `demo-client.js` qui démontre la consommation Socket.IO
6. Tests unitaires des deux services critiques (Live, Matching)

---

## 12. Hors scope absolu

Le développeur **ne doit pas** ajouter, même en suggestion :
- D'authentification JWT (V1 mono-tenant local)
- De système de rôles
- De Docker/Compose (sera fait dans une étape de déploiement séparée)
- De CI/CD
- D'intégration Wave / Orange Money / WhatsApp
- D'app mobile React Native (un autre projet Expo s'en occupera)
- De traductions i18n
- De Swagger/OpenAPI (V2)

Tout ajout hors scope sera considéré comme du sur-engineering et devra être justifié.

---

**Fin du cahier des charges V1.**
