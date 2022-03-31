export function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const app = {
      mount(container) {
        // 1. 根据组件创建虚拟节点
        // 2. 将虚拟节点调用 render 方法渲染到容器中
        let vnode = {};
        render(vnode, container);
      },
    };
    return app;
  };
}
