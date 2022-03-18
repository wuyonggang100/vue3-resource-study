import path from "path";
import json from "@rollup/plugin-json"; // 解析 json
import ts from "rollup-plugin-typescript2";
import resolvePlugin from "@rollup/plugin-node-resolve";

const packagesDir = path.resolve(__dirname, "packages"); // packages 目录位置

// rollup -c --environment TARGET:shared 就是配了个环境变量 process.env.TARGET
const pkgDir = path.resolve(packagesDir, process.env.TARGET); // packages 目录下各个包的位置， shared，,reactivity

// 针对某个模块获取其目录下的指定文件
const resolve = (p) => path.resolve(pkgDir, p);

// 获取当前包的自定义打包配置项
const packageJson = require(resolve("package.json"));
const pkgName = path.basename(pkgDir); // 取目录的最后一层，文件名
// 编写一个打包映射表
const outputConfig = {
  "esm-bundler": {
    file: resolve(`dist/${pkgName}.esm-bundler.js`),
    format: "es",
  },
  cjs: {
    file: resolve(`dist/${pkgName}.cjs.js`),
    format: "cjs",
  },
  global: {
    file: resolve(`dist/${pkgName}.global.js`),
    format: "iife", // 此处使用立即执行函数，也可以是 umd,
  },
};

// 获取自定义打包配置
const options = packageJson.buildOptions;

// 用自定义配置生成 rollup 打包配置对象config
function createConfig(format, output) {
  output.name = options.name;
  output.sourcemap = true;
  return {
    input: resolve("src/index.ts"), // 包下的入口文件
    output,
    // 插件从上到下依次执行
    plugins: [
      json(),
      ts({
        tsconfig: path.resolve(__dirname, "tsconfig.json"),
      }),
      resolvePlugin(),
    ],
  };
}

// 导出打包配置，可以是一个 config 对象，或者多个 config 对象组成的数组
export default options.formats.map((format) =>
  createConfig(format, outputConfig[format])
);
