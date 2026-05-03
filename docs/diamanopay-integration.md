# Intégration DiamanoPay : paiement + retrait automatique vendeur

Documentation technique pour reproduire le flow paiement / payout / auto-payout
de JokkoLive dans une autre application (NestJS + Mongoose, mais le pattern
s'adapte à n'importe quel stack).

> ⚠️ **Source de vérité** : ce doc reflète l'implémentation réelle dans
> `apps/api/src/payments/`. Les snippets sont extraits du code, pas inventés.

---

## 1. Vue d'ensemble

DiamanoPay est un PSP mobile money sénégalais qui permet :
- **Charges** (PAY_IN) : encaisser un acheteur via Wave ou Orange Money
- **Payouts** (PAY_OUT) : virer de l'argent vers un compte mobile money

L'intégration repose sur **3 entités persistées**, **2 endpoints HTTP DiamanoPay**,
et **1 webhook entrant**.

### Entités

| Entité | Rôle |
|---|---|
| `PaymentLink` | URL unique de paiement pour une commande. Détient `pspChargeId`, `paymentUrl`, montant, statut. |
| `SellerBalance` | Solde par vendeur **et par provider** (Wave, OrangeMoney séparés). 2 buckets : `available` (retirable), `pending` (lock pendant payout). |
| `Payout` | Demande de retrait (manuelle ou auto). Lifecycle: `pending → processing → success | failed`. |
| `BalanceTransaction` | Ledger immuable : trace toutes les variations de solde (credit, debit, reverse). |

### Flow général

```
ACHETEUR ──┐                                                   ┌── VENDEUR
           │                                                   │
           ▼                                                   │
  ┌──────────────────────┐    POST /api/charges                │
  │  initiateCheckout    │───────────────────────────►  DiamanoPay
  │  (PaymentLink token) │   ◄──── chargeId + paymentUrl       │
  └──────────────────────┘                                     │
           │                                                   │
           │ redirect vers paymentUrl                          │
           ▼                                                   │
       Wave/OM page paiement                                   │
           │                                                   │
           │ paiement effectué                                 │
           ▼                                                   │
                          POST /webhooks/diamanopay            │
  DiamanoPay ─────────────────────────────────────► API        │
                                                       │       │
                                                       ▼       │
                                          GET /api/transaction │
                                                       │       │
                                                       │ verify│
                                                       ▼       │
                                          creditFromPayment    │
                                                       │       │
                                            ┌──────────┼─────────────┐
                                            │          │             │
                                            ▼          ▼             ▼
                                      SellerBalance  Order      Notif WhatsApp
                                       += net      → paid      vendeur+acheteur
                                            │
                                            ▼
                              [Si autoPayoutEnabled]
                              triggerAutoPayout (fire-and-forget)
                                            │
                                            ▼
                                    POST /api/payout ──► DiamanoPay ──► VENDEUR
                                            │                            (mobile money)
                                            ▼
                                     Si erreur :
                                     - Solde restauré
                                     - Notif WhatsApp seller + admins
```

---

## 2. Configuration & secrets

```bash
# Token API (depuis le dashboard DiamanoPay)
DIAMANO_PAY_TOKEN=...
DIAMANO_PAY_BASE_URL=https://api.diamanopay.com

# Frais plateforme par défaut (overridables par vendeur)
PLATFORM_FEE_FLAT=50      # FCFA
PLATFORM_FEE_PERCENT=0.02 # décimal 0..1

# URL publique de l'API (pour construire le webhook URL transmis à DiamanoPay)
PUBLIC_BASE_URL=https://api.example.com

# URL du front (pour le redirectUrl post-paiement)
FRONTEND_URL=https://app.example.com
```

---

## 3. Provider DiamanoPay (HTTP client)

Le code complet est dans
[`apps/api/src/payments/providers/diamanopay.provider.ts`](../apps/api/src/payments/providers/diamanopay.provider.ts).

Trois méthodes essentielles :

### 3.1 `createCharge` — encaisser un acheteur

```ts
async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const payload = {
    amount: input.amount,
    provider: input.provider,         // 'WAVE' | 'ORANGE_MONEY'
    description: input.description,
    clientReference: input.clientReference,  // ton ID interne, idempotency key
    redirectUrl: input.redirectUrl,    // où l'acheteur revient après paiement
    webhook: input.webhookUrl,         // ton webhook (cf. §5)
    extraData: input.extraData ?? {},  // metadata libre — reviendra dans le webhook
  };
  // POST https://api.diamanopay.com/api/charges
  const res = await this.request<ChargeApiResponse>('POST', '/api/charges', payload);

  return {
    pspChargeId: res.chargeId ?? res.id!,
    paymentUrl: res.paymentUrl!,         // URL hosted par DiamanoPay
    qrCodeData: res.qrCodeData,
    expiresAt: res.expiresAt ? new Date(res.expiresAt) : undefined,
  };
}
```

**Important** :
- `clientReference` doit être unique côté toi → idempotency. Format conseillé :
  `JK-<orderId>-<paymentLinkToken>`.
- `extraData` est renvoyé dans le webhook → utilise-le pour stocker
  `paymentLinkToken`, `sellerId`, `orderId` (c'est ce qui te permet de
  retrouver ta commande à la réception du webhook sans relire la DB par
  reference fragile).
- Le `paymentUrl` retourné est **hosted par DiamanoPay** (page de paiement
  Wave/OM avec leur UI). Tu redirects l'acheteur dessus.

### 3.2 `createPayout` — virer vers un mobile money

```ts
async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
  const payload = {
    amount: input.amount,
    mobile: input.mobile,              // 9 chiffres locaux, sans indicatif
    provider: input.provider,          // 'WAVE' | 'ORANGE_MONEY'
    name: input.recipientName,
    description: input.description,
    clientReference: input.clientReference, // idempotency key (ex JKPO-xxxx)
  };
  // POST https://api.diamanopay.com/api/payout
  const res = await this.request<PayoutApiResponse>('POST', '/api/payout', payload);

  if (res.success !== true) {
    throw new DiamanoPayError(res.message || 'Échec du payout DiamanoPay');
  }
  return {
    pspTransactionId: res.transactionId!,
    pspProviderTransactionId: res.providerTransactionId,
  };
}
```

**Idempotency** : `clientReference` ≤ 50 chars. Format conseillé :
`<PREFIX>-<sellerIdSlice>-<uuidSlice>` (ex : `JKPO-79bf9ea0-94b558d5`).

### 3.3 `getTransaction` — vérification authoritative

⚠️ **Ne JAMAIS faire confiance au payload du webhook.** À la réception
d'un webhook, on appelle DiamanoPay pour récupérer l'état réel :

```ts
async getTransaction(transactionId: string): Promise<TransactionDetails> {
  // GET https://api.diamanopay.com/api/transaction/{id}
  const res = await this.request<TransactionApiResponse>(
    'GET',
    `/api/transaction/${encodeURIComponent(transactionId)}`,
  );

  // Convention DiamanoPay : pas de champ `status` — un 200 = SUCCESS,
  // les erreurs 4xx/5xx remontent en exceptions (cf. request()).
  return {
    id: res.id ?? res.transactionId ?? transactionId,
    amount: res.amount ?? 0,             // signé : négatif pour PAY_OUT
    status: 'SUCCESS',
    paymentMethod: (res.paymentMethod === 'ORANGE_MONEY' ? 'ORANGE_MONEY' : 'WAVE'),
    transactionType: res.transactionType === 'PAY_OUT' ? 'PAY_OUT' : 'PAY_IN',
    clientReference: res.clientReference,
    fee: res.fee,
  };
}
```

---

## 4. Flow PAY-IN (encaisser un paiement)

### 4.1 Création du PaymentLink

Dès qu'une commande est créée, on génère un `PaymentLink` (sans appeler
DiamanoPay encore — on attend que l'acheteur **choisisse** son provider) :

```ts
// payments.service.ts
async createLink(input: CreateLinkInput): Promise<PaymentLinkDocument> {
  return this.paymentLinkModel.create({
    token: randomUUID().replace(/-/g, ''),  // URL token public
    orderId: input.orderId,
    sellerId: input.sellerId,
    amount: input.amount,
    currency: input.currency,
    status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });
}
```

L'acheteur reçoit `https://app.example.com/pay/<token>`.

### 4.2 Initiation du paiement (acheteur clique « Payer avec Wave »)

```ts
// payments.service.ts
async initiateCheckout(
  token: string,
  provider: 'WAVE' | 'ORANGE_MONEY',
): Promise<{ paymentUrl: string; qrCodeData?: string }> {
  const link = await this.getByToken(token);

  if (link.status !== 'pending') {
    throw new BadRequestException(`Lien ${link.status}, paiement impossible`);
  }
  if (link.expiresAt.getTime() < Date.now()) {
    throw new BadRequestException('Ce lien a expiré');
  }

  // Idempotence : si une charge existe déjà pour ce provider, on renvoie l'URL
  if (link.pspChargeId && link.paymentMethodUsed === provider && link.externalRef) {
    return { paymentUrl: link.externalRef };
  }

  const charge = await this.psp.createCharge({
    amount: link.amount,
    currency: 'XOF',
    provider,
    description: `Commande JokkoLive ${order.productCode}`,
    clientReference: `JK-${link.orderId}-${link.token}`,
    redirectUrl: this.buildUrl(link.token),     // /pay/<token>
    webhookUrl: `${this.publicBaseUrl}/webhooks/diamanopay`,
    extraData: {
      paymentLinkToken: link.token,    // ← critique pour retrouver le link au webhook
      sellerId: link.sellerId.toString(),
      orderId: link.orderId.toString(),
    },
  });

  // Persiste les refs pour le webhook + idempotence
  link.psp = 'diamanopay';
  link.pspChargeId = charge.pspChargeId;
  link.paymentMethodUsed = provider;
  link.externalRef = charge.paymentUrl; // on stocke l'URL pour idempotence
  await link.save();

  return { paymentUrl: charge.paymentUrl, qrCodeData: charge.qrCodeData };
}
```

### 4.3 Webhook DiamanoPay (paiement confirmé)

DiamanoPay POSTe sur `<webhookUrl>` quand la transaction change d'état.
Le contrôleur :

```ts
// diamanopay-webhook.controller.ts
@Post()
@HttpCode(200)  // toujours 200, sinon DiamanoPay re-tente
async onWebhook(@Body() body: DiamanoPayWebhookDto) {
  if (!body?.transactionId) return { received: true };

  // 1. VÉRIFIER avec le PSP (anti-spoof)
  let tx;
  try {
    tx = await this.psp.getTransaction(body.transactionId);
  } catch (err) {
    // Ack quand même — DiamanoPay re-tentera
    this.logger.error(`Vérification échouée: ${err}`);
    return { received: true };
  }

  if (tx.status !== 'SUCCESS') return { received: true };

  // 2. RETROUVER le PaymentLink — 3 stratégies en cascade
  const tokenFromExtra = body.extraData?.paymentLinkToken; // priorité
  let link = tokenFromExtra
    ? await this.paymentsService.getByToken(tokenFromExtra).catch(() => null)
    : null;

  // Fallback 1 : depuis clientReference (format JK-<orderId>-<token>)
  if (!link && tx.clientReference) {
    const tokenFromRef = tx.clientReference.split('-').pop();
    if (tokenFromRef) {
      link = await this.paymentsService.getByToken(tokenFromRef).catch(() => null);
    }
  }

  // Fallback 2 : par pspChargeId (cas rare)
  if (!link) link = await this.paymentsService.findByPspChargeId(tx.id);

  if (!link) {
    this.logger.warn(`PaymentLink introuvable pour tx=${body.transactionId}`);
    return { received: true };
  }

  // 3. IDEMPOTENCE : déjà payé → on ack et sort
  if (link.status === 'paid') return { received: true };
  if (link.status !== 'pending') return { received: true };

  // 4. CRÉDITER le solde vendeur (cf. §6)
  await this.balanceService.creditFromPayment(link, tx);

  // 5. AUTO-PAYOUT fire-and-forget (cf. §7)
  if (link.sellerNet > 0 && link.paymentMethodUsed) {
    void this.payoutService
      .triggerAutoPayout(link.sellerId.toString(), link.sellerNet, link.paymentMethodUsed)
      .catch((err) => this.logger.error(`auto-payout error: ${err}`));
  }

  return { received: true };
}
```

**Règles d'or** :
- ✅ Toujours répondre `200` (sinon retry → DDoS implicite)
- ✅ Toujours vérifier la transaction côté PSP avant de créditer
- ✅ Idempotence sur `link.status === 'paid'` — verrou
- ✅ Auto-payout en fire-and-forget pour ne pas bloquer le 200

---

## 5. Sécurité du webhook

DiamanoPay actuel ne signe pas les webhooks (pas de HMAC). On se protège par :

1. **Vérification authoritative** : à chaque webhook, on appelle
   `getTransaction()` côté PSP. Le payload est juste un *signal*, pas une
   donnée de confiance.
2. **Webhook URL avec token query** (option) : si le PSP supporte les
   query params, ajouter `?secret=xxx` et vérifier côté contrôleur.
3. **Rate limiting** par IP via `@nestjs/throttler` (déjà en place).

> Si tu intègres un PSP qui signe (Stripe HMAC-SHA256, Meta WhatsApp Cloud,
> etc.), VERIFIE la signature en plus, comme on le fait dans
> [`cloud-webhook.controller.ts:verifySignature()`](../apps/api/src/whatsapp/cloud-webhook.controller.ts).

---

## 6. Crédit du solde + ledger

Le module `BalanceService` gère atomiquement le solde vendeur. Voici la
méthode clé :

```ts
// balance.service.ts
async creditFromPayment(link: PaymentLinkDocument, tx: TransactionDetails) {
  const provider = link.paymentMethodUsed ?? tx.paymentMethod ?? 'WAVE';

  // Frais plateforme : override seller en priorité, sinon valeurs env
  const seller = await this.userModel.findById(link.sellerId).exec();
  const { fee, net } = this.computeFee(link.amount, seller?.platformFee);

  // 1. Verrou d'idempotence : marquer le link 'paid' EN PREMIER
  link.status = 'paid';
  link.paidAt = new Date();
  link.platformFee = fee;
  link.sellerNet = net;
  link.externalRef = tx.id;
  link.paymentMethodUsed = provider;
  await link.save();

  // 2. Marquer la commande payée
  await this.orderModel.findByIdAndUpdate(link.orderId, {
    $set: { status: 'paid', paidAt: new Date() },
  });

  // 3. Incrémenter le solde — UN BUCKET PAR (sellerId, provider)
  const balance = await this.getOrCreateBalance(link.sellerId, provider);
  balance.available += net;
  await balance.save();

  // 4. Ledger immuable — chaque mouvement de solde tracé
  await this.txModel.create({
    sellerId: link.sellerId,
    provider,
    type: 'credit',
    amount: net,
    availableAfter: balance.available,
    pendingAfter: balance.pending,
    relatedOrderId: link.orderId,
    description: `Paiement commande (frais ${fee} XOF retenus)`,
  });

  // 5. Notifications WhatsApp non-bloquantes (vendeur + acheteur)
  // ... try/catch silencieux, jamais throw
}
```

### Calcul des frais

```ts
function computeFee(amount: number, override?: { flat: number; percent: number }) {
  const flat = override?.flat ?? this.feeFlat;        // env PLATFORM_FEE_FLAT
  const percent = override?.percent ?? this.feePercent; // env PLATFORM_FEE_PERCENT
  const fee = flat + Math.round(amount * percent);
  const net = Math.max(0, amount - fee);
  return { fee, net };
}
```

### Pourquoi pas de transaction Mongo ?

Mongo standalone (cas typique en dev / Atlas free tier) ne supporte pas les
transactions multi-document. On garantit la cohérence par :
- **Ordre des écritures** : link.status='paid' EN PREMIER → si crash
  ensuite, le lien est marqué payé → idempotence préservée au prochain
  retry du webhook.
- **Logs structurés** : un job de réconciliation peut détecter les états
  bancals (link paid mais pas de BalanceTransaction).

Si tu déploies sur un cluster replica set (Atlas M10+), tu peux entourer
ces 4 writes d'une transaction Mongoose pour la robustesse.

---

## 7. Auto-payout (retrait automatique)

### Toggle vendeur

Champ sur le User :
```ts
@Prop({ default: false })
autoPayoutEnabled!: boolean;
```

Endpoint pour qu'il l'active dans Settings :
```
PATCH /me/auto-payout   { enabled: boolean }
```

### Routage automatique provider → numéro

```ts
// payout.service.ts
async triggerAutoPayout(sellerId: string, amount: number, provider: ChargeProvider) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  const user = await this.userModel.findById(sellerId).exec();
  if (!user?.autoPayoutEnabled) return;

  // Wave → wave.mobile, OM → orangeMoney.mobile
  const account = provider === 'WAVE'
    ? user.payoutAccounts?.wave
    : user.payoutAccounts?.orangeMoney;

  if (!account?.mobile) {
    this.logger.warn(`auto-payout skipped: no ${provider} account`);
    return;
  }

  try {
    await this.requestPayout(sellerId, { amount, provider });
  } catch (err) {
    // requestPayout a déjà reverse le solde → l'argent reste disponible
    void this.notifyAutoPayoutFailure(user, amount, provider, err.message);
  }
}
```

### Le `requestPayout` réutilise le flow manuel

Même fonction que pour les retraits manuels — donc 1 seul code path à
maintenir :

```ts
async requestPayout(sellerId: string, dto: { amount; provider }) {
  // 1. Validation amount + compte mobile money configuré
  const user = await this.userModel.findById(sellerId).exec();
  const account = dto.provider === 'WAVE'
    ? user.payoutAccounts?.wave
    : user.payoutAccounts?.orangeMoney;
  if (!account?.mobile) throw new BadRequestException('Compte non configuré');

  // 2. Vérification solde
  const balance = await this.balanceService.getOrCreateBalance(sellerId, dto.provider);
  if (balance.available < dto.amount) {
    throw new BadRequestException(`Solde insuffisant: ${balance.available}`);
  }

  // 3. Création du Payout doc
  const clientReference = `JKPO-${sellerId.slice(-8)}-${randomUUID().slice(0, 8)}`;
  const payout = await this.payoutModel.create({
    sellerId, provider: dto.provider, amount: dto.amount, mobile: account.mobile,
    psp: 'diamanopay', clientReference, status: 'pending',
  });

  // 4. LOCK le solde : available → pending
  await this.balanceService.debitForPayout(payout);
  payout.status = 'processing';
  await payout.save();

  // 5. Appel PSP
  try {
    const result = await this.psp.createPayout({
      amount: dto.amount, mobile: account.mobile, provider: dto.provider,
      recipientName: user.displayName, description: 'Retrait', clientReference,
    });
    // SUCCÈS : confirme (drain le pending)
    payout.status = 'success';
    payout.pspTransactionId = result.pspTransactionId;
    await payout.save();
    await this.balanceService.confirmPayout(payout);
    return payout;
  } catch (err) {
    // ÉCHEC : reverse le pending → available restauré
    payout.status = 'failed';
    payout.failureReason = err.message;
    await payout.save();
    await this.balanceService.reversePayout(payout, err.message);
    throw new BadRequestException(`Retrait refusé: ${err.message}`);
  }
}
```

### États du solde pendant un payout

```
État initial          available: 10000   pending: 0

debitForPayout(5000)  available:  5000   pending: 5000   ← lock
                          │
                          ▼ PSP success
confirmPayout            available:  5000   pending:   0   ← drain
                          │
                          ▼ PSP error
reversePayout            available: 10000   pending:   0   ← rollback
```

### Notifications en cas d'échec auto-payout

```ts
private async notifyAutoPayoutFailure(seller, amount, provider, reason) {
  // → Vendeur : "argent toujours dispo, retire manuellement"
  await this.whatsapp.sendText(seller.phone, [
    '⚠️ Retrait automatique échoué',
    `Nous n'avons pas pu envoyer ${amount} XOF sur votre ${provider}.`,
    'Votre argent est toujours disponible — retirez-le manuellement.',
  ].join('\n')).catch(() => {});

  // → Tous les admins : alerte avec contexte
  const admins = await this.userModel.find({ role: 'admin' }).exec();
  for (const admin of admins) {
    await this.whatsapp.sendText(admin.phone, [
      '🚨 Auto-payout échoué',
      `Vendeur: ${seller.displayName} (@${seller.pseudo})`,
      `Montant: ${amount} XOF (${provider})`,
      `Raison: ${reason}`,
    ].join('\n')).catch(() => {});
  }
}
```

---

## 8. Schémas Mongo (récap)

```ts
// PaymentLink
{
  token: string;          // URL public, unique
  orderId: ObjectId;
  sellerId: ObjectId;
  amount: number;         // FCFA
  currency: 'XOF';
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: Date;
  paidAt?: Date;
  platformFee?: number;
  sellerNet?: number;
  psp?: string;           // 'diamanopay'
  pspChargeId?: string;
  paymentMethodUsed?: 'WAVE' | 'ORANGE_MONEY';
  externalRef?: string;   // ici on stocke aussi paymentUrl pour idempotence
}

// SellerBalance — UN par (sellerId, provider)
{
  sellerId: ObjectId;
  provider: 'WAVE' | 'ORANGE_MONEY';
  currency: 'XOF';
  available: number;      // retirable
  pending: number;        // locké pendant payout en cours
}

// Payout
{
  sellerId: ObjectId;
  provider: 'WAVE' | 'ORANGE_MONEY';
  amount: number;
  mobile: string;
  psp: 'diamanopay';
  clientReference: string;  // unique, idempotency
  status: 'pending' | 'processing' | 'success' | 'failed';
  pspTransactionId?: string;
  failureReason?: string;
  completedAt?: Date;
}

// BalanceTransaction (ledger immuable, append-only)
{
  sellerId: ObjectId;
  provider: 'WAVE' | 'ORANGE_MONEY';
  type: 'credit' | 'debit' | 'reverse';
  amount: number;             // signé selon le type
  availableAfter: number;     // snapshot après l'opération
  pendingAfter: number;
  relatedOrderId?: ObjectId;
  relatedPayoutId?: ObjectId;
  description: string;
}
```

---

## 9. Checklist d'intégration dans un autre projet

- [ ] Définir les 4 schémas Mongo (PaymentLink, SellerBalance, Payout, BalanceTransaction)
- [ ] Implémenter le `PaymentProvider` interface (le tien wrappe DiamanoPay)
- [ ] Endpoint public `GET /pay/:token` → page de checkout (Wave / OM choice)
- [ ] Endpoint `POST /pay/:token/checkout { provider }` → `initiateCheckout()` → redirect
- [ ] Endpoint `POST /webhooks/diamanopay` → vérification + crédit + auto-payout trigger
- [ ] User schema : ajouter `autoPayoutEnabled`, `payoutAccounts: { wave, orangeMoney }`
- [ ] Endpoint `PATCH /me/auto-payout { enabled }` (vendeur connecté)
- [ ] Endpoint `PATCH /me/payout-accounts { wave?, orangeMoney? }`
- [ ] Endpoint `POST /me/payouts { amount, provider }` pour retrait manuel
- [ ] Configuration côté DiamanoPay dashboard : webhook URL = `https://api.tonapp.com/webhooks/diamanopay`
- [ ] Rate-limit + Throttler sur les endpoints publics
- [ ] Logs structurés pour réconciliation a posteriori

---

## 10. Pièges courants

| Piège | Symptôme | Fix |
|---|---|---|
| Faire confiance au payload webhook | Faux paiements créés depuis n'importe quel POST | TOUJOURS `getTransaction(id)` avant de créditer |
| Pas d'idempotence | Double crédit sur retry du webhook | Vérifier `link.status === 'paid'` en sortie immédiate |
| Crédit synchrone bloquant le webhook | `504 timeout` côté DiamanoPay → retry storm | Auto-payout en fire-and-forget après le crédit |
| `clientReference` non unique | DiamanoPay refuse le payout | Inclure un UUID dans le clientReference |
| Solde négatif possible | Bug : 2 payouts concurrents drainent | `debitForPayout` atomique avec check `available >= amount` |
| Notif WhatsApp throw → casse le flow | Webhook répond 500 inutilement | Wrapper `.catch(() => {})` sur les notifications |
| `mobile` avec indicatif | DiamanoPay rejette | Stocker 9 chiffres locaux only (Sénégal), pas `+221` |
| Frais hardcodés | Impossible de personnaliser par vendeur | `User.platformFee?: { flat, percent }` override |

---

## Références

- Code source : [`apps/api/src/payments/`](../apps/api/src/payments/)
- Schéma User (autoPayoutEnabled, payoutAccounts, platformFee) : [`apps/api/src/schemas/user.schema.ts`](../apps/api/src/schemas/user.schema.ts)
- Webhook contrôleur : [`apps/api/src/payments/diamanopay-webhook.controller.ts`](../apps/api/src/payments/diamanopay-webhook.controller.ts)
- DiamanoPay API officielle : (consulter le dashboard DiamanoPay pour la doc à jour)
