/**
 * demo-client.js — Client Socket.IO de démonstration
 *
 * Simule l'app mobile de la vendeuse : se connecte au namespace /live
 * et affiche en temps réel les commentaires, commandes et statuts.
 *
 * Usage :
 *   npm install socket.io-client
 *   SELLER_ID=default-seller node demo-client.js
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SELLER_ID = process.env.SELLER_ID || 'default-seller';

console.log(`\n🔌 Connexion à ${SERVER_URL}/live...`);
console.log(`👤 Seller ID : ${SELLER_ID}\n`);

const socket = io(`${SERVER_URL}/live`, {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log(`✅ Connecté au namespace /live (socket: ${socket.id})`);

  // Rejoindre la room du vendeur pour recevoir les events ciblés
  socket.emit('seller:join', { sellerId: SELLER_ID }, (response) => {
    console.log(`📦 Rejoint la room seller:${SELLER_ID}`, response);
    console.log('\n--- EN ÉCOUTE (Ctrl+C pour arrêter) ---\n');
  });
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Déconnecté : ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error(`❌ Erreur de connexion : ${err.message}`);
  console.error('  → Vérifiez que le serveur tourne sur', SERVER_URL);
});

// Statut du live TikTok
socket.on('live:status', (data) => {
  if (data.status === 'connected') {
    console.log(`🟢 [LIVE] Connecté — Room TikTok : ${data.roomId}`);
  } else {
    console.log(`🔴 [LIVE] Déconnecté`);
  }
});

// Commentaires en temps réel
socket.on('live:comment', (data) => {
  console.log(
    `💬 [@${data.author.uniqueId}] "${data.content}" — ${new Date(data.timestamp).toLocaleTimeString()}`,
  );
});

// Nouvelle commande capturée par l'IA
socket.on('order:new', (data) => {
  const flag = data.needsReview ? '⚠️  [À VALIDER]' : '✅';
  const item = data.order.items?.[0];
  console.log(
    `\n${flag} COMMANDE CAPTURÉE`,
    `\n   Acheteur : @${data.buyer.uniqueId}`,
    `\n   Produit  : ${item?.productName ?? 'N/A'}`,
    `\n   Quantité : ${item?.quantity ?? 1}`,
    `\n   Total    : ${data.order.totalFCFA} FCFA`,
    `\n   Confiance: ${(data.confidence * 100).toFixed(0)}%\n`,
  );
});

// Changement de produit en vedette
socket.on('live:product-changed', (data) => {
  console.log(`📦 Produit en vedette changé → ${data.productId}`);
});

// Fin du live
socket.on('live:ended', (data) => {
  console.log(`🏁 Live terminé (session: ${data.sessionId})`);
});
