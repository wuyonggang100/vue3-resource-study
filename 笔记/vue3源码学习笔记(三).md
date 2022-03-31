# 一、runtime-dom 和 runtime-core

### 1. vue3 的基本架构：

![image-20220331140906257](vue3源码学习笔记(san).assets/image-20220331140906257.png)

- reactivity 是响应式核心；
- runtime-core  是与平台无关的聚合，包括 ssr 和测试，内部使用了响应式模块；同时也导出了 reactivity 中的属性；
- runtime-dom 是专给浏览器使用的，里面包含了很多 dom 操作，传递给 runtime-core; 同时也导出了 runtime-core 中的属性；
- compiler-dom 和 compiler-core 是模板编译使用的；

### 2. 包的初始化

- packages 下有 runtime-core 目录，需要初始化，``yarn init -y`` ,  只需要给其他模块使用，因此不需要打包成 global 方式；只保留 esm-bundler 方式；
- packages 下有 runtime-dom目录，同样需要初始化，不给 node 使用，因此不用打包成 cjs ； 保留 global 和 esm-bundler  方式；
- 和前面一样，在根目录下需要 yarn install 一下，给这两个给包创建软链；

### 3. vue3 中的 render 函数

- vue3的 render 与 vue2 中写法有所差异；vue3 中 dom 属性可以直接写在 render函数中，不需要外面再包一层；而 vue2 中需要再包裹一层；

- vue3 中render函数内的 this 是 Proxy，从 Proxy 上可以访问 data 内的属性， 如同 vue2 中的 options 写法；vue2 中 this 是 vm 实例；vue3 中 render 函数的第一个参数就是 Proxy，也就是 this ；setuo 中的 this 是 window ；

  ```js
  const App = {
      data() {
          return {
              a: "1";
          }
      },
      // 最终会与 data 中数据合并
      setup(){
          console.log(this) // window
          const state = reactive({count:1})
          return {
              state
          }
      },
      render(proxy) {
          console.log(proxy.a); // 1
          console.log(proxy.state.count); // 1
          console.log(proxy === this); // true
          return h("div", { color: "red" });
      },
  };
  ```

- vue3 中可以像 vue2 中一样用 render 函数，同时使用 setup ，但是这样有可能会造成混乱，因此尽量使用一种方式，不要混用；

- vue2 中的 treeshaking 不太友好，因为引用的是整个 vm 实例，必须要接受实例上所有属性和方法，即便没有用到；而且 this 上有很多属性，不太好知道从何而来；vue3 中可以自由定义，自由组合；

- render 函数本质是个 effect， 数据变化就会重新执行；

### 4、vue3 中的 setup函数

- 可以返回一个对象或者返回一个函数，返回对象时，会被合并到 上面render 函数的参数 proxy 中，返回函数会被作为 render函数; 如果返回了函数，又使用了上面的 render 函数，会忽略掉 render 函数；
- 两个参数，props 和 context；

### 4、runtime-core 核心

- 有最基本的渲染和挂载方法， 接收 runtime-dom 传过来的参数，进行调用；不包含任何 dom 操作；

- 本质是将组件根据组件的属性和方法来转化成虚拟 dom ，再将虚拟 dom 转化成真实 dom 挂载到真实页面上；这一步是 最重要的；



### 5、runtime-dom 核心

​		核心就是提供 dom 方法, 属性操作；nodeOPs 是 dom 操作， patchProp 是属性操作；

- ##### 对属性的处理

  attribute 只有移除和设置；style 有覆盖和修改； class 有移除和设置；

- ##### 对事件的处理。

  将 el 上所有事件都缓存起来， 如果需要新添加一个事件，就直接添加绑定，同时添加进缓存； 如果是同名事件修改回调，就修改掉事件包裹中的回调函数；如果是移除，就直接移除，同时要将缓存中的对应事件包裹清除掉；

  ```js
  // value 是回调函数， key 是 onClick    
  export const patchEvent = (el, key, value) => {
    // 事件的处理需要有一个对函数的缓存, 如 onClick=fn 后改为 onClick=fn1
    const invokers = el._evi || (el._evi = {}); // el 上所有事件的缓存
    const exists = invokers[key];
  
    if (value && exists) {
      // 之前绑定过事件, 此时更换事件回调
      exists.value = value;
    } else {
      const eventName = key.slice(2).toLowerCase(); // onClick --> click
      if (value) {
        // 之前没有绑定过，需要添加绑定事件
        let invoker = (invokers[key] = createInvoker(value));
        el.addEventListener(eventName, invoker);
      } else {
        // 移除事件和缓存
        el.removeEmitHelper(eventName, exists);
        invokers[eventName] = undefined;
      }
    }
  };
  
  // 将事件的回调函数包装缓存起来
  function createInvoker(value) {
    const invoker = (ev) => {
      invoker.value(ev);
    };
    invoker.value = value; // 缓存起来
    return invoker;
  }
  ```


- 拿到浏览器平台的属性和一些方法，然后交给 runtime-core 执行。对 runtime-core 的 mount 方法切片重写，并且执行；本身没有渲染功能；

  ```js
  // 节点操作，增删改查
  // 属性操作，样式，事件, 其他属性等
  import { nodeOps } from "./nodeOps";
  import { patchProp } from "./patchProp";
  import { extend } from "@vue/shared";
  import { createRenderer } from "@vue/runtime-core";
  
  // 渲染时用到的方法，包括 dom 的属性和事件
  // runtime-dom 是为了解决平台之间的差异
  const rendererOptions = extend({ patchProp }, nodeOps);
  
  // runtime-dom 只获取自己的属性配置，然后交给 runtime-core 执行
  export function createApp(rootComponent, rootProps = null) {
    const app = createRenderer(rendererOptions).createApp(
      rootComponent,
      rootProps
    );
  
    // mount 是 runtime-core 中的 mount 方法
    const { mount } = app;
    // 重写 mount 方法
    app.mount = function (container) {
      container = nodeOps.querySelector(container);
      container.innerHTML = "";
      mount(container);
    };
    return app;
  }
  
  ```

  





