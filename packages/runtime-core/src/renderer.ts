import { createAppApi } from "./apiCreateApp";
import { ShapeFlags } from "@vue/shared";
import { createComponentInstance, setupComponent } from "./component";
import { effect } from "@vue/reactivity";

export function createRenderer(rendererOptions) {
  const setupRenderEffect = (instance, container) => {
    // 每个组件都有一个 effect 函数，vue3 是组件级更新
    effect(function componentEffect() {
      if (!instance.isMounted) {
        // 初次渲染
        const proxyToUse = instance.proxy;

        // 组件内渲染的内容为 subTree , 得到一个 vnode， 即 render 函数执行后的结果是个 vnode
        // 更新的时候可以用 subTree 进行对比；
        let subTree = (instance.subTree = instance.render.call(
          proxyToUse,
          proxyToUse
        ));
        console.log(subTree);

        // 用 render 函数的返回值继续渲染，此处是个递归
        patch(null, subTree, container);
        instance.isMounted = true;
      } else {
      }
    });
  };
  const mountComponent = (initialVNode, container) => {
    // 组件的渲染流程，最核心的就是拿到 render 方法的返回值进行渲染
    // 1. 创建组件实例
    const instance = (initialVNode.component =
      createComponentInstance(initialVNode));
    // 2. 将需要的数据解析到实例上
    setupComponent(instance);
    // 3. 创建一个 effect 让 render 函数执行
    setupRenderEffect(instance, container);
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
      console.log(n1, n2, container);
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
