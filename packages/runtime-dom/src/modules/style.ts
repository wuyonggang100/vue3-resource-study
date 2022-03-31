// 比对 dom 内联样式
export const patchStyle = (el, prev, next) => {
  const style = el.style;
  if (next == null) {
    el.removeAttribute("style");
  } else {
    // 老的里有，新的里面没有
    if (prev) {
      for (let key in prev) {
        if (next[key] == null) {
          style[key] = "";
        }
      }
    }
    // 新的里面需要直接覆盖
    for (let key in next) {
      style[key] = next[key];
    }
  }
};
