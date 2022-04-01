import { createVNode } from "./vnode";

export function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const app = {
      _props: rootProps,
      _component: rootComponent,
      _container: null, // 容器一开始拿不到，在调用了 mount 方法后才能获取到
      mount(container) {
        // 1. 根据组件创建虚拟节点
        // 2. 将虚拟节点调用 render 方法渲染到容器中
        debugger;
        let vnode = createVNode(rootComponent, rootProps);

        console.log("vnode-----", vnode);

        render(vnode, container);
        app._container = container;
      },
    };
    return app;
  };
}
