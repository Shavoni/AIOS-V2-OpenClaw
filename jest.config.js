module.exports = {
  transform: {
    'public[\\\\/]js[\\\\/].+\\.js$': './jest-esm-transform.js',
  },
  transformIgnorePatterns: [
    'node_modules/',
  ],
};
