// 组件中所有的方法
import { isFunction, isObject, ShapeFlags } from "@vue/shared";
import { PublicInstanceProxyHandlers } from "./componentPublicInstance";

export function createComponentInstance(vnode) {
  // 创建组件实例, 给实例增加属性
  const instance = {
    vnode,
    type: vnode.type,
    props: {},
    attrs: {},
    slots: {},
    data: {}, // 组件的 data
    ctx: null,
    proxy: null, // 将 props 和 data 属性都代理过来
    render: null, // render 函数
    setupState: {}, // 如果 setup 返回一个对象，这个对象会作为 setupState
    isMounted: false, //标识组件是否已经挂载过
  };
  instance.ctx = { _: instance };
  return instance;
}

// 解析数据挂载到实例上
export function setupComponent(instance) {
  const { props, children } = instance.vnode;
  // 根据 vnode的props 解析出 props 和 attrs，放到 instance 上
  instance.props = props;
  instance.children = children;
  let isStateFul = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT;
  // 是一个状态组件
  if (isStateFul) {
    setupStatefulComponent(instance);
  }
}

function setupStatefulComponent(instance) {
  // 1.代理传递给 render 函数的参数
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any);
  // 2. 获取组件类型，拿到组件的 setup 方法
  let Component = instance.type;
  let { setup } = Component;
  if (setup) {
    let setupContext = createSetupContext(instance);
    const setupResult = setup(instance.props, setupContext);
    handleSetupResult(instance, setupResult);
  } else {
    finishComponentSetup(instance);
  }
}

// setup 执行的结果可能是对象或者函数， 如果是函数,就会作为 render 函数
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    // 作为 render 函数
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    instance.setupState = setupResult;
  }
  finishComponentSetup(instance);
}

// 完成组件启动, 得到组件的 render 函数
function finishComponentSetup(instance) {
  let Component = instance.type;
  if (!instance.render) {
    if (!Component.render && Component.template) {
      // 组件如果没有 render 函数，就要对模板进行编译，得到 组件的 render  函数
      // todo ...
    }
    instance.render = Component.render;
  }
  // console.log(instance.render.toString());
  console.log(instance);
}

// context 对象的五个属性
function createSetupContext(instance) {
  return {
    attrs: instance.attrs,
    props: instance.props,
    slots: instance.slots,
    emit: () => {},
    expose: () => {},
  };
}
