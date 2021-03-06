import Plugin from "./Plugin";
import getDependency from "./../helpers/getDependency";

export default class BundleAnalyzer extends Plugin<undefined> {
  public register() {
    this.varieBundler.webpackChain.plugin("analyzer").use(
      // @ts-ignore
      getDependency("webpack-bundle-analyzer").BundleAnalyzerPlugin,
    );
  }
}
