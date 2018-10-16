import * as path from 'path';
import * as webpack from 'webpack';

import htmlWebpackPlugin from 'html-webpack-plugin';
import copyWebpackPlugin from 'copy-webpack-plugin';
// @ts-ignore
import scriptExtHtmlWebpackPlugin from 'script-ext-html-webpack-plugin';

// This config file can be used for platforms 'web' or 'electron', and for
// environments 'development' or 'production'.

type Platform = 'web' | 'electron';

interface Env {
  prod?: boolean;
  platform?: Platform;
  profile?: boolean;
  server?: boolean;
}

type LoaderOptions = {
  emitFile?: boolean;
  modern?: boolean;
};
type Loader = (options: LoaderOptions) => webpack.Loader;

type RuleOptions = {
  emitFile?: boolean;
  modern?: boolean;
};

type Config =
  | webpack.Configuration
  | (() => webpack.Configuration)
  | (() => Promise<webpack.Configuration>);

function makeConfig(
  env: Env = {
    prod: false,
    platform: 'web',
    profile: false,
  },
): Config[] {
  let PLATFORM: Platform;
  if (env.platform === 'web' || env.platform === 'electron') {
    PLATFORM = env.platform;
  } else {
    PLATFORM = 'web';
  }

  let NODE_ENV: 'production' | 'development';
  if (env.prod) {
    NODE_ENV = 'production';
  } else {
    NODE_ENV = 'development';
  }

  let PROFILE: boolean;
  if (env.profile) {
    PROFILE = true;
  } else {
    PROFILE = false;
  }

  const log = PROFILE
    ? (_: any) => {
      return;
    }
    : console.log;

  log(`Running Webpack config for platform "${PLATFORM}", with NODE_ENV="${NODE_ENV}"`);

  const ROOT_DIR = path.resolve(__dirname);
  const WEB_DIR = path.resolve(ROOT_DIR, 'web');
  const PLATFORM_DIR = path.resolve(ROOT_DIR, PLATFORM);
  const DIST_DIR = path.resolve(PLATFORM_DIR, 'dist');

  const mkPlatformExt = (platform: string | null) => {
    const ext = platform !== null ? `.${platform}` : '';
    return [`${ext}.tsx`, `${ext}.ts`, `${ext}.js`];
  };

  // All of the dynamic parts of the configuration are specified here:
  const ELECTRON_EXTS = mkPlatformExt('web');
  const WEB_EXTS = mkPlatformExt('web');

  const COMMON_EXTENSIONS = [
    ...mkPlatformExt('webpack'),
    ...mkPlatformExt(null),
    ...mkPlatformExt('windows'),
    ...mkPlatformExt('android'),
    ...mkPlatformExt('ios'),
  ];

  const RESOLVE_EXTENSIONS =
    PLATFORM === 'electron'
      ? [...ELECTRON_EXTS, ...COMMON_EXTENSIONS]
      : [...WEB_EXTS, ...COMMON_EXTENSIONS];

  const isDev = NODE_ENV === 'development';
  const isWeb = PLATFORM === 'web';

  const evalFnOrVal = <T>(fnOrVal: (() => T) | T): T => {
    if (typeof fnOrVal !== 'function') {
        return fnOrVal;
    }
    // @ts-ignore
    return fnOrVal();
  }

  function testIf<R>(test: boolean, ifTrue: (() => R) | R, ifFalse: (() => R) | R): R {
    if (test) {
      return evalFnOrVal(ifTrue);
    }     
    return evalFnOrVal(ifFalse);
  }

  const babelLoader: Loader = ({ modern }) => ({
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      cacheIdentifier: `${NODE_ENV}-${PLATFORM}`,
      envName: `${NODE_ENV}-${PLATFORM}`,
      retainLines: isDev
    },
  });

  // Many OSS React Native packages are not compiled to ES5 before being
  // published. If you depend on uncompiled packages they may cause webpack build
  // errors. To fix this webpack can be configured to compile to the necessary
  // `node_module`.
  let reactNativeModules: webpack.Condition;
  let excludedReactNativeModules: webpack.Condition;
  {
    // Path joiner for *nix or Windows
    const p = String.raw`[\\\/]+`;
    // End of a package name.
    const e = String.raw`(${p})?`;

    reactNativeModules = [
      new RegExp(String.raw`${p}node_modules${p}react-native-`),
      new RegExp(String.raw`${p}node_modules${p}react-navigation`),
      new RegExp(String.raw`${p}node_modules${p}native-base`),
      new RegExp(String.raw`${p}node_modules${p}@expo${p}vector-icons${e}`),
      new RegExp(String.raw`${p}node_modules${p}lottie-react-native${e}`),
      new RegExp(String.raw`${p}node_modules${p}expo${e}`),
    ];

    excludedReactNativeModules = [
      // new RegExp(String.raw`${p}node_modules${p}react-native-web${e}`),
    ];
  }

  const reactNativeLoaders = (options: RuleOptions): webpack.Loader[] => [
    babelLoader(options),
  ];
  const reactNativeConfig: Rule = (options) => ({
    test: /\.js(x?)$/,
    exclude: excludedReactNativeModules,
    include: reactNativeModules,
    use: reactNativeLoaders(options),
  });

  type RuleOptions = {
    emitFile: boolean;
    modern: boolean;
    typecheck?: boolean;
  };
  type Rule = (options: RuleOptions) => webpack.Rule;

  const nativeBaseFontsConfig: Rule = ({ emitFile = true }) => ({
    test: /node_modules[\\\/].*\.(eot|svg|ttf|woff|woff2)$/,
    use: [
      {
        loader: 'file-loader',
        options: {
          emitFile,
          name: 'public/fonts/[name].[ext]',
        },
      },
    ],
  });

  const rlyeh = isDev ? ['rlyeh/lib/webpack'] : [];

  // This is needed for webpack to compile ES6+ JavaScript to ES2015 JS.
  const babelLoaders = (options: RuleOptions): webpack.Loader[] => [
    babelLoader(options),
  ];
  const babelLoaderConfig: Rule = (options) => ({
    test: /\.(j|t)s(x?)$/,
    exclude: /node_modules/,
    use: babelLoaders(options),
  });

  // This is needed for webpack to import static images in JavaScript files
  const imageLoaderConfiguration: Rule = ({ emitFile = true }) => ({
    test: /\.(gif|jpe?g|png|svg)$/,
    use: {
      loader: 'file-loader',
      options: {
        emitFile,
        name: 'static/assets/[name].[ext]',
      },
    },
  });

  const templateLoaderConfiguration = {
    test: /\.docx$/,
    use: {
      loader: 'file-loader',
      options: {
        name: 'static/templates/[name].[ext]',
      },
    },
  };

  // This is needed for webpack to import static images in JavaScript files
  const assetLoaderConfiguration = {
    test: /\.(css)$/,
    use: {
      loader: 'file-loader',
      options: {
        name: 'static/assets/[name].[ext]',
      },
    },
  };

  const sharedConfig = {
    mode: NODE_ENV,

    context: ROOT_DIR,

    resolve: {
      alias: {
        // [notes.md: Web Shims]
        'react-native/Libraries/Renderer/shims/ReactNativePropRegistry':
          'react-native-web/src/modules/ReactNativePropRegistry',
        'react-native-web/dist/propTypes/ViewPropTypes':
          'react-native-web/src/components/View/ViewPropTypes',
        'react-native-web/dist': 'react-native-web/src',
        // [notes.md: React Native Web]
        'react-native': 'react-native-web',
        // 'react-native-router-flux': 'react-native-router-flux/src',
        // [notes.md: Absolute Module Resolution]
        src: 'src',
      },
      // [notes.md: TypeScript Support]
      // [notes.md: Electron]
      extensions: RESOLVE_EXTENSIONS,
      // [notes.md: Tree Shaking]
      mainFields: ['react-native', 'module', 'jsnext:main', 'webpack', 'browser', 'main'],
    },
  };

  const moduleConfig = (options: RuleOptions) => ({
    rules: [
      nativeBaseFontsConfig(options),
      imageLoaderConfiguration(options),
      reactNativeConfig(options),
      babelLoaderConfig(options),
      templateLoaderConfiguration,
      assetLoaderConfiguration,
    ],
  });

  const clientOptions: RuleOptions = {
    emitFile: true,
    modern: !isWeb,
  };

  const clientConfig: webpack.Configuration = {
    ...sharedConfig,

    target: PLATFORM === 'web' ? 'web' : 'electron-main',

    entry: {
      app: [
        require.resolve('regenerator-runtime/runtime'),
        ...testIf(isDev, () => [
        //   require.resolve('rlyeh/lib/patch'),
          require.resolve('react-dev-utils/webpackHotDevClient'),
          path.resolve(WEB_DIR, 'index'),
        ], () => [
          path.resolve(WEB_DIR, isWeb ? 'index.async' : 'index'),
        ]),
      ],
    },

    output: {
      path: DIST_DIR,

      ...testIf(
        isDev,
        {
          hotUpdateChunkFilename: 'hot/hot-update.js',
          hotUpdateMainFilename: 'hot/hot-update.json',
        },
        {}),

      ...testIf(
        isWeb,
        {
          filename: isDev ? 'static/js/[name].js' : 'static/js/[name].[chunkhash:8].js',
        },
        {
          filename: 'static/js/index.js',
        },
      ),
    },

    ...testIf<webpack.Configuration>(
      isDev,
      () => ({
        devtool: 'cheap-module-eval-source-map',
        devServer: {
          host: 'localhost',
          port: 3000,
          hot: true,
          inline: true,
          historyApiFallback: true,
          contentBase: path.resolve(PLATFORM_DIR, 'static'),
        },
      }),
      {},
    ),

    module: moduleConfig(clientOptions),

    plugins: [
      new copyWebpackPlugin([
        { from: path.resolve(PLATFORM_DIR, 'static'), to: path.resolve(DIST_DIR, 'static') },
      ]),

      new htmlWebpackPlugin({
        template: 'web/index.html',
        inject: 'body',
      }),

      new scriptExtHtmlWebpackPlugin({
        inline: /app\..*\.js/,
        defaultAttribute: isDev ? 'sync' : 'async',
      }),
    ],

    node: {
      ...testIf<webpack.Node>(
        isWeb,
        () => ({
          fs: 'empty',
        }),
        {},
      ),
    },
  };

  return [clientConfig];
}

export default makeConfig;
