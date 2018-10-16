module.exports = function (api) {
  /** @type {string} */
  const envName = api.env();

  const [env, platform] = envName.split('-');

  var presets;
  var plugins;

  const isDev = env !== 'production';
  const isWeb = platform === 'web';
  const isElectron = platform === 'electron';

  if (isWeb || isElectron) {
    presets = webElectronPresets(isWeb);
    plugins = webElectronPlugins(isDev);
  } else {
    presets = ["module:metro-react-native-babel-preset"];
    plugins = [];
  }

  return {
    presets,
    plugins,
  };
}

const webTargets = {
  browsers: [
    // ~2 years:
    'last 2 iOS major versions',
    'last 2 Safari major versions',
    // ~1 year:
    'last 2 Edge versions',
    // 6 months:
    'last 4 Chrome versions',
    'last 4 Firefox versions',
  ],
};

const electronTargets = {
  node: 'current',
};

const webElectronPlugins = (isDev) => [
  '@babel/plugin-proposal-class-properties',
  '@babel/plugin-proposal-object-rest-spread',
  '@babel/plugin-transform-classes',
  ...(isDev ? [
    'react-hot-loader/babel',
  ] : []),
];

const webElectronPresets = (isWeb) => [
  [
    '@babel/preset-env',
    {
      loose: true,
      modules: false,
      useBuiltIns: 'usage',
      targets: isWeb ? webTargets : electronTargets,
    },
  ],
  '@babel/preset-react',
  '@babel/preset-typescript',
];
