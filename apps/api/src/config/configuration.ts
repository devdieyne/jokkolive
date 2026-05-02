export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodb: {
    /**
     * URI complète Mongo (ex: `mongodb+srv://user:pass@cluster.mongodb.net/`).
     * Sur Google Cloud avec MongoDB Atlas, c'est l'URL fournie par Atlas.
     */
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
    /**
     * Nom de la database. Séparé de l'URI pour pouvoir utiliser une URI
     * Atlas générique et choisir la DB par environnement (prod/staging).
     */
    dbName: process.env.MONGO_DB_NAME ?? 'jokkolive',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
  whatsapp: {
    cloud: {
      graphVersion: process.env.WHATSAPP_CLOUD_GRAPH_VERSION ?? 'v21.0',
      phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? '',
      wabaId: process.env.WHATSAPP_CLOUD_WABA_ID ?? '',
      token: process.env.WHATSAPP_CLOUD_TOKEN ?? '',
      appSecret: process.env.WHATSAPP_CLOUD_APP_SECRET ?? '',
      verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? '',
    },
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  psp: {
    active: process.env.ACTIVE_PSP ?? 'diamanopay',
    diamanoPay: {
      token: process.env.DIAMANO_PAY_TOKEN ?? '',
      baseUrl:
        process.env.DIAMANO_PAY_BASE_URL ?? 'https://api.diamanopay.com',
    },
    feeFlat: parseInt(process.env.PLATFORM_FEE_FLAT ?? '50', 10),
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '0.02'),
  },
  admin: {
    phone: process.env.ADMIN_PHONE ?? '+221776583181',
    pseudo: process.env.ADMIN_PSEUDO ?? 'admin',
  },
});
