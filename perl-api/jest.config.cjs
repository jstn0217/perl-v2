module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Many integration tests do several bcrypt (cost 12) logins each; on a loaded
  // machine the 5s jest default produces false timeout failures. 30s still
  // catches real hangs.
  testTimeout: 30000,
  passWithNoTests: true,
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  }
};
