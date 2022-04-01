// 位运算, a<<3 表示 a*(2*3), 即乘以 2 的三次方, >> 表示 除然后取整
// & 表示与运算，两位都是 1 时得1, 反之得 0, 从右向左同位进行运算;
// | 表示或运算，任意一个得有一位是 1 时得1, 反之得 0, 从右向左同位进行运算;

export const enum ShapeFlags {
  ELEMENT = 1, // // 00000001 -> 1   普通元素
  FUNCTIONAL_COMPONENT = 1 << 1, // 00000010 -> 2  函数组件
  STATEFUL_COMPONENT = 1 << 2, // 00000100 -> 4  状态组件
  TEXT_CHILDREN = 1 << 3, // 00001000 -> 8 子节点是文本节点
  ARRAY_CHILDREN = 1 << 4, // 00010000 -> 16 子节点是数组
  SLOTS_CHILDREN = 1 << 5, // 00100000 -> 32 子节点是插槽
  TELEPORT = 1 << 6, // 01000000 -> 64 teleport 组件
  SUSPENSE = 1 << 7, // 10000000 -> 128 异步组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 100000000 -> 256
  COMPONENT_KEPT_ALIVE = 1 << 9, // 1000000000 -> 512
  // 状态组件和函数组件
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}

// export const enum ShapeFlags {
//   ELEMENT = 1,
//   FUNCTIONAL_COMPONENT = 2,
//   STATEFUL_COMPONENT = 4,
//   TEXT_CHILDREN = 8,
//   ARRAY_CHILDREN = 16,
//   SLOTS_CHILDREN = 32,
//   TELEPORT = 64,
//   SUSPENSE = 128,
//   COMPONENT_SHOULD_KEEP_ALIVE = 256,
//   COMPONENT_KEPT_ALIVE = 512,
//   COMPONENT = 6,
// }
