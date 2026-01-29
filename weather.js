import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { proxyFetch } from './lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 城市列表
const CITIES = [
  // A
  'anshun', 'anzhou', 'anqing', 'anshan',
  // B
  'beijing', 'baoding', 'baotou', 'bengbu', 'bozhou',
  // C
  'chongqing', 'changchun', 'changsha', 'chengdu', 'chuzhou', 'changzhou',
  // D
  'dalian', 'dongguan', 'dandong', 'dezhou', 'dongying', 'deyang',
  // F
  'fuzhou', 'foshan', 'fuyang', 'fujian', 'fushun',
  // G
  'guangzhou', 'guilin', 'guiyang', 'ganzhou',
  // H
  'hangzhou', 'hefei', 'hebei', 'hainan', 'hunan', 'huzhou',
  // J
  'jinan', 'jiujiang', 'jiangxi', 'jiangsu', 'jilin', 'jining',
  // K
  'kunming', 'kaiyuan', 'kaili', 'kaifeng',
  // L
  'lianyungang', 'lijiang', 'longyan', 'liangping', 'luzhou', 'leshan', 'longquan',
  // M
  'meizhou', 'mianyang', 'macau',
  // N
  'nanjing', 'nanchang', 'nanning', 'nanyang', 'ningbo', 'nantong',
  // P
  'pingdingshan', 'pingxiang', 'putian', 'pingyang',
  // Q
  'qingdao', 'qinghai', 'qiqihar', 'qinzhou', 'qinhuangdao',
  // S
  'shenzhen', 'shanghai', 'suzhou', 'shijiazhuang', 'shaoxing', 'shantou',
  // T
  'tianjin', 'taiyuan', 'taizhou', 'tonghua', 'taian', 'tianmen',
  // W
  'wuhan', 'wenzhou', 'weifang', 'wulumuqi', 'wuxi', 'wuhu', 'weihai',
  // X
  "xi'an", 'xiamen', 'xingtai', 'xiangyang', 'xuzhou', 'xuchang',
  // Y
  'yantai', 'yichang', 'yuxi', 'yibin', 'yuncheng', 'yinchuan', 'yancheng',
  // Z
  'zhuhai', 'zhengzhou', 'zunyi', 'zhongshan', 'zibo', 'zhoukou', 'zhangjiajie',
  'zhangzhou', 'zhenjiang', 'zhumadian', 'zhongwei', 'zigong', 'zhanjiang',
  'zhangye', 'zhangjiakou', 'zhoushan', 'zhuji', 'zhanghe', 'zhaoqing',
];


// 特殊城市（需要指定省份）
const SPECIAL_CITIES = [
  { name: 'suzhoujs', query: 'suzhou,js,cn' },
];

// 配置
const CONFIG = {
  baseUrl: 'https://weather-in-calendar.com/cal/weather-cal.php',
  outputDir: path.join(__dirname, 'weather'),
  concurrency: 5,
  retries: 3,
  retryDelay: 2000,
};

// 天气描述翻译映射
const WEATHER_TRANSLATIONS = {
  'Overcast clouds': '多云',
  'Sky is clear': '晴',
  'Scattered clouds': '局部多云',
  'Broken clouds': '部分多云',
  'Few clouds': '少量云',
  'Light rain': '小雨',
  'Moderate rain': '中雨',
  'Heavy rain': '大雨',
  'Thunderstorm': '雷暴',
  'Snow': '下雪',
  'Light snow': '小雪',
  'Sunrise': '日出',
  'and sets': '日落',
  'Humidity': '湿度',
};

// 风向翻译映射
const WIND_TRANSLATIONS = {
  'from N\\b': '北',
  'from S\\b': '南',
  'from E\\b': '东',
  'from W\\b': '西',
  'from NE\\b': '东北',
  'from NW\\b': '西北',
  'from SE\\b': '东南',
  'from SW\\b': '西南',
  'from NNW\\b': '北偏西',
  'from NNE\\b': '北偏东',
  'from SSW\\b': '南偏西',
  'from SSE\\b': '南偏东',
  'from WNW\\b': '西北偏西',
  'from WSW\\b': '西南偏西',
  'from ESE\\b': '东南偏东',
  'from ENE\\b': '东偏东北',
};

/**
 * 延迟函数
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试的请求函数
 */
const fetchWithRetry = async (url, retries = CONFIG.retries) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await proxyFetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  重试 ${i + 1}/${retries}: ${error.message}`);
      await delay(CONFIG.retryDelay);
    }
  }
};

/**
 * 翻译ICS内容
 */
const translateIcsContent = (content) => {
  let result = content;

  // 删除指定的 URL 行
  result = result.replace(/URL;VALUE=URI:https:\/\/www\.vejnoe\.dk\s*/g, '');

  // 翻译天气描述
  for (const [en, zh] of Object.entries(WEATHER_TRANSLATIONS)) {
    result = result.replace(new RegExp(en, 'g'), zh);
  }

  // 翻译风向
  for (const [pattern, zh] of Object.entries(WIND_TRANSLATIONS)) {
    result = result.replace(new RegExp(pattern, 'g'), zh);
  }

  // 替换链接和元数据
  result = result.replace(
    /https:\/\/openweathermap\.org\/city\/\d+/g,
    'https://github.com/xuqssq'
  );
  result = result.replace(
    /Thanks for using Weather in Your Calendar, please consider supporting/g,
    '更多日历订阅请点击'
  );
  result = result.replace(
    /https:\/\/weather-in-calendar\.com/g,
    'https://github.com/xuqssq'
  );
  result = result.replace(/^X-WR-CALNAME:.*$/gm, 'X-WR-CALNAME:天气订阅');
  result = result.replace(/^PRODID:.*$/gm, 'PRODID:-//Moli-X//Weather//CN');
  result = result.replace(/^CONTACT:.*$/gm, '');

  return result;
};

/**
 * 获取单个城市的天气数据
 */
const fetchCityWeather = async (cityName, cityQuery = null) => {
  const query = cityQuery || cityName;
  const url = `${CONFIG.baseUrl}?city=${encodeURIComponent(query)}&units=metric&temperature=low-high`;

  try {
    const content = await fetchWithRetry(url);
    const translatedContent = translateIcsContent(content);

    // 创建城市目录
    const cityDir = path.join(CONFIG.outputDir, cityName);
    await fs.mkdir(cityDir, { recursive: true });

    // 保存文件
    const filePath = path.join(cityDir, `${cityName}.ics`);
    await fs.writeFile(filePath, translatedContent, 'utf-8');

    return { city: cityName, success: true };
  } catch (error) {
    return { city: cityName, success: false, error: error.message };
  }
};

/**
 * 并行处理函数
 */
const parallel = async (items, fn, concurrency) => {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = fn(item).then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
};

/**
 * 主函数
 */
const main = async () => {
  console.log('开始获取天气数据...\n');
  console.log(`城市数量: ${CITIES.length + SPECIAL_CITIES.length}`);
  console.log(`并发数: ${CONFIG.concurrency}`);
  console.log(`输出目录: ${CONFIG.outputDir}\n`);

  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // 合并所有城市任务
  const tasks = [
    ...CITIES.map(city => ({ name: city, query: null })),
    ...SPECIAL_CITIES.map(city => ({ name: city.name, query: city.query })),
  ];

  let completed = 0;
  const results = await parallel(
    tasks,
    async (task) => {
      const result = await fetchCityWeather(task.name, task.query);
      completed++;
      const progress = ((completed / tasks.length) * 100).toFixed(1);
      if (result.success) {
        console.log(`[${progress}%] ✓ ${task.name}`);
      } else {
        console.log(`[${progress}%] ✗ ${task.name}: ${result.error}`);
      }
      return result;
    },
    CONFIG.concurrency
  );

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n完成！成功: ${successful.length}/${tasks.length}`);

  if (failed.length > 0) {
    console.log(`\n失败的城市 (${failed.length}):`);
    failed.forEach(f => console.log(`  ✗ ${f.city}: ${f.error}`));
  }

  console.log(`\n数据保存在: ${CONFIG.outputDir}`);
};

main().catch(console.error);
