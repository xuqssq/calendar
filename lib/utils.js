/**
 * 重试函数
 * @param {Function} fn 要执行的异步函数
 * @param {number} retries 重试次数
 * @param {number} delay 重试间隔(ms)
 * @returns {Promise}
 */
export const retry = async (fn, retries = 3, delay = 1000) => {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < retries) {
                await sleep(delay * (i + 1)); // 递增延迟
            }
        }
    }
    throw lastError;
};

/**
 * 延迟函数
 * @param {number} ms 延迟毫秒数
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 并行执行任务（带并发控制）
 * @param {Array} items 要处理的项目数组
 * @param {Function} fn 处理函数 (item, index) => Promise
 * @param {number} concurrency 并发数
 * @returns {Promise<Array>} 结果数组
 */
export const parallel = async (items, fn, concurrency = 5) => {
    const results = new Array(items.length);
    let currentIndex = 0;

    const worker = async () => {
        while (currentIndex < items.length) {
            const index = currentIndex++;
            const item = items[index];
            try {
                results[index] = { success: true, data: await fn(item, index) };
            } catch (error) {
                results[index] = { success: false, error, item };
            }
        }
    };

    // 创建并发 worker
    const workers = Array(Math.min(concurrency, items.length))
        .fill(null)
        .map(() => worker());

    await Promise.all(workers);
    return results;
};
