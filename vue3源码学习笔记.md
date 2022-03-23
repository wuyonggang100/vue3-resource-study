使用 proxy 来劫持数据；

模板编译做了优化， block tree，减少比较；

增加 Fragment， Teleport ，Suspense 组件；

monorepo 管理项目



核心:组织架构：

响应式系统；

runtime-core

runtime-dev

server-renderer

compile-core



## 一、搭建 monorepo 环境

### 1.  安装依赖

> --ignore-workspace-root-check  表示忽略工作空间，给根模块安装；

```shell
yarn init -y

yarn add typescript rollup rollup-plugin-typescript2 @rollup/plugin-node-resolve @rollup/plugin-json execa  --ignore-workspace-root-check
```



| 依赖                        | 作用                   |
| --------------------------- | ---------------------- |
| typescript                  | 支持 ts                |
| rollup                      | 打包工具               |
| rollup-plugin-typescript2   | rollup 和 ts 的桥梁    |
| @rollup/plugin-node-resolve | 解析 nde 第三方模块    |
| @rollup/plugin-json         | 支持引入 json          |
| execa                       | 开启子进程方便执行命令 |

### 2. monorepo 分包

- 主 package.json 中加入以下配置，指定所有分包的工作管理空间；

  ```json
  "workspaces": ["packages/*"],
  ```

- 新建 packages 目录，其下新建 shared 和 reactivity 目录, 这两个目录下分别 执行 **yarn init  -y**，里面的配置为各自提供打包配置，需要编写 package.json；

  > shared  为共享模块，提供一些公共方法；
  >
  > rectivity  响应式模块；

  - ##### shared 下的 package.json

  ```json
  // node 引用模块会找 main 字段， webpack 引用模块会找 module 字段；
  // buildOptions 为自定义字段配置项
  // 导出可以给 commonjs 使用， esmodule 使用；
  {
    "name": "@vue/shared",
    "version": "1.0.0",
    "main": "index.js",
    "license": "MIT",
    "module": "dist/shared.esm-bundler.js",
    "buildOptions": {
      "name": "VueShared",
      "formats": ["cjs","esm-bundler"]
    }
  }
  ```

  - ##### reactivity 下的 package.json 

    > 可以导出全局变量 VueRactivity ，直接使用，所以有 global 项；

    ```jsn
    {
      "name": "@vue/reactivity",
      "version": "1.0.0",
      "main": "index.js",
      "license": "MIT",
      "module": "dist/reactivity.esm-bundler.js",
      "buildOptions": {
        "name": "VueRactivity",
        "formats": ["cjs","esm-bundler","global"]
      }
    }
    ```

    

### 3.为分包编写打包配置

> 在各自的package.json 中增加自定义属性 buildOptions

### 4.收集各个包的打包配置

### 5.生成 rollup 配置

> npx tsc --init  生成 tsconfig.json

```json
"target": "ESNext"
"module": "ESNext"
"strict": true
```

### 6.build 构建时的配置

```js
// 打包 packages 下所有的包，并行打包
const fs = require("fs");
const execa = require("execa");
// 获取所有的包，只读取目录，将其他类似 README.md 等文件过滤掉
const packages = fs.readdirSync("packages").filter((f) => {
  return fs.statSync(`packages/${f}`).isDirectory();
});

async function build(pkg) {
  // stdio: "inherit", 子进程的输出共享到父进程中，可以在父进程中输出
  // 等同于运行命令 rollup -c --environment TARGET:shared 就是配了个环境变量 process.env.TARGET
  await execa("rollup", ["-c", "--environment", `TARGET:${pkg}`], {
    stdio: "inherit",
  });
}

// 返回一个 promise.all 执行
function runParallel(packages, iteratorFn) {
  const res = [];
  for (const pkg of packages) {
    // 每次的打包都是一个 promise ，不能使用 await，用了就变成同步打包了
    const p = iteratorFn(pkg);
    res.push(p);
  }
  return Promise.all(res);
}

runParallel(packages, build).then((res) => {
  console.log("所有包都打包完毕----");
});
```

### 7.dev 开发时的配置

> build 时是循环遍历所有包全部打包，开发时不需要，可以指定需要编译的包；开启 w 监控变化；

```js
// dev.js
const execa = require("execa");

// build 时获取所有包遍历打包， 开发时指定目标打包即可
const package = "reactivity";

build(package).then((r) => {
  console.log(`${package} 包打包完毕`);
});

async function build(pkg) {
  // stdio: "inherit", 子进程的输出共享到父进程中，可以在父进程中输出
  // 等同于运行命令 rollup -cw --environment TARGET:shared 就是配了个环境变量 process.env.TARGET
  // w 是监控打包变化
  await execa("rollup", ["-cw", "--environment", `TARGET:${pkg}`], {
    stdio: "inherit",
  });
}
```



### 8.包的引用配置

- 当包 A 被其他包用 import 引用时，会找到此包 A 下package.json 的 module 字段属性值，即 dist 下的 esm 文件；

- 由于 workspace 配置，执行 yarn install 时会将此属性值即 packages 下所有的包全部安装到 node_modules 下，会生成一个 @vue目录，其下有各个包的软链，会链到 packages  下真正的包；

  ![image-20220318201812102](E:\珠峰架构正式课\study\vue3专题\vue3源码\image-20220318201812102.png)



- 有了上面的软链，就可以直接在其他模块引用了，跟引用第三方包一样；需要注意的是，要在tsconfig.json 中加入 "moduleResolution":"node" , 还要添加 paths， baseUrl 选项；

  ```js
  // 引用 shared 包
  import shared from "@vue/shared"
  
  // tsconfig.json
  "moduleResolution":"node",
  // Non-relative paths are not allowed when 'baseUrl' is not set
  "baseUrl":"./",  // 或者 "."
  "paths":{
      "@vue/*": [
          "packages/*/src"
      ]
  }
  ```

- 包之间的依赖， 若 reactivity 包依赖 shared 

  ```json
  // 给 reactivity 包的 package.json 添加依赖
  yarn workspace @vue/reactivity add @vue/shared@1.0.0
  ```

- 调试 vue-next 的源码时，只能使用 yarn install ， 不能用 npm install ;

## 二、reactive 响应式 Api 实现

#### 1.四个响应式 api

- reactive:  不管有多少层，都是响应式的；
- shallowReactive：只对第一层响应式和代理，第二层起不再触发响应式； 
- readonly： 只读，不管多少层，有响应式，但是不能被修改；不会触发依赖收集，性能会更高；
- shallowReadonly：本身只读，修改第一层将会失败，修改第二层起会触发响应式；

2、实现响应式

- reactive 下的 index.ts 只导出方法，不实现具体功能。
- new Proxy() 最核心的是拦截，因此需要 set 和 get 。

- readonly 的不进行依赖收集，但是会进行代理；reactive 的需要递归依赖收集，只要 get 取值，就会依赖收集；

- 创建响应式对象

  ```js
  export function createReactiveObject(target, isReadonly, handlers) {
    // reactive 只能拦截对象类型
    if (!isObject(target)) return target;
  
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    // 如果某个对象已经被代理过了就不要再代理了
    const existProxy = proxyMap.has(target);
    if (existProxy) {
      return existProxy;
    }
    const proxy = new Proxy(target, handlers); // key--value
    proxyMap.set(target, proxy);
    return proxy;
  }
  ```

- 根据取值时的不同需要做不同的操作，是否 readonly ，是否 shallow 

  ```js
  function createGetter(isReadonly = false, isShallow = false) {
    return function get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
  
      if (!isReadonly) {
        // 需要收集依赖
      }
      // 只代理第一层, 需要收集第一层依赖
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
  ```



3. 调试

   根目录下新建 example/reactive.html ， 需要开启 yarn dev,  需要开启 tsconfig 的 sourceMap 。

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8 " />
       <title>Title</title>
     </head>
     <body>
       <script src="../node_modules/@vue/reactivity/dist/reactivity.global.js"></script>
       <script>
         let { readonly, reactive, shallowReactive, shallowReadonly } =
           VueRactivity;
   
         let state = reactive({ name: "wu", age: { n: 13 } });
         console.log(state.age);
       </script>
     </body>
   </html>
   
   ```

   

## 三、effect Api 实现

- effect 默认会调用一次，然后当依赖的属性发生变化时，就会重新执行一次；**effect 就相当于 vue2中的 watcher **；
- 因为 effect 可能会嵌套调用，因此使用一个栈 efectStack 来存储调用关系，保证当前调用的 effct 是栈顶的那个，调用完毕后将栈顶的 effect 弹出，当前调用的那个还是栈顶的那个 effect ；保证当前变化的 key 对应的 effect 正确；

- 如果出现以下代码，就会进入死循环, 因此如果发现 effect 已经在 栈中，就不要执行

  ```js
  effect(()=>{
      state.age++
  })
  ```

  

```js
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    // 如果 effect 已经在战争中，就不要执行，避免进入死循环
    if (effectStack.includes(effect)) {
      // 即使函数 fn 出现异常，也能保证关系正确
      try {
        effectStack.push(effect);
        activeEffect = effect;
        return fn(); //
      } finally {
        effectStack.pop(); // effect 执行完后就出栈
        activeEffect = effectStack[effectStack.length - 1]; // 栈顶的那个
      }
    }
  };
  effect.id = uid++; // 给每个 effect 加个标识
  effect._isEfect = true; // 标识是个响应式 effect
  effect.raw = fn;
  effect.options = options;
  return effect;
}
```

#### 3.1依赖收集

- 依赖关系，

  ```js
  // 全部对象的依赖集合，不需要收集的对象不在此列
  const targetMap = new WeakMap(); 
  ```

![image-20220320000837012](E:\珠峰架构正式课\study\vue3专题\vue3源码\image-20220320000837012.png)



> 1. 最外一层 map 的 key 是对象，value 是个 Map；
> 2.  第二层 map 的 key 就是依赖的对象的 key，value 是个 Set；对象中有几个需要依赖的 key，就有几个 key--value  组合；
> 3.  Set 中的成员是一个个被关联的 effect ，当 对象的 key 值被修改时，就会将此 set 中的 efect 取出全部执行；
> 4. 使用 set 不会有重复，可以保证 effect 唯一 ；

```js
// createGetter 函数中

// 需要收集依赖
if (!isReadonly) {
    track(target, TrackTypes.GET, key); // TrackTypes.GET 为"get"
}


// 收集依赖到全局变量中，全部对象的依赖集合，不需要收集的对象不在此列
const targetMap = new WeakMap(); // weakMap 防止内存泄漏

// 依赖收集， type 是 "set" 或者 "get"
export function track(target, type, key) {
  // 不在 effect 中调用的属性，不进行收集
  if (activeEffect === undefined) {
    return;
  }
// 以对象为 key，以 map 为value
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

// 以 key 为 key， 以 Set 为 value
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }
// set 中是以个个 effect
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
  }
}
```

#### 3.2 触发更新

1. ##### 修改属性还是新增属性

   如果是数组，并且是在数组长度内修改； 或者是对象原本就有此属性；这两种情况下认为是修改旧值，否则就是新增属性, 两种情况下都要触发更新

   ```js
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
   ```

2. ##### 如果修改的是数组长度

   ```js
   state.arr.length = 2 // 假如原来length 为 5，且对 arr[3] 有依赖
   ```

   - 对数组 length 有依赖 ，分以下两种情况，需要更新；
     - 直接依赖 length， 直接使用了 length 或直接依赖了整个数组时会去取 length；
     - 没有直接使用 length,但是修改 length 对依赖有影响的，如新数组长度小于依赖的索引位置。如：新 length 为2， 而依赖的是 index 为 3；

3. ##### 修改数组或者对象已有的属性，或者给对象新增一个原来依赖了但是并不存在的属性；这三个的操作是相同的，会更新。

   > **只要有 key ，被依赖过的就会更新**

   ```js
   if (key !== undefined) {
     add(depsMap.get(key)); // 汇总 effect
   }
   ```

4. ##### 新增对象属性，给数组新增索引；

   - 新增一个没有依赖过的属性，不做任何操作；

5. 整个更新函数如下

```js
// trigger 函数，触发更新，effect 汇总

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
  effects.forEach((effect: any) => effect());
}

```



#### 总结：

1. effect 中所有属性都会收集 effect ; 收集用 track 方法 ；
2. 2. 当属性值发生变化，会重新执行 efeect ；触发更新用 trigger 函数；



## 四、ref 的实现

1. ref 内部使用的是 defineProperty ; 

2. reactive 内部使用的是 Proxy； 

3. Proxy 的第一个参数要求是个对象，因此不能用来拦截普通值；

#### 1. 两种情况

> 传入普通值或者对象，都使用一个RefImpl 类, 实例上有一个 _____value 属性;

1.  ref() 传入普通值；

   - 取值 xx.value 时，收集依赖，将 RefImpl  实例作为 target 依赖收集；返回 this._value 的值；
   - 将普通值转为实例；xxx.value 就是取值 ，返回 this._value

   - 给 xx.value 设置属性时， set 拦截里给 _value 设置新值；同时触发更新；

2. ref() 传入对象；

   - 第一次取值 xxx.value时，将 this._value 关联为一个响应式的 reactive  Proxy ，  将此响应式对象收集到依赖中；
   - 取值 xxx.value.yyy 会进入 Proxy.xxx的 get 拦截
   - 使用 xxx.value.yyy = 'aaa' 赋值时，就是对 关联的 Proxy 赋值，触发了 Proxy 的 set 方法，进而触发更新；此时不走 RefImpl 实例的 set 方法进入 trigger，而是直接走 Proxy 的 createSetter方法进入 trigger 了；

```js
import { track, trigger } from "./effect";
import { TrackTypes, TriggerOrTypes } from "./operators";
import { hasChanged, isObject } from "@vue/shared";
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
```



## 五、toRef 方法的实现

- toRef 将一个响应式对象的某个属性转成 ref 类型， 会与原响应式对象的对应属性关联起来，二者同步。 
- 即使源属性不存在，`toRef` 也会返回一个可用的 ref。

如下：

```js
const state = reactive({
  foo: 1,
  bar: 2
})

const fooRef = toRef(state, 'foo')

fooRef.value++
console.log(state.foo) // 2，源对象的属性值会同步改变

state.foo++
console.log(fooRef.value) // 3 新 ref 类型的值也会同步改变；
```

#### 1、原理

toRef 使用了一个ObjectRefImpl 实例，不需要 _value 属性。还是使用了 defineProperty。

 以上面代码为例， 取值 fooRef.value 时，会返回 state.foo , 而 state 是一个响应式 Proxy， 此时会进入依赖收集；给 fooRef.value 赋值时会触发  state 上的赋值操作，从而进到 set 拦截中，然后执行 trigger 更新。

实现代码如下：

```js
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
```



## 六、toRefs 的实现

- 本质是 toRef 的循环使用， toRef 只能每次响应式解构一个属性， 而 toRefs 可以批量响应式解构；
- 参数可以是对象或数组；
- 原理是，提前准备一个等长数组，或空对象，然后每个元素或属性值都是一个 toRef 对象；实现如下：

```js
// 在 toRef 基础上实现的，批量响应式解构

// target 可以是 Proxy 数组或对象;
export function toRefs(target) {
  let ret = isArray(target) ? new Array(target.length) : {};
  for (let key in target) {
    ret[key] = toRef(target, key);
  }
  return ret;
}
```



当前总结：

- reactive 响应式 API 用的最多；
- 普通值响应式时只能用 ref ；
- 批量解构 reactive 用 toRefs， 解构 reactive 的某个指定 key 用 toRef ；
- UI 更新使用 effce ；依赖收集使用 track 方法， 触发更新使用 trigger 方法；























