// h('div',{style:{color:red}}, "children")
// h 方法和 createApp 方法类似

/*
 * type 可以是组件或者普通元素字符串
 * children 是插槽
 * */
import { isArray, isObject, isString, ShapeFlags } from "@vue/shared";

export function createVNode(type, props, children = null) {
  // string 就是普通元素， 对象就认为是状态组件, 其他就暂且认为不是组件
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : 0;
  // 虚拟节点有跨平台的能力
  const vnode = {
    __v_isVnode: true, // 标识是一个虚拟节点
    type,
    props,
    children,
    component: null, // 存放组件对应的实例
    el: null, // 对应的真实节点
    key: props && props.key,
    shapeFlag,
  };
  nomalizeChildren(vnode, children);
  return vnode;
}

export function isVnode(vnode) {
  return vnode.__v_isVnode;
}
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
  vnode.shapeFlag = vnode.shapeFlag | type;
  // 等同于 vnode.shapeFlag |=  type;
}
