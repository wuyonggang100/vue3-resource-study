// dom 属性的增删改查
import { patchAttr } from "./modules/attr";
import { patchClass } from "./modules/class";
import { patchEvent } from "./modules/event";
import { patchStyle } from "./modules/style";

// 对比元素的某个属性
export const patchProp = (el, key, preValue, nextValue) => {
  switch (key) {
    case "class":
      patchClass(el, nextValue); // 比对 class ,只需要新值
      break;
    case "style":
      patchStyle(el, preValue, nextValue); // 比对内联样式
      break;
    default:
      // 以 on 开头后跟大写就认为是事件
      if (/^on[A-Z].test(key)/) {
        patchEvent(el, key, nextValue); // 事件就是添加，移除，修改
      } else {
        // 如果不是事件，就是属性
        patchAttr(el, key, nextValue);
      }
      break;
  }
};
