import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchCalendarHtml, generateMonths } from './lib/api.js';
import { parseCalendarHtml } from './lib/parser.js';
import { retry, parallel, isValidJsonFile } from './lib/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置
const CONFIG = {
    concurrency: 10,  // 并发数
    retries: 3,       // 重试次数
    retryDelay: 1000, // 重试延迟(ms)
};

/**
 * 获取并保存单个月份的数据（带重试）
 */
const fetchAndSaveMonth = async (month, outputDir) => {
    const outputPath = path.join(outputDir, `${month}.json`);

    // 检查文件是否已存在且内容有效（长度大于5），存在则跳过
    const { valid, data } = await isValidJsonFile(outputPath, 5);
    if (valid) {
        return { month, count: data.length, skipped: true };
    }

    return retry(async () => {
        const html = await fetchCalendarHtml(month);
        const calendarData = parseCalendarHtml(html);

        // 数据为空时抛出错误触发重试
        if (!calendarData || calendarData.length === 0) {
            throw new Error('解析数据为空，需要重试');
        }

        await fs.writeFile(outputPath, JSON.stringify(calendarData, null, 2), 'utf-8');

        return { month, count: calendarData.length };
    }, CONFIG.retries, CONFIG.retryDelay);
};

/**
 * 获取年份范围内的所有日历数据（并行）
 */
const fetchYearRange = async (startYear, endYear) => {
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const months = generateMonths(startYear, endYear);
    console.log(`开始获取 ${startYear}-${endYear} 年的数据，共 ${months.length} 个月...`);
    console.log(`并发数: ${CONFIG.concurrency}, 重试次数: ${CONFIG.retries}\n`);

    let completed = 0;
    const results = await parallel(
        months,
        async (month) => {
            const result = await fetchAndSaveMonth(month, outputDir);
            completed++;
            const progress = ((completed / months.length) * 100).toFixed(1);
            if (result.skipped) {
                console.log(`[${progress}%] ⊘ ${month} (已存在，跳过)`);
            } else {
                console.log(`[${progress}%] ✓ ${month} (${result.count} 天)`);
            }
            return result;
        },
        CONFIG.concurrency
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const skipped = successful.filter(r => r.result?.skipped).length;

    console.log(`\n完成！成功: ${successful.length}/${months.length} 个月${skipped > 0 ? `（跳过: ${skipped}）` : ''}`);

    if (failed.length > 0) {
        console.log(`\n失败的月份 (${failed.length}):`);
        failed.forEach(f => console.log(`  ✗ ${f.item}: ${f.error.message}`));
    }

    console.log(`\n数据保存在: ${outputDir}`);
};

const args = [1999, 2100]
const startYear = parseInt(args[0]) || new Date().getFullYear();
const endYear = parseInt(args[1]) || startYear;

fetchYearRange(startYear, endYear);
