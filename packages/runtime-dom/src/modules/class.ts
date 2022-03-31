export const patchClass = (el, value) => {
  if (value == null) {
    value = "";
  }
  // 只保留新的 class
  el.className = value;
};
