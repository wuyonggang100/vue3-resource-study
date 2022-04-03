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
    nextSibling: hostNextSibling,
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
          console.log("subTree---", subTree);

          // 用 render 函数的返回值继续渲染，此处是个递归
          patch(null, subTree, container);
          instance.isMounted = true;
        } else {
          // diff 更新
          console.log("数据更新了，要 diff 更新 ui 了");

          // 获取组件实例的新旧 subTree 进行对比
          const prevSubTree = instance.subTree;
          let proxyToUse = instance.proxy; // 作为 render 的参数，调用 render 后可以获取新的 subTree ;
          const nextSubTree = instance.render.call(proxyToUse, proxyToUse);
          // debugger;
          console.log("prevSubTree----", prevSubTree);
          console.log("nextSubTree----", nextSubTree);
          patch(prevSubTree, nextSubTree, container);
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
      console.log("组件更新了----");
    }
  };

  // --------处理普通元素----------------

  // 对比新旧元素的 children,  都是数组，都有 key
  const patchKeyedChildren = (c1, c2, container) => {
    //
  };
  // 子节点是数组
  const mountChildren = (children, container) => {
    // 多个子节点需要拼接后再一次性插入，可以向创建成虚拟节点，再一次性插入
    for (const item of children) {
      // 将每个子节点变成一个 vnode，然后塞进 容器，即 el 中
      let child = nomalizeVNode(item);
      patch(null, child, container);
    }
  };
  // 移除 children, 每一项是个 vnode
  const unmountChildren = (children) => {
    for (let child of children) {
      unmount(child);
    }
  };

  // 第一次挂载元素
  const mountElement = (vnode, container, anchor = null) => {
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

    // 创建外层 type 节点，不包含 children, 插入到参考节点的前面，如果没有参考节点，就 append
    hostInsert(el, container, anchor);
  };

  // children 的 vnode 只有三种情况, 文本, 数组(包含 h 函数创建的对象,和数组), null ,
  // 对比新旧元素的 children，实际上组合起来有九种操作, 有些操作可以进行合并,
  // 其中 arr --- arr 会走入 diff 算法；其他不会
  const patchChildren = (n1, n2, el) => {
    const c1 = n1.children;
    const c2 = n2.children;
    const prevShapFlag = n1.shapeFlag;
    const shapFlag = n2.shapeFlag;
    debugger;
    // children 的 vnode 只有三种情况, 文本, 数组(包含 h 函数创建的对象,和数组), null ,
    if (shapFlag & ShapeFlags.TEXT_CHILDREN) {
      // 1. 新元素或旧元素的 children 是文本
      // 新的是文本，旧的是数组
      if (prevShapFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1);
      }
      // 新的是文本，旧的文本或 null ；
      if (c1 !== c2) {
        hostSetElementText(el, c2);
      }
    } else {
      // 此块内新的children 是数组或空
      if (prevShapFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 旧元素的 children 是数组
        // 如果新元素的 children 是数组，就是两个数组的比对，就要走 diff 算法
        if (shapFlag & ShapeFlags.ARRAY_CHILDREN) {
          // diff -----
          patchKeyedChildren(c1, c2, el);
        } else {
          // 不是数组，也不是字符串，那就是空, 要将旧的 children 删掉
          unmountChildren(c1);
        }
      } else {
        // 如果旧的children 是文本，需要先清空
        if (prevShapFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(el, "");
        }

        // 新的是数组， 旧的是 文本或 null, 文本在上一行被干掉了， null 就直接挂载新的
        if (shapFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el);
        }
      }
    }
    // 2. 新旧元素都有children,

    // 3. 新元素有 children, 旧元素没有
    // 4. 新元素没有 children， 旧元素有
  };
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

    // 更新元素的属性
    let oldProps = n1.props;
    let newProps = n2.props;
    patchProps(oldProps, newProps, el);

    // 更新元素的 children
    patchChildren(n1, n2, el);
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
  const processElement = (n1, n2, container, anchor = null) => {
    if (n1 == null) {
      // 第一次挂载
      mountElement(n2, container);
    } else {
      // 更新元素
      console.log("diff 更新元素-----");
      patchElement(n1, n2, container);
    }
  };
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

  const render = (vnode, container) => {
    patch(null, vnode, container);
  };
  return {
    createApp: createAppApi(render),
  };
}
