// node 节点操作
export const nodeOps = {
  createElement: (tagName) => document.createElement(tagName),
  remove: (child) => {
    let parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  insert: (child, parent, anchor = null) => {
    // anchor 参照为空就是 appendChild
    parent.insertBefore(child, anchor);
  },
  querySelector: (selector) => document.querySelector(selector),
  setElementText: (el, text) => {
    el.textContent = text;
  },
  // 创建文本节点
  createText: (text) => document.createTextNode(text),
  // 设置文本
  setText: (node, text) => (node.nodeValue = text),
};
