// 节点操作，增删改查
// 属性操作，样式，事件, 其他属性等

import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";
import { extend } from "@vue/shared";

// 渲染时用到的方法，包括 dom 的属性和事件
// runtime-dom 是为了解决平台之间的差异
const rendererOptions = extend({ patchProp }, nodeOps);
export { rendererOptions };
