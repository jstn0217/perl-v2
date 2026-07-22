import { createApp } from './app.js';
import { env } from './config/env.js';
import { createRepositories } from './repositories/index.js';

const repositories = createRepositories(env.dataLayer);
const app = createApp(repositories);

app.listen(env.port, () => {
  console.log(`perl-api listening on port ${env.port} with DATA_LAYER=${env.dataLayer}`);
});
