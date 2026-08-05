const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration — see https://reactnative.dev/docs/metro
 *
 * `watchFolders`/`nodeModulesPaths`/`unstable_enableSymlinks` are required
 * for this to work inside a pnpm workspace: pnpm hoists shared
 * dependencies (e.g. @babel/runtime) into the monorepo root's
 * node_modules and links packages via symlinks, neither of which Metro
 * follows by default.
 */
const config = {
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    unstable_enableSymlinks: true,
  },
  watchFolders: [workspaceRoot],
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
