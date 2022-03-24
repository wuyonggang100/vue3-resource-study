import { isFunction } from "@vue/shared";
import { effect, track, trigger } from "./effect";
import { TrackTypes, TriggerOrTypes } from "./operators";

class ComputedRefImpl {
  public _value;
  public _dirty = true; // 默认取值时不用缓存
  public effect;

  constructor(getter, public setter) {
    // 将 getter 函数包到 effect 中，就会被收集依赖
    this.effect = effect(getter, {
      lazy: true, // 默认不执行computed函数
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true;
          trigger(this, TriggerOrTypes.SET, "value"); // 更新实例的 value 属性所在的 effect
        }
      },
    });
  }

  get value() {
    // 如果数据已经被修改，就要重新执行函数来获取最新值，然后将 dirty 重置
    if (this._dirty) {
      this._value = this.effect(); // 执行 getter 函数获取新值
      this._dirty = false;
    }
    track(this, TrackTypes.GET, "value"); // 对实例的 value 属性进行依赖收集
    return this._value;
  }
  set value(newValue) {
    this.setter(newValue);
  }
}

export function computed(getterOrOptions) {
  let getter;
  let setter;

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
    setter = () => {
      console.warn("computed value must be readonly");
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}
