module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/../jest-setup.ts'],
};
