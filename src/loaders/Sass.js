const Loader = require("./Loader");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");

module.exports = class Sass extends Loader {
  register() {
    this.webpackChain.module
      .rule("sass")
      .test(/\.s[ac]ss|\.css/)
      .when(!this.env.isProduction, (config) => {
        config
          .use("cache-loader")
          .loader("cache-loader")
          .options(
            this.generateCacheConfig(
              "sass-loader",
              ["sass-loader", "style-loader", "postcss-loader"],
              [".browserslistrc"],
            ),
          )
          .end();
      })
      .use("style-loader")
      .options({
        singleton: true,
        hmr: this.env.isHot,
      })
      .loader("style-loader")
      .end()
      .when(!this.env.isHot, (config) => {
        config
          .use("extract")
          .loader(MiniCssExtractPlugin.loader)
          .end();

        this.webpackChain
          .plugin("optimize-assets")
          .use(OptimizeCSSAssetsPlugin, [
            {
              cssProcessorOptions: {
                map: {
                  inline: false,
                  annotation: true,
                },
              },
              canPrint: !this.env.isProduction,
            },
          ])
          .end()
          .plugin("mini-extract")
          .use(MiniCssExtractPlugin, [
            {
              filename: `css/[name]-[${this.options.hashType}].css`,
              chunkFilename: `css/[name]-[${this.options.hashType}].css`,
            },
          ]);
      })
      .use("css-loader")
      .loader("css-loader")
      .options({
        sourceMap: true,
        importLoaders: 4, // postcss-loader , resolve-url-loader, sass-loader, vue-loader
      })
      .end()
      .use("postcss-loader")
      .loader("postcss-loader")
      .options({
        sourceMap: true,
        ident: "postcss",
        plugins: [autoprefixer, ...this.useIf(!this.env.isHot, [cssnano])],
      })
      .end()
      .use("resolve-urls")
      .loader("resolve-url-loader")
      .options({
        sourceMap: true,
      })
      .end()
      .use("sass-loader")
      .loader("sass-loader")
      .options({
        sourceMap: true,
        implementation: require("node-sass"),
      });
  }
};