/** Entry point for @dos/config — re-exports the shared ESLint configs for convenience. */
module.exports = {
  eslintBase: require('./eslint/base'),
  eslintReact: require('./eslint/react'),
  eslintNode: require('./eslint/node'),
};
