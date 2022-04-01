import { createAppApi } from "./apiCreateApp";
import { ShapeFlags } from "@vue/shared";

export function createRenderer(rendererOptions) {
  const mountComponent = (initialVNode, container) => {
    // 组件的渲染流程，最核心的就是拿到 render 方法的返回值 继续渲染
    console.log(initialVNode, container);
  };
  const processComponent = (n1, n2, container) => {
    // 没有上一次虚拟节点就是初始化操作，否则就是更新
    if (n1 == null) {
      mountComponent(n2, container); // 直接挂载到容器中
    } else {
    }
  };

  // n1 是上一次的虚拟节点， n2 是新的虚拟节点
  const patch = (n1, n2, container) => {
    // 针对 vnode 的类型做不同处理
    const { shapeFlag } = n2;
    if (shapeFlag & ShapeFlags.ELEMENT) {
      // 此时 vnode是普通元素
    } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 此时 vnode 是状态组件
      processComponent(n1, n2, container);
    }
  };
  const render = (vnode, container) => {
    patch(null, vnode, container);
  };
  return {
    createApp: createAppApi(render),
  };
}
