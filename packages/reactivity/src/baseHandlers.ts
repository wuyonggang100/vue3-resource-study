// 仅读的属性在 set 时会报异常
//  是不是深度的

import { extend, isObject } from "@vue/shared";
import { reactive, readonly } from "./reactive";

function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver);

    if (!isReadonly) {
      // 需要收集依赖
    }
    // 只代理第一层, 需要i收集第一层依赖
    if (isShallow) {
      return res;
    }
    if (isObject(res)) {
      // 对 readonly 的，不需要递归收集依赖
      return isReadonly ? readonly(res) : reactive(res);
    }
    return res;
  };
}
function createSetter(isShallow = false) {
  return function set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver);
    return result;
  };
}

const get = createGetter();
const shallowGet = createGetter(false, true);
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);

const set = createSetter();
const shallowSet = createSetter(true);

const readonlyObj = {
  set: (target, key) => {
    console.warn(`set on key ${key} failed`);
  },
};

export const mutableHandlers = {
  get,
  set,
};
export const shallowReactiveHandlers = {
  get: shallowGet,
  set: shallowSet,
};
export const readonlyHandlers = extend(
  {
    get: readonlyGet,
  },
  readonlyObj
);
export const shallowReadonlyHandlers = extend(
  {
    get: shallowReadonlyGet,
  },
  readonlyObj
);
