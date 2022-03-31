const execa = require("execa");

// build 时获取所有包遍历打包， 开发时指定目标打包即可, 开发到那个包就写那个包名
// const package = "reactivity";
const package = "runtime-dom";

build(package).then((r) => {
  console.log(`${package} 包打包完毕`);
});

async function build(pkg) {
  // stdio: "inherit", 子进程的输出共享到父进程中，可以在父进程中输出
  // 等同于运行命令 rollup -cw --environment TARGET:shared 就是配了个环境变量 process.env.TARGET
  // w 是监控打包变化
  await execa("rollup", ["-cw", "--environment", `TARGET:${pkg}`], {
    stdio: "inherit",
  });
}
