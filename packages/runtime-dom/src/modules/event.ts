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
      invokers[key] = undefined;
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
