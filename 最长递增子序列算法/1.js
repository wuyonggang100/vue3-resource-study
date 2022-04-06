const arr = [2, 3, 1, 5, 6, 8, 7, 9, 4];

function getSequence(arr) {
  const len = arr.length;
  const result = [0]; // 结果集中默认有第一项, 粗放的是索引值，一定是连续增长的
  const p = new Array(arr.length); // 一个与 arr 等长的数组，用来存放索引
  let start;
  let end;
  let middle; // result 集合的中间值
  for (let i = 0; i < len; i++) {
    const item = arr[i];
    if (item !== 0) {
      let resultLastIndex = result[result.length - 1];
      // 如果当前项比结果集中最后一个大就放到结果集中，要的是连续增长的数字
      if (item > arr[resultLastIndex]) {
        p[i] = resultLastIndex; // 当前项的前一个索引
        result.push(i);
        continue;
      }
      // 如果当前项比结果集中最后一个小，就要进行二分查找，找到结果集中比当前项小的最后一个，替换其后紧跟的那个
      // 二分查找
      start = 0;
      end = result.length - 1;
      while (start < end) {
        middle = ((start + end) / 2) | 0; // 只取整数部分
        // 如果当前项比中间值大，就到右半部分中找，反之到左半部分找
        if (arr[result[middle]] < item) {
          start = middle + 1;
        } else {
          end = middle;
        }
        console.log("middle--", middle);
      }

      // 当前值很大, 比缩小范围后找到的最后一个还大时，就不能替换，相等时也不能替换，只有较小的值才是我们需要的
      if (item < arr[result[start]]) {
        // 替换时要将被替换项的前一个索引记下来
        if (start > 0) {
          p[i] = result[start - 1];
        }
        // 最终目的是替换 result 集合中的某个值
        result[start] = i;
      }
    }
  }
  let len1 = result.length;
  let last = result[len1 - 1];
  while (len1-- > 0) {
    result[len1] = last;
    last = p[last];
  }

  return result;
}

console.log(getSequence(arr));
