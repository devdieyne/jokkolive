// test-connection.js
// À lancer avant tout, pour valider que tu peux capturer les commentaires.
//
// Usage :
//   1. npm install tiktok-live-connector
//   2. Trouve une vendeuse sénégalaise actuellement en live sur TikTok
//   3. node test-connection.js <username>
//      Exemple : node test-connection.js momo_rassoul

const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const username = process.argv[2];
if (!username) {
  console.error('❌ Usage: node test-connection.js <tiktok_username>');
  process.exit(1);
}

console.log(`🔌 Tentative de connexion à @${username}...`);

const connection = new TikTokLiveConnection(username, {
  processInitialData: false,
  requestPollingIntervalMs: 2000,
});

let stats = {
  comments: 0,
  gifts: 0,
  joins: 0,
  likes: 0,
};

connection.on(ControlEvent.CONNECTED, (state) => {
  console.log(`✅ Connecté ! Room ID: ${state.roomId}`);
  console.log(`👥 Viewers initiaux: ${state.viewerCount || 'N/A'}`);
  console.log(`\n--- ÉCOUTE EN TEMPS RÉEL ---\n`);
});

connection.on(WebcastEvent.CHAT, (data) => {
  stats.comments++;
  // API v2 : les infos user sont dans data.user (pas directement sur data)
  const uniqueId = data.user?.uniqueId ?? '?';
  console.log(`💬 [${uniqueId}] ${data.comment}`);
});

connection.on(WebcastEvent.GIFT, (data) => {
  stats.gifts++;
  const uniqueId = data.user?.uniqueId ?? '?';
  const giftName = data.giftDetails?.giftName ?? 'cadeau';
  const diamonds = data.giftDetails?.diamondCount ?? 0;
  console.log(`🎁 [${uniqueId}] a envoyé ${giftName} (${diamonds}💎)`);
});

connection.on(WebcastEvent.MEMBER, (data) => {
  stats.joins++;
});

connection.on(WebcastEvent.LIKE, (data) => {
  stats.likes++;
});

connection.on(ControlEvent.DISCONNECTED, () => {
  console.log(`\n❌ Déconnecté.`);
  console.log(`📊 Stats finales :`);
  console.log(`   Commentaires : ${stats.comments}`);
  console.log(`   Cadeaux : ${stats.gifts}`);
  console.log(`   Joins : ${stats.joins}`);
  console.log(`   Likes : ${stats.likes}`);
  process.exit(0);
});

connection
  .connect()
  .then(() => {
    console.log(`⏳ En écoute... (Ctrl+C pour arrêter)`);
  })
  .catch((err) => {
    console.error(`❌ Échec connexion: ${err.message}`);
    console.error(`\nCauses possibles :`);
    console.error(`  - L'utilisateur n'est pas en live actuellement`);
    console.error(`  - Le username est incorrect`);
    console.error(`  - TikTok a temporairement bloqué l'IP`);
    console.error(`  - Le système de signing a un problème (réessaye dans 1 min)`);
    process.exit(1);
  });

// Affichage stats toutes les 30 secondes
setInterval(() => {
  console.log(
    `\n📊 [Stats] ${stats.comments} comments | ${stats.gifts} gifts | ${stats.joins} joins | ${stats.likes} likes`,
  );
}, 30000);
