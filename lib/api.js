import https from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';

const BASE_URL = 'https://wannianrili.bmcx.com/ajax/';
const FETCH_TIMEOUT = 10000; // 10秒超时

// SOCKS5 代理配置 (设为 null 或空字符串禁用代理)
// 格式: socks5h://username:password@host:port
// 可通过环境变量 SOCKS_PROXY_URL 配置
const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL || 'socks5h://if:xuqssq@127.0.0.1:6666';

export const getCalendarUrl = (date) => {
    return `${BASE_URL}?v=22121331&q=${date}`;
};

export const fetchCalendarHtml = async (date) => {
    const url = getCalendarUrl(date);

    const options = {
        timeout: FETCH_TIMEOUT,
    };

    if (SOCKS_PROXY_URL) {
        options.agent = new SocksProxyAgent(SOCKS_PROXY_URL);
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
