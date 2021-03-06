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

  

# 二、 虚拟节点 vnode

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

其中 shapeFlag 属性是给vnode 的 children 使用的，

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

此处等同于 ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.ELEMENT | type，表示子节点是个状态组件，或普通元素，或文本节点，或者是个数组子节点

```js
function nomalizeChildren(vnode, children) {
  // children 如果有，只能是字符串或者数组
  let type = 0;
  if (children == null) {
    // 没有子节点，不做处理
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN; // 数组子节点
  } else {
    type = ShapeFlags.TEXT_CHILDREN; // 文本子节点
  }
  // 此 shapeFlag 属性是给vnode 的 children 使用的
  // 此处等同于 ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.ELEMENT | type，
  // 表示子节点是个状态组件，或普通元素，或文本节点，或者是个数组子节点
  vnode.shapeFlag = vnode.shapeFlag | type;
  // 等同于 vnode.shapeFlag |=  type;
}

```





# 三、组件实例

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
h('div',{}, ['hello world',h('p','你好')])
h('div',h(’p‘,{}, '我是p标签'))
h('div',{},h(’p‘,{}, '我是p标签'))
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



h 函数的 children 参数只有以下三种类型， 可以将 children 中的每一项转为一个 vnode， 然后调用 patch 函数，塞进容器中；

1.  h 函数得到的 vnode 对象；

2. 字符串文本；

3. 数组，而数组中的元素也是以上两种类型

   

- #### patch 函数

  >  renderer.ts 文件  ，第一个参数为 null 时是新建挂载，否则是更新；

  processText 是粒度最小的，

```js
// n1 是上一次的 vnode， n2 是新的vnode
  const patch = (n1, n2, container) => {
    // 针对 vnode 的类型做不同处理
    const { shapeFlag, type } = n2;
    switch (type) {
      case Text: // vnode 是个文本字符串要单独处理
        processText(n1, n2, container);
        break;
      default:
        // 非文本的其他情况
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 此时 vnode是普通元素，此处会进入 patch 递归终止
          processElement(n1, n2, container);
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 此时 vnode 是状态组件, 内部会继续调用 patch 方法递归，组件会分新建和更新两种
          processComponent(n1, n2, container);
        }
        break;
    }
  };

// 组件的处理
  const processComponent = (n1, n2, container) => {
    // 没有上一次虚拟节点就是初始化操作，否则就是更新
    if (n1 == null) {
      mountComponent(n2, container); // 直接挂载到容器中
    } else {
        // diff 更新
    }
  };


// 组件初次挂载
  const mountComponent = (initialVNode, container) => {
    // 组件的渲染流程，最核心的就是拿到 render 方法的返回值进行渲染
    // 1. 创建组件实例
    const instance = (initialVNode.component =
      createComponentInstance(initialVNode));
    // 2. 将需要的数据解析到实例上
    setupComponent(instance);
    // 3. 创建一个 effect 让 render 函数执行
    setupRenderEffect(instance, container);
  };
```



#### 3.6 数据更新的调度

先更新父， 再更新子，因此要对 effect 队列进行排序；每个 effct 都有一个 id， 父级 id < 子级 id 

连续多次更新只会让同一个 effect 在一次调度中执行一次，

![image-20220402182757360](vue3源码学习笔记(三).assets/image-20220402182757360.png)



```js
let queue = [];
let isFlushPending = false;
export function queueJob(job) {
  // 保证同一个 effect 在一次调度中只会执行一次
  if (!queue.includes(job)) {
    queue.push(job);
    queueFlush(); // 异步调度
  }
}

function queueFlush() {
  if (!isFlushPending) {
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}
function flushJobs() {
  isFlushPending = false;
  queue.sort((a, b) => a.id - b.id); // 升序排列，父在前，子在后
  queue.forEach((job) => job());
  queue.length = 0; // 调度更新完毕后，清空队列
}

```



# 四、diff 算法

- 使用组件实例上的新旧 subTree 进行比较， 即需要调用 render 方法获取新的 subTree ， 需要得到实例的 proxy 作为参数；
- 组件更新主要是更新组件的 props , diff 针对的是元素的更新；

### 4.1 元素更新

1. #### 新旧元素类型不同，直接移除旧的，挂载新的

   patch 函数中，如果新旧元素类型不同，直接干掉旧的，原位插入新的，需要找到参照元素；先找到目标元素的下一个元素，记住，然后将新元素插入到参照元素的前面；同时将旧的 vnode 置为 null ， 就会进入新建流程，等同于挂载了一个新节点；

   ```js
    const isSameVNodeType = (n1, n2) => {
       return n1.type === n2.type && n1.key === n2.key;
     };
   
     const unmount = (vnode) => {
       console.log(vnode.el);
       hostRemove(vnode.el);
     };
   
   
     // n1 是上一次的 vnode， n2 是新的 vnode, anchor 是 diff 时的位置参照节点
     const patch = (n1, n2, container, anchor = null) => {
       // 针对 vnode 的类型做不同处理
       const { shapeFlag, type } = n2;
   
       if (n1 && !isSameVNodeType(n1, n2)) {
         anchor = hostNextSibling(n1.el);
         unmount(n1);
         n1 = null;
       }
   
       switch (type) {
         case Text: // vnode 是个文本字符串要单独处理
           processText(n1, n2, container);
           break;
         default:
           debugger;
           // 非文本的其他情况
           if (shapeFlag & ShapeFlags.ELEMENT) {
             // 此时 vnode是普通元素，此处会进入 patch 递归终止
             processElement(n1, n2, container, anchor);
           } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
             // 此时 vnode 是状态组件, 内部会继续调用 patch 方法递归
             processComponent(n1, n2, container);
           }
           break;
       }
     };
   ```

2. #### 新旧元素类型相同，比较属性

   > children 和 属性 的比较是独立的，互不影响；

   - ##### 元素类型相同，

     - 比如都是 div ，就节点复用，然后更新属性和 children ；此时要进入 **patchElement **方法；

   ```js
   // renderer.ts 中
   
   // 对比新旧元素的属性
   const patchProps = (oldProps, newProps, el) => {
       if (oldProps !== newProps) {
           // 如果新旧属性值不一样, 就使用新的属性值
           for (let key in newProps) {
               const prev = oldProps[key];
               const next = newProps[key];
               if (prev !== next) {
                   hostPatchProp(el, key, prev, next);
               }
           }
           // 如果少了一个属性值，就从 el 中删除此属性
           for (let key in oldProps) {
               if (!(key in newProps)) {
                   hostPatchProp(el, key, oldProps[key], null);
               }
           }
       }
   };
   
   // 对比新旧元素,两者元素类型相同，此时要复用旧的元素，然后更新属性，更新 children
   const patchElement = (n1, n2, container) => {
       // 元素复用
       let el = (n2.el = n1.el);
       // 更新属性
       let oldProps = n1.props;
       let newProps = n2.props;
       patchProps(oldProps, newProps, el);
       // 更新children
       patchChildren(n1, n2, container);
   };
   
   ```

   - ##### 更新 children 的几种情况

     实际对比的是 children 的 vnode ，每个children 的 vnode 都只有三种情况：文本, 数组(包含 h 函数创建的对象, 和数组), null , 这样新旧组合就会有以下 9 种情况，有些操作可以进行合并。

     | 序号 | 新的children | 旧的children | 操作                 | 调用的方法                                        |
     | ---- | ------------ | ------------ | -------------------- | ------------------------------------------------- |
     | 1    | text         | text         | 直接设置新值覆盖旧的 | hostSetElementText(el, c2)                        |
     | 2    | text         | null         | 直接设置新值覆盖旧的 | hostSetElementText(el, c2)                        |
     | 3    | text         | arr          | 卸载旧的，设置新值   | unmountChildren(c1) hostSetElementText(el, c2)    |
     | 4    | arr          | text         | 清空旧的，挂载新的   | hostSetElementText(el, "")  mountChildren(c2, el) |
     | 5    | arr          | arr          | 进入 diff 算法       | patchKeyedChildren(c1, c2, el)                    |
     | 6    | arr          | null         | 挂载新的             | mountChildren(c2, el)                             |
     | 7    | null         | text         | 清空旧的             | hostSetElementText(el, "")                        |
     | 8    | null         | arr          | 卸载旧的，           | unmountChildren(c1)                               |
     | 9    | null         | null         | 无操作               | 无                                                |

     

   - 当新旧 children 都是数组时，先处理几种特殊情况，其宗旨自由一个，就是尽可能减小比对范围，同时尽可能对旧节点元素进行复用；

     > 总结步骤：
     >
     > 1. 头和头相比，看看能复用多少；
     > 2. 尾和尾相比，看看能复用多少；；
     > 3. 分析看看头部或尾部有无新增，有旧找到参照位置插入，分前插入和后插入；
     > 4. 分析看看头部或尾部有无删除, 有就删除，无需位置，直接删除；
     > 5. 看看是否需要进行乱序比较，也就是最长递增子序列；

     

     - 新旧头部部分序列相同。新旧 children 前面几个元素相同 ，后面不同，长度不定。此时从前向后逐个比较；

     <img src="vue3源码学习笔记(三).assets/image-20220405111210484.png" alt="image-20220405111210484" style="zoom:67%;" />

     - 新旧尾部部分序列相同。新旧 children 后面几个元素相同，前面不同；此时从后向前逐个比较；

       <img src="vue3源码学习笔记(三).assets/image-20220405145952652.png" alt="image-20220405145952652" style="zoom:80%;" />

     - 同序列加挂载。新 children 完全包含旧 children 的内容，只在前面或后面多出一部分；此种情况下，遍历指针索引会大于旧 children 长度索引；

       <img src="vue3源码学习笔记(三).assets/image-20220405112236481.png" alt="image-20220405112236481" style="zoom:80%;" />

       <img src="vue3源码学习笔记(三).assets/image-20220405112324570.png" alt="image-20220405112324570" style="zoom:80%;" />

     - 同序列删除。旧的 children 完全包含新的 children ， 只在前面或后面删除一部分元素；

       <img src="vue3源码学习笔记(三).assets/image-20220405112728062.png" alt="image-20220405112728062" style="zoom:80%;" />

       ​										<img src="vue3源码学习笔记(三).assets/image-20220405112931929.png" alt="image-20220405112931929" style="zoom:80%;" />

     - 乱序比较，性能上与  vue2 一样；

       > 1. 给新的乱序组建一个 Map 映射表 keyToNewIndexMap， key: vnode 的 key--> value: 整个数组索引 ；然后遍历旧的乱序的组，在映射中如果找不到 oldVnode 的 key ，说明要删除了；
       >
       > 2. 建立新旧索引映射表 newIndexToOldIndexMap(表示每一个是原来整个旧数组中的第几个) ，用一个数组表示，此数组长度为新的乱序组的长度，默认每项都为0；在上面映射表 m1 中如果找到了，就 改变 m2 中对应项的值；最后为 0 的部分都是在旧的乱序中没有找到的， 就要新增；找到的部分旧逐个插入；

        	<img src="vue3源码学习笔记(三).assets/image-20220405163018735.png" alt="image-20220405163018735" style="zoom:80%;" />

       ```js
        // 谁也没有把谁比较消耗完, 且又不是批量相同，就要进入乱序比较，最大可能复用旧的
             // 对于中间乱序的部分, 将新的做成映射表(旧的也可以), 将 key 作为 key, 索引作为 value
             let s1 = i;
             let s2 = i;
             const keyToNewIndexMap = new Map();
       
             const toBePatchedNum = l2 - s2 + 1; // 有几个乱序元素需要处理的
       
             // 乱序中已经被 patch 过了的就在此做标记，没有patch 过的最后就是 0 ,就是新增的
             const newIndexToOldIndexMap = new Array(toBePatchedNum).fill(0);
       
             // 从新的 children 中找到乱序的部分，得到映射表 keyToNewIndexMap
             for (let i = s2; i <= l2; i++) {
               const childVNode = c2[i];
               keyToNewIndexMap.set(childVNode.key, i);
             }
       
             console.log("keyToNewIndexMap----", keyToNewIndexMap);
       
             // 到旧的中去看看有没有可以复用的或有没有要删除的
             for (let i = s1; i <= l1; i++) {
               const oldVNode = c1[i];
               const newIndex = keyToNewIndexMap.get(oldVNode.key);
               if (newIndex === undefined) {
                 // 找不到旧的节点，说明需要删除了
                 unmount(oldVNode);
                 console.log("要删掉的---", oldVNode.key);
               } else {
                 // 先对在旧的乱序中找到的，建立新旧索引之间的关系
                 // newIndex - s2 是新的乱序序列组中的索引
                 // i+1 是在旧的整个数组中第几个,从 1 开始, 如果连续增长的就可以不用移动，尽可能少的移动
                 newIndexToOldIndexMap[newIndex - s2] = i + 1;
                 // 找到了就复用比对,并更新 新的 vnode
                 patch(oldVNode, c2[newIndex], el); // 此中会复用元素，更新属性，更新children
               }
             }
             console.log("newIndexToOldIndexMap----", newIndexToOldIndexMap);
       
             // 因为是从后向前插入的，因此此循环需要倒序
             for (let i = toBePatchedNum - 1; i >= 0; i--) {
               let currentIndex = i + s2; // 在整个新的数组中的索引
               let child = c2[currentIndex];
               // 只要后面还有就插入到后面一个的前面，否则就 append
               let anchor =
                 currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
               // == 0 表示在旧数组中没有找到的，需要新增
               if (newIndexToOldIndexMap[i] == 0) {
                 patch(null, child, el, anchor);
               } else {
                 hostInsert(child.el, el, anchor); // 对全部可以复用的元素都移动了, 此处可用最长递增子序列来优化
               }
             }
       ```

       

     - 最长递增子序列

       1. 是乱序比对中的一部分，对新旧数组中都有的乱序元素的插入做了优化；

       2. 在上面的乱序比对中，对可以连续复用的一些元素也进行了逐个移动插入，这里是可以进一步优化的，因此就有最长递增子序列的出现；

       3. 在上面的数组映射表 newIndexToOldIndexMap 中，对索引连续递增长的部分是可以不移动的，做到尽可能的少移动，这就叫最长递增子序列 。

       4. 首先找到在数组中连续增长做多的部分；vue3 中使用 **贪心+ 二分查找**  的算法；在查找中，如果当前的比 **目标列表** 中最后一个大，直接插入到最后；反之就用二分查找到列表中比当前小的最后一个，替换其后紧跟的那个。对数组中值为 0 的项，不需要处理，那是需要新增的 child 所在位置, 不需要移动；

       5. 按照 4 的算法得到的结果，数量是对的，但是结果会有出入，是替换动作导致的，有些是不需要替换的。因此使用前驱方式，结果集合中的每一项都是当前最小的尾项，要记住自己的前一个的索引，最后追溯找到自己的前一个，最后将索引转为值，

       6. 使用最长递增子序列算法，得到乱序组中全部不需要移动的元素，在乱序组中的索引；然后，将整个乱序组倒序遍历，将索引与不移动元素的索引对比，相同的就是不需要移动的，进行跳过，需要移动的就插入；

          ```js
            // 计算不需要移动的最长递增子序列，increasingNewIndexSequence 存放的是，乱序组中全部不需要移动的元素, 在乱序组中的索引
                let increasingNewIndexSequence = getSequence(newIndexToOldIndexMap);
                let j = increasingNewIndexSequence.length - 1; // 最后一个不需要移动的元素的索引
                console.log("---不动的--", increasingNewIndexSequence);
                // 因为是从后向前插入的，因此此循环需要倒序
                for (let i = toBePatchedNum - 1; i >= 0; i--) {
                  let currentIndex = i + s2; // 在整个新的数组中的索引
                  let child = c2[currentIndex];
                  // 只要后面还有就插入到后面一个的前面，否则就 append
                  let anchor =
                    currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                  // == 0 表示在旧数组中没有找到的，需要新增
                  if (newIndexToOldIndexMap[i] == 0) {
                    patch(null, child, el, anchor);
                  } else {
                    // 需要移动
                    if (i !== increasingNewIndexSequence[j]) {
                      hostInsert(child.el, el, anchor);
                    } else {
                      j--; // 跳过不需要移动的元素
                    }
                  }
                }
          ```

          

       7. 没有最长递增子序列之前，性能是 O(n 2) , 之后是 n(n*logn) ; 大大优化了；

          ```js
          // 最长递增子序列算法
          export function getSequence(arr) {
            const len = arr.length;
            const result = [0]; // 结果集中默认有第一项, 粗放的是索引值，一定是连续增长的
            const p = new Array(arr.length); // 一个与 arr 等长的数组，用来存放索引
            let start;
            let end;
            let middle; // result 集合的中间值
            for (let i = 0; i < len; i++) {
              const item = arr[i];
              if (item !== 0) {
                let resultLastIndex = result[result.length - 1];
                // 如果当前项比结果集中最后一个大就放到结果集中，要的是连续增长的数字
                if (item > arr[resultLastIndex]) {
                  p[i] = resultLastIndex; // 当前项的前一个索引
                  result.push(i);
                  continue;
                }
                // 如果当前项比结果集中最后一个小，就要进行二分查找，找到结果集中比当前项小的最后一个，替换其后紧跟的那个
                // 二分查找
                start = 0;
                end = result.length - 1;
                while (start < end) {
                  middle = ((start + end) / 2) | 0; // 只取整数部分
                  // 如果当前项比中间值大，就到右半部分中找，反之到左半部分找
                  if (arr[result[middle]] < item) {
                    start = middle + 1;
                  } else {
                    end = middle;
                  }
                  console.log("middle--", middle);
                }
          
                // 当前值很大, 比缩小范围后找到的最后一个还大时，就不能替换，相等时也不能替换，只有较小的值才是我们需要的
                if (item < arr[result[start]]) {
                  // 替换时要将被替换项的前一个索引记下来
                  if (start > 0) {
                    p[i] = result[start - 1];
                  }
                  // 最终目的是替换 result 集合中的某个值
                  result[start] = i;
                }
              }
            }
            let len1 = result.length;
            let last = result[len1 - 1];
            while (len1-- > 0) {
              result[len1] = last;
              last = p[last];
            }
          
            return result;
          }
          
          const arr = [2, 3, 1, 5, 6, 8, 7, 9, 4];
          console.log(getSequence(arr)); // [ 0, 1, 3, 4, 6, 7 ]  --> 2,3,5,6,7,9
          ```

          

















