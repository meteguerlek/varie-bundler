const webpack = require("webpack");
const merge = require("webpack-merge");
const getDependency = require("./../helpers/getDependency");

module.exports = class Plugin {
  constructor(env, config, data) {
    this.env = env;
    this.data = data;
    this.merge = merge;
    this.config = config;
    this.webpack = webpack;
    this.getDependency = getDependency;
  }
};
