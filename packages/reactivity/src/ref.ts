import { track, trigger } from "./effect";
import { TrackTypes, TriggerOrTypes } from "./operators";
import { hasChanged } from "@vue/shared";

export function ref(value) {
  return createRef(value);
}

export function shallowRef(value) {
  return createRef(value, true);
}

// 类里面的 get 和 set 会被编译成 Object.defineProperty
// 因为 Proxy 只能处理 对象， 不能处理普通值；
// 将一个普通属性转为实例
// 实例上有一个 _value 属性，取值 xxx.value 时返回此值，设置时用来保存最新值，
class RefImpl {
  public _value;
  public __v_isShallow;
  public __v_isRef = true; // 标识是一个 ref 属性
  constructor(public rawValue, public shallow) {
    this._value = rawValue;
    this.__v_isShallow = shallow;
  }

  get value() {
    // 将实例作为依赖进行收集
    track(this, TrackTypes.GET, "value");
    return this._value;
  }

  set value(newValue) {
    // 新值与旧值不同时才触发更新
    if (hasChanged(newValue, this.rawValue)) {
      this.rawValue = newValue;
      this._value = newValue;
      trigger(this, TriggerOrTypes.SET, "value", newValue);
    }
  }
}

function createRef(rawValue, shallow = false) {
  return new RefImpl(rawValue, shallow);
}
