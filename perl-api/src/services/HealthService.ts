import type { RepositorySet } from '../repositories/index.js';

export class HealthService {
  constructor(private readonly repositories: RepositorySet) {}

  getStatus() {
    return {
      ok: true,
      dataLayer: 'mock',
      repositories: Object.keys(this.repositories).sort()
    };
  }
}
