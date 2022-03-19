// effect 默认会执行一次，当依赖的数据变化时，会重新执行
import { TrackTypes } from "./operators";

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
    // 如果 effect 已经在战争中，就不要执行，避免进入死循环
    if (!effectStack.includes(effect)) {
      // 即使函数 fn 出现异常，也能保证关系正确
      try {
        effectStack.push(effect); // 函数的引用地址
        activeEffect = effect;
        return fn(); //
      } finally {
        effectStack.pop(); // effect 执行完后就出栈
        activeEffect = effectStack[effectStack.length - 1]; // 栈顶的那个
      }
    }
  };
  effect.id = uid++; // 给每个 effect 加个标识
  effect._isEfect = true; // 标识它是个响应式 effect
  effect.raw = fn;
  effect.options = options;
  return effect;
}

// 收集依赖
const targetMap = new WeakMap(); // 全部对象的依赖集合，不需要收集的对象不在此列

// 最外一层 map 的 key 是对象，value 是个 Map；
// 第二层 map 的 key 就是依赖的对象的 key，value 是个 Set；对象中有几个需要依赖的 key，就有几个 key--value  组合；
// Set 中是一个个 关联的 effect ，当 对象的 key 值被修改时，就会将此 set 中的 efect 取出全部执行；
// 使用 set 不会有重复，可以保证 effect 唯一；
export function track(target, type, key) {
  // 当没有在 effect 中取值时，activeEffect 不存在，不用收集依赖，
  if (activeEffect === undefined) {
    return;
  }

  let depsMap = targetMap.get(target);
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
