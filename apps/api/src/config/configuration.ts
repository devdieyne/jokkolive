export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodb: {
    uri:
      process.env.MONGODB_URI ??
      'mongodb://localhost:27017/jokkolive',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
  waha: {
    baseUrl: process.env.WAHA_BASE_URL ?? '',
    apiKey: process.env.WAHA_API_KEY ?? '',
    session: process.env.WAHA_SESSION ?? 'default',
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
