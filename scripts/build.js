// 打包 packages 下所有的包，并行打包
const fs = require("fs");
const execa = require("execa");
// 获取所有的包，只读取目录，将其他类似 README.md 等文件过滤掉
const packages = fs.readdirSync("packages").filter((f) => {
  return fs.statSync(`packages/${f}`).isDirectory();
});

async function build(pkg) {
  // stdio: "inherit", 子进程的输出共享到父进程中，可以在父进程中输出
  // 等同于运行命令 rollup -c --environment TARGET:shared 就是配了个环境变量 process.env.TARGET
  await execa("rollup", ["-c", "--environment", `TARGET:${pkg}`], {
    stdio: "inherit",
  });
}

// 返回一个 promise.all 执行
function runParallel(packages, iteratorFn) {
  const res = [];
  for (const pkg of packages) {
    // 每次的打包都是一个 promise ，不能使用 await，用了就变成同步打包了
    const p = iteratorFn(pkg);
    res.push(p);
  }
  return Promise.all(res);
}

runParallel(packages, build).then((res) => {
  console.log("所有包都打包完毕----");
});
