// 就是 createElement
import { isArray, isObject } from "@vue/shared";
import { createVNode, isVnode } from "./vnode";

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
