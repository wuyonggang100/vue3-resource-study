// 节点操作，增删改查
// 属性操作，样式，事件, 其他属性等

import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";
import { extend } from "@vue/shared";
import { createRenderer } from "@vue/runtime-core";

// 渲染时用到的方法，包括 dom 的属性和事件
// runtime-dom 是为了解决平台之间的差异
const rendererOptions = extend({ patchProp }, nodeOps);

// runtime-dom 只获取自己的属性配置，然后交给 runtime-core 执行
export function createApp(rootComponent, rootProps = null) {
  const app = createRenderer(rendererOptions).createApp(
    rootComponent,
    rootProps
  );

  // mount 是 runtime-core 中的 mount 方法
  const { mount } = app;
  // 重写 mount 方法
  app.mount = function (container) {
    container = nodeOps.querySelector(container);
    container.innerHTML = "";
    mount(container);
  };
  return app;
}

export * from "@vue/runtime-core";
