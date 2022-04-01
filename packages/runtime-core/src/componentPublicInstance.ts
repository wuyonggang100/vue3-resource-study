// instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
// 拦截的目标就是 instance.ctx
import { hasOwn } from "@vue/shared";
import has = Reflect.has;

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    if (key[0] === "$") return; // 不能 $ 开头的变量
    const { setupState, props, data } = instance;
    if (hasOwn(setupState, key)) {
      return setupState[key];
    } else if (hasOwn(props, key)) {
      return props[key];
    } else {
      return data[key];
    }
  },
  set({ _: instance }, key, value) {
    const { setupState, props, data } = instance;
    if (hasOwn(setupState, key)) {
      setupState[key] = value;
    } else if (hasOwn(props, key)) {
      props[key] = value;
    } else {
      data[key] = value;
    }
    return true;
  },
};
