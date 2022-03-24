## 一、computed 的实现

- 访问 computed 属性时，如果没有发生改变， 不会立即执行其包裹的函数，修改属性值时，也不会执行，当再次访问时，发生改变了才会执行；
- 首先 computed 是个 effect ，且不会立即执行，默认不会执行；有缓存标识；
- vue2中计算属性不具备收集依赖的能力， vue3 具备；
- 内部实现：
  - computed 方法返回一个  ComputedRefImpl 实例，在构造函数中将取值函数 getter 用 effect 包起来，就会对依赖的属性值进行依赖收集；同时用 _dirty 属性来标识是否需要运行 getter 进行取值；将旧值放到 _value 属性上进行缓存；
  - 对其取值 value 时， _ dirty 为 true（默认值为 true） 就要重新运行 getter 取值，取完将 _dirty 重置为 false ，否则就直接取旧值；
  - 对实例的 value 属性也要进行依赖收集， 同时在改变时对使用了它的 effect 需要触发更新；也就是内部有两处依赖收集和更新，一处时依赖的其他属性，一处是实例的 value 属性所在的 effect  ；



代码如下：

```js
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
```

