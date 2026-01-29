import https from 'https';
import { createSocksAgent } from './proxy.js';

const BASE_URL = 'https://wannianrili.bmcx.com/ajax/';
const FETCH_TIMEOUT = 10000; // 10秒超时

export const getCalendarUrl = (date) => {
    return `${BASE_URL}?v=22121331&q=${date}`;
};

export const fetchCalendarHtml = async (date) => {
    const url = getCalendarUrl(date);

    const options = {
        timeout: FETCH_TIMEOUT,
    };

    const agent = createSocksAgent();
    if (agent) {
        options.agent = agent;
    }

    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
};

/**
 * 生成年份范围内的所有月份
 * @param {number} startYear 起始年份
 * @param {number} endYear 结束年份
 * @returns {string[]} 月份数组，格式如 ['2026-01', '2026-02', ...]
 */
export const generateMonths = (startYear, endYear) => {
    const months = [];
    for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
            months.push(`${year}-${String(month).padStart(2, '0')}`);
        }
    }
    return months;
};
