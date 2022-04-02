let queue = [];
let isFlushPending = false;
export function queueJob(job) {
  // 保证同一个 effect 在一次调度中只会执行一次
  if (!queue.includes(job)) {
    queue.push(job);
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushPending) {
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}
function flushJobs() {
  isFlushPending = false;
  queue.sort((a, b) => a.id - b.id); // 升序排列，父在前，子在后
  queue.forEach((job) => job());
  queue.length = 0;
}
