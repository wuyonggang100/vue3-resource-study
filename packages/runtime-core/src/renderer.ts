import { createAppApi } from "./apiCreateApp";
import { isObject, ShapeFlags } from "@vue/shared";
import { createComponentInstance, setupComponent } from "./component";
import { effect } from "@vue/reactivity";
import { createVNode, nomalizeVNode, Text } from "./vnode";
import { queueJob } from "./scheduler";
import { getSequence } from "./getSequence";

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
  const patchKeyedChildren = (c1, c2, el) => {
    debugger;
    // 默认都从前向后比较
    let i = 0;
    let l1 = c1.length - 1;
    let l2 = c2.length - 1;

    // 1. 看看新旧头部是否有相同的, 如果相同，就比递归较他们的 children, 不相同就跳出循环进行尾部比较
    while (i <= l1 && i <= l2) {
      const n1 = c1[i];
      const n2 = c2[i];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      i++;
    }
    console.log("前面比完了---", i, l1, l2);
    // 2. 看看新旧尾部是否有相同的, 从后向前找，相同的先处理掉，比完后就有一方头和尾已经比较完毕了，剩下就是进入分析处理
    while (i <= l1 && i <= l2) {
      const n1 = c1[l1];
      const n2 = c2[l2];
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      l1--;
      l2--;
    }
    console.log("后面比完了---", i, l1, l2);
    //------------------分析处理阶段-------------------
    // i > l1: 说明c2 已经把 c1 的头和尾比较完了,不需要乱序比较了
    if (i > l1) {
      debugger;
      // 此时就是新增了，旧的少，新的多, 可能从前插入， 也可能从后插入，因此需要找到插入位置
      if (i <= l2) {
        // 此时 l1<i<=l2
        // 此时 l2 是尾部相同区域起点的前一个位置
        // nextPos < c2.length-1 表示尾部有相同的部分，需要插入到尾部相同区域的前面， 即 l2 索引的后面
        // nextPos >= c2.length-1 表示尾部没有相同部分，直接 append
        const anchor = l2 < c2.length - 1 ? c1[l1 + 1].el : null;
        while (i <= l2) {
          patch(null, c2[i], el, anchor);
          i++;
        }
      }
    } else if (i > l2) {
      // 旧的把新的头和尾比较完了,需要做删除操作, 也不需要乱序比较
      while (i <= l1) {
        unmount(c1[i]);
        i++;
      }
    } else {
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

      // console.log("keyToNewIndexMap----", keyToNewIndexMap);

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
          // i+1 是在旧的整个数组中第几个,从 1 开始
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          // 找到了就比对,并更新 新的 vnode
          patch(oldVNode, c2[newIndex], el); // 复用元素，更新属性，更新 children
          console.log("新旧索引映射表---", newIndexToOldIndexMap);
        }
      }
      // console.log("keyToNewIndexMap----", keyToNewIndexMap);
      console.log("newIndexToOldIndexMap----", newIndexToOldIndexMap);

      debugger;
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
    }
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
      mountElement(n2, container, anchor);
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
    debugger;
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
