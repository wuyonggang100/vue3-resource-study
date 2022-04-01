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

  

## 二、 虚拟节点 vnode

在runtime-core 中创建 ；

### 2.1  shapeFlags 的运算

> 位运算`是`类型处理`和`权限校验`的`最佳实践。

与运算： 同位都为 1 得 1， 其他得 0 ；

或运算：同位有一个是 1 就得 1， 其他得 0 ；

假如我们需要判断一个未知组件的类型，就可以取此类型与下面的各种 flag 做 & 与运算，只要得到的结果不为 0，就说明此未知组件类型与 flag 类型一致；

```js
export const enum ShapeFlags {
  ELEMENT = 1, // 00000001 -->1   普通元素
  FUNCTIONAL_COMPONENT = 1 << 1, // 00000010 --> 2  函数组件
  STATEFUL_COMPONENT = 1 << 2, // 00000100 --> 4  状态组件
  TEXT_CHILDREN = 1 << 3, // 8 子节点是文本节点
  ARRAY_CHILDREN = 1 << 4, // 16 子节点是数组
  SLOTS_CHILDREN = 1 << 5, // 32 子节点是插槽
  TELEPORT = 1 << 6, // 64 teleport 组件
  SUSPENSE = 1 << 7, // 128 异步组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 256
  COMPONENT_KEPT_ALIVE = 1 << 9, // 512
  // 状态组件和函数组件
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}
```

假如未知组件的类型为 type ，

```js
// 00000001 & 00000001 => 00000001
// 未知组件 & ShapeFlags.ELEMENT => 00000001  只要 & 出来的结果不是0，就说明 type 元素组件
if(type & ShapeFlags.ELEMENT){
    // 处理 element
}

// COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
// 00000100 | 00000010 => 00000110 
if(type & ShapeFlags.COMPONENT){
    // 只要 & 出来结果不为 0 ，type 只可能为 00000100或者 00000010，也就是既可能是 状态组件 ，又可能是 函数组件
}
```

### 2.2  vnode 中的属性

```js
  const vnode = {
    __v_isVnode: true, // 标识是一个虚拟节点
    type,
    props, // 包含 props 和 attrs 
    children,
    component: null, // 存放组件对应的实例
    el: null, // 对应的真实节点
    key: props && props.key,
    shapeFlag,
  };
```

### 三、组件实例

### 3.1 组件的实例 instance

instance 中的 props 和 attrs 都来自于 vnode,， 二者分离开了；

instance 中的一些属性，会取出一部分传给 context ，实际属性比以下的多

```js
  const instance = {
    vnode,
    type: vnode.type,
    props: {},
    attrs: {},
    slots: {},
    ctx: null,
    render: null,
    setupState: {}, // 如果 setup 返回一个对象，这个对象会作为 setupState
    isMounted: false, //标识组件是否已经挂载过
  };
```

### 3.2 组件的 context   

>  setup 方法的第二个参数，含有 5 个属性

```js
{
    attrs: instance.attrs,
    props: instance.props,
    slots: instance.slots,
    emit: () => {},
    expose: () => {},
};

instance.props 与 context.props 中的属性一一致的
```

### 3.3 组件实例的 render 函数

组件实例的 render 函数的第一个参数是 proxy ，可以将 data， props ，以及 setup 中返回的属性都代理过来,  l例如： 访问 proxy.xxx 即等同于 访问 props.xxx 

```jsx
props:['xxx']
render(proxy){ return <div>{{proxy.xxx}}</div>}  
```

其本质是对 inctance.ctx 做了拦截,  对同名的 key ，使用优先级依次是 ： setupState -->  data --> context --> data ；inctance.ctx  在开发与生产时不一样的， 开发时加了很多提示，因此不直接代理 instance ；

```js
instance.ctx={_: instance}
instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any);


get({ _: instance }, key) {
    if (key[0] === "$") return; // 不能 $ 开头的变量
    const { setupState, props, data, context } = instance;
    if (hasOwn(setupState, key)) {
      return setupState[key];
    } else if (hasOwn(data, key)) {
      return data[key];
    } else if (hasOwn(context, key)) {
      return context[key];
    } else {
      return props[key];
    }
},
```

#### render 函数的构建步骤

> 优先级依次是 setup 的render 函数 --> 组建的 render 函数 ---> 模板 

1. setup 方法中如果返回了函数，就作为 组件实例的 render 函数；
2. 如果组件上没有 render 函数，就会将模板进行编译，变成组件的 render 函数；

3. 把组件的 render 函数作为 实例的render 函数；

   ```js
   function setupStatefulComponent(instance) {
     // 1.代理传递给 render 函数的参数
     instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any);
     // 2. 获取组件类型，拿到组件的 setup 方法
     let Component = instance.type;
     let { setup } = Component;
     if (setup) {
       let setupContext = createSetupContext(instance);
       const setupResult = setup(instance.props, setupContext);
       handleSetupResult(instance, setupResult);
     } else {
       finishComponentSetup(instance);
     }
   }
   
   
   // setup 执行的结果可能是对象或者函数， 如果是函数,就会作为 render 函数
   function handleSetupResult(instance, setupResult) {
     if (isFunction(setupResult)) {
       // 作为 render 函数
       instance.render = setupResult;
     } else if (isObject(setupResult)) {
       instance.setupState = setupResult;
     }
     finishComponentSetup(instance);
   }
   
   // 完成组件启动
   function finishComponentSetup(instance) {
     let Component = instance.type;
     if (!instance.render) {
       if (!Component.render && Component.template) {
         // 组件如果没有 render 函数，就要对模板进行编译，得到组件的 render  函数
         // todo ...
       }
       instance.render = Component.render;
     }
     console.log(instance.render.toString());
     console.log(instance);
   }
   
   ```

### 3.4  组件初次挂载步骤

1. 拿到组件和组件的数据，props，children 等，生成 vnode 对象， 其上有相关属性和数据， props 包含了外部传来的 props 和 dom attrs；
2. 拿到 vnode 和容器，判断组件类型，创建组件实例，给组件实例增加各种属性；
3. 将组件的数据解析到实例上，将 data,  props,  setupState 等属性进行代理，作为 render 的函数的参数，根据上述 render 函数构建步骤得到 render 函数，挂到组件实例上；
4. 创建一个 effect ， 让组件实例的 render 函数在 effct 中执行；render 中依赖的数据就会收集这个 effect , 但是数据更新时， effect 就会重新执行；

### 3.5  h 函数

- ##### h 函数的几种用法：

```js
h('div',{})
h('div','hello world')
h('div',{}, 'hello world')
h('div',h(’p‘,{}, '我是p标签'))
h('div',{},h(’p‘,{}, '我是p标签'))
h('div',{}, p, span)
```

- h 函数执行后得到的是个 vnode ， 其内部是调用了 createVnode 方法， 即 render 函数调用后得到的是个 vnode ，得到此 vnode 以后需要递归解析， 即继续调用 patch 方法，直到解析出每一层的元素；
  - 如果参数只有两个，第二个参数有可能是个字符串， 数组， 或者 vnode；或者是 props ；
  - 如果参数大于等于三个，从第三个起，都是 children ；

```js
export function h(type, propsOrChildren, children) {
  console.log("h 函数");
  let l = arguments.length; // 参数长度
  // createVNode 的第三个参数, 即 children , 只能是 null, 字符串或者数组
  if (l == 2) {
    // 参数的方式:  类型+属性; 类型+children ;
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVnode(propsOrChildren)) {
        // h 函数生成的 vnode
        return createVNode(type, null, [propsOrChildren]);
      }
      // 只有 属性， 没有 children,此时 propsOrChildren 是 props;
      return createVNode(type, propsOrChildren);
    } else {
      // 第二个参数是个数组,或者是个字符串，那一定是 children
      return createVNode(type, null, propsOrChildren);
    }
  } else {
    if (l > 3) {
      // 大于三个参数时，从第三个起，都是 children
      children = Array.prototype.slice.call(arguments, 2);
    } else if (l === 3 && isVnode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}
```





























