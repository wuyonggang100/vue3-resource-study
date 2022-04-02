// effect 默认会执行一次，当依赖的数据变化时，会重新执行
import { TrackTypes, TriggerOrTypes } from "./operators";
import { isArray, isIntegerKey } from "@vue/shared";

export function effect(fn, options?: any) {
  const effect = createReactiveEffect(fn, options);

  if (!options?.lazy) {
    effect(); // 默认就执行一次
  }

  return effect;
}

let uid = 0;
let activeEffect; // 当前的 effect
let effectStack = []; //存储 effect 调用关系

function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    // 如果 effect 已经在栈中，就不要执行，避免进入死循环
    if (!effectStack.includes(effect)) {
      // 即使函数 fn 出现异常，也能保证关系正确
      try {
        effectStack.push(effect); // 函数的引用地址
        activeEffect = effect;
        return fn(); // 需要将执行结果返回，如 computed
      } finally {
        effectStack.pop(); // effect 执行完后就出栈
        activeEffect = effectStack[effectStack.length - 1]; // 栈顶的那个
      }
    }
  };
  effect.id = uid++; // 给每个 effect 加个标识
  effect._isEffect = true; // 标识它是个响应式 effect
  effect.raw = fn;
  effect.options = options;
  return effect;
}

// 全部对象的依赖集合，不需要收集的对象不在此列， 在一个 vm 实例内是一个全局变量
const targetMap = new WeakMap();

// 最外一层 map 的 key 是对象，value 是个 Map；
// 第二层 map 的 key 就是依赖的对象的 key，value 是个 Set；对象中有几个需要依赖的 key，就有几个 key--value  组合；
// Set 中是一个个 关联的 effect ，当 对象的 key 值被修改时，就会将此 set 中的 efect 取出全部执行；
// 使用 set 不会有重复，可以保证 effect 唯一；

// 收集依赖
export function track(target, type, key) {
  // 当没有在 effect 中取值时，activeEffect 不存在，不用收集依赖，
  if (activeEffect === undefined) {
    return;
  }

  let depsMap = targetMap.get(target);
  // 不会重复收集，只有第一次收集
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
  }
  console.log("targetMap---", targetMap);
}

// 触发更新，effect 汇总，然后批量一次新更新
export function trigger(target, type, key?, newValue?, oldValue?) {
  const depsMap = targetMap.get(target);
  // 如果这个target 没有被收集过，也就是没有被依赖过，就不做任何操作
  if (!depsMap) return;

  // 将需要执行的 effect 收集到一个新 set 中，最后一次性全部执行
  // 同一个 target 收集同一个 effect 多次时，会去重，保证只收集一次；
  // 同一个 target 下所有依赖的 key 收集的全部 effect ，扁平汇总到同一个 set 中，算是一个优化；
  const effects = new Set();
  const add = (effectsToAdd) => {
    if (effectsToAdd) {
      effectsToAdd.forEach((effect) => effects.add(effect));
    }
  };

  // 操作的是数组 length
  if (key === "length" && isArray(target)) {
    // depsMap 此时只与数组有关
    depsMap.forEach((dep, k) => {
      // 直接使用 length 或没有直接使用 length,但是修改 length 对依赖有影响的，如新数组长度小于依赖的索引位置，需要更新
      if (k === "length" || k > newValue) {
        add(dep);
      }
    });

    console.log("---", effects);
  } else {
    // 修改对象属性或者修改数组已有的索引,或者新增一个原来被依赖了但是并不存在在对象上的属性；
    if (key !== undefined) {
      add(depsMap.get(key));
    }

    // 如果修改的是数组中的某一项，并且是新增，影响了数组长度, 如 arr[100] = 'xxx'
    // 新增的索引会触发长度的更新
    switch (type) {
      case TriggerOrTypes.ADD:
        if (isArray(target) && isIntegerKey(key)) {
          add(depsMap.get("length")); // 直接使用了 length 或直接依赖了数组 arr 时会去取 length，否则就不会更新
        }
    }
  }

  // 最后批量一次执行
  effects.forEach((effect: any) => {
    if (effect.options?.scheduler) {
      effect.options.scheduler(effect); // 数据更新时会进入调度，而不是直接调用 effect
    } else {
      effect();
    }
  });
}
