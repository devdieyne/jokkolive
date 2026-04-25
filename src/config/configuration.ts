export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodb: {
    uri:
      process.env.MONGODB_URI ??
      'mongodb://localhost:27017/tiktok-live-commerce',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
  eulerstream: {
    apiKey: process.env.EULERSTREAM_API_KEY ?? '',
  },
});
