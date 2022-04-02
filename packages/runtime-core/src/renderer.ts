import { createAppApi } from "./apiCreateApp";
import { isObject, ShapeFlags } from "@vue/shared";
import { createComponentInstance, setupComponent } from "./component";
import { effect } from "@vue/reactivity";
import { createVNode, nomalizeVNode, Text } from "./vnode";
import { queueJob } from "./scheduler";

export function createRenderer(rendererOptions) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setText: hostSetText,
    setElementText: hostSetElementText,
    patchProp: hostPatchProp,
  } = rendererOptions;

  const setupRenderEffect = (instance, container) => {
    // 每个组件都有一个 effect 函数，vue3 是组件级更新
    effect(
      function componentEffect() {
        if (!instance.isMounted) {
          // 初次渲染
          const proxyToUse = instance.proxy;

          // 组件内渲染的内容为 subTree , 得到一个 vnode， 即 render 函数执行后的结果是个 vnode
          // 更新的时候可以用 subTree 进行对比；
          let subTree = (instance.subTree = instance.render.call(
            proxyToUse,
            proxyToUse
          ));
          console.log(subTree);

          // 用 render 函数的返回值继续渲染，此处是个递归
          patch(null, subTree, container);
          instance.isMounted = true;
        } else {
          // diff 更新
          console.log("数据更新了，要 diff 更新 ui 了");
        }
      },
      {
        scheduler: queueJob,
      }
    );
  };

  // ------------- 挂载 --------------------
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

  // ------------处理组件---------------------
  const processComponent = (n1, n2, container) => {
    // 没有上一次虚拟节点就是初始化操作，否则就是更新
    if (n1 == null) {
      mountComponent(n2, container); // 直接挂载到容器中
    } else {
      // diff 更新
      console.log("节点更新了----");
    }
  };

  // --------处理普通元素----------------

  // 子节点是数组
  const mountChildren = (children, container) => {
    // 多个子节点需要拼接后再一次性插入，可以向创建成虚拟节点，再一次性插入
    for (const item of children) {
      // 将每个子节点变成一个 vnode，然后塞进 容器，即 el 中
      let child = nomalizeVNode(item);
      patch(null, child, container);
    }
  };
  // 第一次挂载元素
  const mountElement = (vnode, container) => {
    // 此处是个递归过程
    const { props, shapeFlag, type, children } = vnode;
    const el = (vnode.el = hostCreateElement(type));
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    debugger;
    // 将 children 塞进外层
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // children 是个 文本 , 终止 mountElement递归
      hostSetElementText(el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // children 如果是数组 16
      mountChildren(children, el);
    }

    // 创建外层 type 节点，不包含 children
    hostInsert(el, container);
  };

  // 对文本字符串的处理
  const processText = (n1, n2, container) => {
    debugger;
    if (n1 == null) {
      // 新创建
      let text = hostCreateText(n2.children);
      hostInsert((n2.el = text), container);
    }
  };

  // 对普通元素节点的处理
  const processElement = (n1, n2, container) => {
    if (n1 == null) {
      // 第一次挂载
      mountElement(n2, container);
    } else {
      // 更新元素
    }
  };

  // n1 是上一次的虚拟节点， n2 是新的虚拟节点
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
          // 此时 vnode 是状态组件, 内部会继续调用 patch 方法递归
          processComponent(n1, n2, container);
        }
        break;
    }
  };
  const render = (vnode, container) => {
    patch(null, vnode, container);
  };
  return {
    createApp: createAppApi(render),
  };
}
