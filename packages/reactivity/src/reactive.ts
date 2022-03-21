import { isObject } from "@vue/shared";
import {
  mutableHandlers,
  shallowReactiveHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers,
} from "./baseHandlers";

// 两个缓存空间，记录对象是否被代理过，不会造成内存泄露
const reactiveMap = new WeakMap();
const readonlyMap = new WeakMap();

export function createReactiveObject(target, isReadonly, handlers) {
  // reactive 只能拦截对象类型
  if (!isObject(target)) return target;

  const proxyMap = isReadonly ? readonlyMap : reactiveMap;
  // 如果某个对象已经被代理过了就不要再代理了
  const existProxy = proxyMap.get(target);
  if (existProxy) {
    return existProxy;
  }
  const proxy = new Proxy(target, handlers); // key--value
  proxyMap.set(target, proxy);
  return proxy;
}

export function reactive(target) {
  return createReactiveObject(target, false, mutableHandlers);
}
export function shallowReactive(target) {
  return createReactiveObject(target, false, shallowReactiveHandlers);
}
export function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers);
}
export function shallowReadonly(target) {
  return createReactiveObject(target, true, shallowReadonlyHandlers);
}
