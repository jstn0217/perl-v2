import { createApp } from './app.js';
import { env, validateRuntimeEnvironment } from './config/env.js';
import { createRepositories, initializeRepositoryLayer } from './repositories/index.js';

const startServer = async () => {
  validateRuntimeEnvironment();
  await initializeRepositoryLayer(env.dataLayer);

  const repositories = createRepositories(env.dataLayer);
  const app = createApp(repositories);

  app.listen(env.port, () => {
    console.log(`perl-api listening on port ${env.port} with DATA_LAYER=${env.dataLayer}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start perl-api:', error);
  process.exit(1);
});
