// Resolves the library from ../src so the example always runs the working copy.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const exampleModules = path.resolve(__dirname, 'node_modules');
const escape = value => value.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');

const config = getDefaultConfig(__dirname);

config.watchFolders = [root];
// The library's own dev copies of React must never be bundled next to the example's.
config.resolver.blockList = [
  new RegExp(`^${escape(path.join(root, 'node_modules'))}[/\\\\](react|react-native|@react-native)[/\\\\].*`),
];
config.resolver.nodeModulesPaths = [exampleModules];
config.resolver.extraNodeModules = {
  'react-native-viewport-detector': path.resolve(root, 'src'),
  react: path.join(exampleModules, 'react'),
  'react-native': path.join(exampleModules, 'react-native'),
};

module.exports = config;
