import * as fs from "fs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import babel from "rollup-plugin-babel";

const BANNER = fs.readFileSync("./src/banner.js").toString();

function getPlugins(babelConfig) {
  return [
    json(),
    resolve({browser: true}),
    commonjs(),
    babel(babelConfig)
  ];
}

export default [
  {
    input: "src/index.js",
    output: {
      banner: BANNER,
      name: "main",
      file: "dist/main.js",
      format: "esm",
      sourcemap: false
    },
    plugins: getPlugins(
      {
        inputSourceMap: true,
        sourceMaps: true,
        exclude: ["node_modules/**", /\/core-js\//],

        presets: [
          [
            "@babel/preset-env",
            {
              useBuiltIns: "usage",
              corejs: 3,
              modules: false,
              targets: {
                browsers: [
                  "last 2 Chrome versions",
                  "last 2 Firefox versions",
                  "last 2 Safari versions"
                ]
              }
            }
          ]
        ],
        plugins: []
      }
    )
  }
];
