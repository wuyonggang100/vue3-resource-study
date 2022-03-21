// 仅读的属性在 set 时会报异常
//  是不是深度的

import {
  extend,
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
} from "@vue/shared";
import { reactive, readonly } from "./reactive";
import { track, trigger } from "./effect";
import { TrackTypes, TriggerOrTypes } from "./operators";

function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver);
    if (!isReadonly) {
      // 需要收集依赖
      track(target, TrackTypes.GET, key);
    }
    // 只代理第一层, 需要i收集第一层依赖
    if (isShallow) {
      return res;
    }
    if (isObject(res)) {
      // 对 readonly 的，不需要递归收集依赖
      return isReadonly ? readonly(res) : reactive(res);
    }
    debugger;
    return res;
  };
}

function createSetter(isShallow = false) {
  return function set(target, key, value, receiver) {
    // 这里面的步骤是： 1.先获取旧值 oldValue 和 hadKey ，2. 设置新值，更新 target， 3.触发 UI 更新,也就是触发 effect 执行, 到这一步时， target 已经是更新后的 target
    const oldValue = target[key]; // 旧的 value
    // 如果是数组，并且是在数组长度内修改； 或者是对象原本就有此属性；这两种情况下认为是修改旧值，否则就是新增属性；
    let hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);
    debugger;
    const result = Reflect.set(target, key, value, receiver); // 返回 true 或 false

    if (!hadKey) {
      // 此时是新增属性,包含数组和对象的操作
      trigger(target, TriggerOrTypes.ADD, key, value);
    } else if (hasChanged(oldValue, value)) {
      // 已经有旧属性, 就是在修改属性值, 包含数组和对象的操作
      trigger(target, TriggerOrTypes.SET, key, value, oldValue); // 后续可能会调用 watch，就将旧值传进去
    }
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
