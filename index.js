const path = require("path");
const util = require("util");
const dotenv = require("dotenv");
const loaders = require("./loaders");
const plugins = require("./plugins");
const webpackConfigs = require("./configs");
const WebpackChain = require("webpack-chain");

module.exports = class VarieBundler {
  constructor(mode, config = {}) {
    this._webpackChain = new WebpackChain();
    this._setupEnv(mode);
    this._setupConfig(config, process.env.PWD);
    this._presets();
  }

  aliases(aliases) {
    this._config.webpack.aliases = aliases;
    return this;
  }

  // https://github.com/jantimon/html-webpack-plugin/issues/889
  // aggressiveSplitting(minSize = 30000, maxSize = 50000) {
  //   new plugins.AggressiveSplitting(this, {
  //     minSize,
  //     maxSize,
  //   });
  //   return this;
  // }

  // When building modern, we must first separate legacy into its own config
  // otherwise it would keep its reference
  build() {
    let legacy = this._bundle().toConfig();

    if (this._argumentsHas("--inspect")) {
      legacy = this._bundle().toString();
    }

    if (this._env.isModern) {
      let modern = this._makeModernBundle();
      return this._argumentsHas("--inspect")
        ? this._inspect(legacy, modern)
        : [modern.toConfig(), legacy];
    }

    return this._argumentsHas("--inspect") ? this._inspect(legacy) : legacy;
  }

  browserSync(options = {}) {
    this._config.webpack.devServer.open = false;
    let browserSyncOptions = Object.assign(
      this._config.plugins.browserSync,
      options,
    );
    browserSyncOptions.devServer = this._config.webpack.devServer;
    new plugins.BrowserSync(this, browserSyncOptions);
    return this;
  }

  chainWebpack(callback) {
    callback(this._webpackChain, this._env);
    return this;
  }

  copy(from, to = "") {
    this._config.plugins.copy.patterns.push({
      from: from,
      to: path.join(this._config.outputPath, to),
    });
    return this;
  }

  dontClean(exclude) {
    if (Array.isArray(exclude)) {
      this._config.plugins.clean.excludeList.push(...exclude);
    } else {
      this._config.plugins.clean.excludeList.push(exclude);
    }

    new plugins.Clean(this, this._config.plugins.clean);

    return this;
  }

  entry(name, entryPaths) {
    let webpackEntry = this._webpackChain.entry(name);

    entryPaths.map((entry) => {
      let entryPath = path.join(this._config.root, entry);
      this._config.webpack.entryFiles.push(entryPath);
      webpackEntry.add(entryPath);
    });

    webpackEntry.end();

    this._updateJavascriptLoaders();

    return this;
  }

  plugin(Plugin, options) {
    new Plugin(this, options);
    return this;
  }

  proxy(
    from,
    to,
    options = {
      changeOrigin: true,
    },
  ) {
    this._config.webpack.devServer.proxies.push(
      Object.assign(
        {
          context: Array.isArray(from) ? from : [from],
          target: to,
        },
        options,
      ),
    );
    return this;
  }

  varieConfig(variables) {
    this._config.plugins.defineEnvironmentVariables.variables = variables;
    return this;
  }

  webWorkers() {
    new loaders.WebWorkers(this);
    return this;
  }

  _argumentsHas(argument) {
    let commandLineArguments = process.argv;
    return commandLineArguments
      ? commandLineArguments.includes(argument)
      : false;
  }

  _bundle() {
    this._webpackChain.when(!this._env.isProduction, () => {
      new plugins.WebpackBar(this, {
        name: this._config.bundleName || "Client",
      });
    });

    this._webpackChain.when(this._env.isHot, () => {
      new webpackConfigs.DevServer(this, this._config.webpack.devServer);
    });

    new webpackConfigs.Aliases(this, this._config.webpack.aliases);
    new plugins.DefineEnvironmentVariables(
      this,
      this._config.plugins.defineEnvironmentVariables,
    );

    if (this._config.plugins.copy.patterns.length > 0) {
      new plugins.Copy(this, this._config.plugins.copy.patterns);
    }

    return this._webpackChain;
  }

  _inspect(...bundles) {
    bundles.forEach((bundle) => {
      util.inspect(console.log(bundle.toString()), false, null, true);
    });
    process.exit(0);
  }

  _setupConfig(config, root) {
    let envConfig = dotenv.config().parsed;
    let outputPath = path.join(root, "public");
    let host = envConfig.APP_HOST || "localhost";
    this._config = Object.assign(config, {
      root,
      host,
      outputPath,
      appName: envConfig.APP_NAME || "Varie",
      hashType: this._env.isHot ? "hash" : "contenthash",
      plugins: {
        aliases: {},
        copy: {
          patterns: [],
        },
        browserSync: {
          host,
          outputPath,
          port: 3000,
          proxy: "localhost:8080",
        },
        clean: {
          excludeList: [],
        },
        defineEnvironmentVariables: {
          variables: [],
        },
      },
      webpack: {
        aliases: [],
        entryFiles: [],
        devServer: {
          host,
          open: true,
          proxies: [],
        },
      },
      vue: {
        runtimeOnly: true,
      },
    });
  }

  _setupEnv(mode = "development") {
    this._env = {
      mode,
      isProduction: mode === "production",
      isDevelopment: mode === "development",
      isHot: this._argumentsHas("--hot"),
      isModern: this._argumentsHas("--modern"),
      isAnalyzing: this._argumentsHas("--analyze"),
    };
  }

  _presets() {
    new loaders.Html(this);
    this._updateJavascriptLoaders();
    new loaders.Vue(this, this._config.vue);
    new loaders.Sass(this, {
      hashType: this._config.hashType,
    });
    new loaders.Fonts(this);
    new loaders.Images(this);

    new plugins.NamedChunks(this);
    new plugins.CaseSensitivePaths(this);
    new plugins.Clean(this, this._config.plugins.clean);

    this._webpackChain
      .when(!this._env.isProduction, () => {
        new plugins.Errors(this);
      })
      .when(this._env.isProduction, () => {
        new plugins.HashedModules(this);
      })
      .when(this._env.isAnalyzing, () => {
        new plugins.BundleAnalyzer(this);
      });

    this._webpackChain
      .mode(this._env.mode)
      .context(this._config.root)
      .devtool(this._env.isProduction ? "hidden-source-map" : "eval-source-map")
      .resolve.symlinks(false);

    new webpackConfigs.Stats(this);
    new webpackConfigs.Output(this);
    new webpackConfigs.Extensions(this);
    new webpackConfigs.Optimization(this);
  }

  _makeModernBundle() {
    this._config.bundleName = "ES Modules";

    let modern = this._bundle();

    new plugins.Preload(this);

    this._updateJavascriptLoaders();

    if (this._env.isAnalyzing) {
      modern.plugin("analyzer").tap(() => {
        return [
          {
            analyzerPort: 8889,
          },
        ];
      });
    }

    modern.output
      .filename(`js/[name]-[${this._config.hashType}].js`)
      .chunkFilename(`js/[name]-[${this._config.hashType}].js`);

    modern.plugins.delete("clean");

    return modern;
  }

  _updateJavascriptLoaders(modernBuild = false) {
    new loaders.Javascript(this, {
      modernBuild,
      entryFiles: this._config.webpack.entryFiles,
    });
    new loaders.Typescript(this, {
      modernBuild,
      entryFiles: this._config.webpack.entryFiles,
    });
  }
};
