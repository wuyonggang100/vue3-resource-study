import { createAppApi } from "./apiCreateApp";

export function createRenderer(rendererOptions) {
  const render = (vnode, container) => {};
  return {
    createApp: createAppApi(render),
  };
}
