import { track, trigger } from "./effect";
import { TrackTypes, TriggerOrTypes } from "./operators";
import { hasChanged, isArray, isObject } from "@vue/shared";
import { reactive } from "./reactive";

export function ref(value) {
  return createRef(value);
}

export function shallowRef(value) {
  return createRef(value, true);
}

// 如果 ref 传入对象，就会得到一 响应式 reactive Proxy
const convert = (val) => (isObject(val) ? reactive(val) : val);

// 类里面的 get 和 set 会被编译成 Object.defineProperty
// 因为 Proxy 只能处理 对象， 不能处理普通值；
// 将一个普通属性转为实例
// 实例上有一个 _value 属性，取值 xxx.value 时返回此值，设置时用来保存最新值，
class RefImpl {
  public _value;
  public __v_isShallow;
  public __v_isRef = true; // 标识是一个 ref 属性
  constructor(public rawValue, public shallow) {
    this._value = shallow ? rawValue : convert(rawValue);
    this.__v_isShallow = shallow;
  }

  get value() {
    // 将实例作为依赖进行收集
    track(this, TrackTypes.GET, "value");
    return this._value;
  }

  // ref() 传入普通值时才会进入此方法
  set value(newValue) {
    // 新值与旧值不同时才触发更新
    if (hasChanged(newValue, this.rawValue)) {
      this.rawValue = newValue;
      this._value = this.shallow ? newValue : convert(newValue);
      trigger(this, TriggerOrTypes.SET, "value", newValue);
    }
  }
}

function createRef(rawValue, shallow = false) {
  return new RefImpl(rawValue, shallow);
}

// ------------- toRef 逻辑-----------------------------
class ObjectRefImpl {
  public __v_isRef = true; // 标识是一个 ref 属性
  constructor(public target, public key) {}

  get value() {
    return this.target[this.key]; // 取值 Proxy 会进入依赖收集
  }

  set value(newValue) {
    this.target[this.key] = newValue; // 触发 Proxy 更新
  }
}

export function toRef(target, key) {
  return new ObjectRefImpl(target, key);
}

// ---------------toRefs 的实现-----------------
// 在 toRef 基础上实现的，批量响应式解构

// target 可以是数组或对象;
export function toRefs(target) {
  let ret = isArray(target) ? new Array(target.length) : {};
  for (let key in target) {
    ret[key] = toRef(target, key);
  }
  return ret;
}
