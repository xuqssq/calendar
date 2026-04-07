import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ 配置 ============
const CONFIG = {
  outputDir: path.join(__dirname, 'output'),
  icsOutput: path.join(__dirname, 'calendar.ics'),
  calendarName: '中国日历',
  timezone: 'Asia/Shanghai',
  maxWorkdayDistance: 14,
  majorHolidays: ['元旦', '春节', '除夕', '清明', '劳动节', '端午', '中秋', '国庆'],
  holidayNameMap: { '除夕': '春节' },
};

const SOLAR_TERMS = new Set([
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
]);

const ALLOWED_FESTIVALS = new Set([
  // 中国常见公历节日
  '元旦', '妇女节', '植树节', '愚人节', '劳动节', '青年节', '儿童节',
  '建党节', '建军节', '教师节', '国庆节', '国庆',
  // 中国常见农历节日
  '除夕', '春节', '元宵节', '元宵', '龙抬头', '端午节', '端午',
  '七夕节', '七夕', '中元节', '中秋节', '中秋', '重阳节', '重阳',
  '寒衣节', '下元节', '腊八节', '腊八', '小年',
  // 常见西方节日
  '情人节', '母亲节', '父亲节', '万圣节', '感恩节', '平安夜', '圣诞节',
]);

// ============ 工具函数 ============
const CATEGORY_ID_MAP = { '节日': 'festival', '调休': 'schedule' };
const generateUID = (date, type, index = 0) => {
  const asciiType = CATEGORY_ID_MAP[type] || type.replace(/[^\x00-\x7F]/g, '');
  return `${date}-${asciiType}-${index}@calendar`;
};
const formatDate = (year, month, day) => `${year}${month}${day.padStart(2, '0')}`;
const escapeICS = (text) => text?.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n') ?? '';
const getTimestamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const getNextDay = (dateStr) => {
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1;
  const day = parseInt(dateStr.slice(6, 8));
  const nextDate = new Date(year, month, day + 1);
  return `${nextDate.getFullYear()}${String(nextDate.getMonth() + 1).padStart(2, '0')}${String(nextDate.getDate()).padStart(2, '0')}`;
};

// 按 RFC 5545 规范折叠长行（每行最多 75 字节）
// 使用 Intl.Segmenter 正确处理 grapheme clusters（包括 emoji）
function foldLine(line) {
  const maxLen = 75;
  if (Buffer.byteLength(line, 'utf8') <= maxLen) return line;

  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  const segments = [...segmenter.segment(line)].map(s => s.segment);

  const result = [];
  let current = '';

  for (const grapheme of segments) {
    const test = current + grapheme;
    if (Buffer.byteLength(test, 'utf8') > maxLen) {
      result.push(current);
      current = ' ' + grapheme; // 续行以空格开头
    } else {
      current = test;
    }
  }
  if (current) result.push(current);

  return result.join('\r\n');
}

// 生成单个事件
function generateEvent(date, summary, description, category, index = 0) {
  return [
    'BEGIN:VEVENT',
    `UID:${generateUID(date, category, index)}`,
    `DTSTAMP:${getTimestamp()}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${getNextDay(date)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `CATEGORIES:${category}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].map(foldLine).join('\r\n');
}

// ============ 节日处理 ============
function extractMajorFestival(festivalStr) {
  if (!festivalStr) return null;
  const displayFestivals = getDisplayFestivals(festivalStr);
  const matched = CONFIG.majorHolidays.find(h => displayFestivals.includes(h));
  if (matched) return CONFIG.holidayNameMap[matched] || matched;
  return displayFestivals[0] ?? null;
}

// ============ 休息日组识别 ============
function identifyRestGroups(allDays) {
  const { result, current } = allDays.reduce((acc, day, i) => {
    if (day.dayType !== '休') {
      if (acc.current) acc.result.push(acc.current);
      return { ...acc, current: null };
    }

    if (!acc.current) {
      acc.current = { festival: null, days: [], startIndex: i, endIndex: i };
    }

    const majorFestival = day.festival && extractMajorFestival(day.festival);
    if (majorFestival && !acc.current.festival) {
      acc.current.festival = majorFestival;
    }

    acc.current.days.push(day);
    acc.current.endIndex = i;
    return acc;
  }, { result: [], current: null });

  return current ? [...result, current] : result;
}

function findAssociatedRestGroup(dayIndex, restGroups) {
  return restGroups.reduce((closest, group) => {
    const distance = Math.min(
      Math.abs(dayIndex - group.startIndex),
      Math.abs(dayIndex - group.endIndex)
    );
    if (distance <= CONFIG.maxWorkdayDistance && distance < (closest?.distance ?? Infinity)) {
      return { group, distance };
    }
    return closest;
  }, null)?.group ?? null;
}

// ============ 数据加载 ============
function loadAllDays() {
  return fs.readdirSync(CONFIG.outputDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .flatMap(file => {
      const match = file.match(/^(\d{4})-(\d{2})\.json$/);
      if (!match) return [];

      const [, year, month] = match;
      const data = JSON.parse(fs.readFileSync(path.join(CONFIG.outputDir, file), 'utf8'));

      return data.map(day => ({
        ...day,
        year,
        month,
        dateStr: formatDate(year, month, day.day),
      }));
    });
}

// ============ 日期类型映射构建 ============
function buildDayTypeInfoMap(allDays, restGroups) {
  const dayTypeInfoMap = new Map();

  // 处理休息日
  for (const group of restGroups) {
    const festival = group.festival || '调休';
    group.days.forEach((day, index) => {
      dayTypeInfoMap.set(day.dateStr, {
        type: '休',
        festival,
        dayNumber: index + 1,
        totalDays: group.days.length,
      });
    });
  }

  // 处理补班日 - 按休息日组分组
  const workDaysByGroup = new Map();

  allDays.forEach((day, i) => {
    if (day.dayType !== '班') return;

    const associatedGroup = findAssociatedRestGroup(i, restGroups);
    if (!associatedGroup) {
      dayTypeInfoMap.set(day.dateStr, {
        type: '班', festival: '调休', dayNumber: 1, totalDays: 1,
      });
      return;
    }

    const groupId = associatedGroup.startIndex;
    if (!workDaysByGroup.has(groupId)) {
      workDaysByGroup.set(groupId, {
        festival: associatedGroup.festival || '调休',
        days: [],
      });
    }
    workDaysByGroup.get(groupId).days.push(day);
  });

  // 设置补班日信息
  for (const { festival, days } of workDaysByGroup.values()) {
    days.forEach((day, index) => {
      dayTypeInfoMap.set(day.dateStr, {
        type: '班',
        festival,
        dayNumber: index + 1,
        totalDays: days.length,
      });
    });
  }

  return dayTypeInfoMap;
}

// ============ 描述生成 ============
function buildDescription(day) {
  const parts = [`[农历] ${day.lunar}`, `[干支] ${day.ganzhi}`];
  if (day.yi?.length) parts.push(`[宜] ${day.yi.join('、')}`);
  if (day.ji?.length) parts.push(`[忌] ${day.ji.join('、')}`);
  return parts.join('\n');
}

// ============ 事件生成 ============
const FESTIVAL_ICONS = {
  '元旦': '🎊', '春节': '🧧', '除夕': '🧨', '清明': '🌿', '劳动节': '👷',
  '端午': '🐲', '中秋': '🥮', '国庆': '🇨🇳', '情人节': '💕', '妇女节': '👩',
  '植树节': '🌲', '愚人节': '🃏', '青年节': '🌟', '儿童节': '🧒', '建党节': '🎖️',
  '建军节': '🎗️', '教师节': '📚', '重阳': '🏔️', '腊八': '🥣', '小年': '🏠',
  '元宵': '🏮', '七夕': '💑', '母亲节': '💐', '父亲节': '👔', '龙抬头': '🐉',
  '中元节': '🪔', '寒衣节': '🧥', '下元节': '🌕', '万圣节': '🎃', '感恩节': '🦃',
  '平安夜': '🔔', '圣诞节': '🎄',
};

function getFestivalIcon(festival) {
  for (const [key, icon] of Object.entries(FESTIVAL_ICONS)) {
    if (festival.includes(key)) return icon;
  }
  return '🎈';
}

function normalizeFestivalName(festival) {
  const name = festival.trim();
  if (!name) return null;

  const solarTerm = name.match(/^([^（(]+)[（(]/)?.[1]?.trim() ?? name;
  if (SOLAR_TERMS.has(solarTerm)) return solarTerm;

  const normalizedMap = {
    '国庆节': '国庆',
    '元宵节': '元宵',
    '端午节': '端午',
    '中秋节': '中秋',
    '重阳节': '重阳',
    '腊八节': '腊八',
    '七夕节': '七夕',
  };

  return normalizedMap[name] || name;
}

function shouldIncludeFestival(festival) {
  if (!festival) return false;
  if (SOLAR_TERMS.has(festival)) return true;
  return ALLOWED_FESTIVALS.has(festival);
}

function getDisplayFestivals(festivalStr) {
  if (!festivalStr) return [];

  const festivals = [];
  const seen = new Set();

  for (const rawFestival of festivalStr.split(/\s+/).filter(Boolean)) {
    const normalizedFestival = normalizeFestivalName(rawFestival);
    if (!shouldIncludeFestival(normalizedFestival) || seen.has(normalizedFestival)) continue;
    seen.add(normalizedFestival);
    festivals.push(normalizedFestival);
  }

  return festivals;
}

function generateFestivalEvents(day) {
  const festivals = getDisplayFestivals(day.festival);
  if (!festivals.length) return [];
  const description = buildDescription(day);
  return festivals.map((festival, index) =>
    generateEvent(day.dateStr, `${getFestivalIcon(festival)} ${festival}`, description, '节日', index)
  );
}

function generateDayTypeEvent(day, info) {
  if (!info) return null;
  const summary = info.type === '休'
    ? `🎉 ${info.festival}休息日 第${info.dayNumber}天`
    : `💼 ${info.festival}补班 第${info.dayNumber}天`;
  const description = buildDescription(day);
  return generateEvent(day.dateStr, summary, description, '调休');
}

// ============ ICS 文件生成 ============
function generateICSContent(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendar Generator//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${CONFIG.calendarName}`,
    `X-WR-TIMEZONE:${CONFIG.timezone}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// ============ 主函数 ============
function generateICS() {
  const allDays = loadAllDays();
  const restGroups = identifyRestGroups(allDays);
  const dayTypeInfoMap = buildDayTypeInfoMap(allDays, restGroups);

  const events = allDays.flatMap(day => [
    ...generateFestivalEvents(day),
    generateDayTypeEvent(day, dayTypeInfoMap.get(day.dateStr)),
  ].filter(Boolean));

  fs.writeFileSync(CONFIG.icsOutput, generateICSContent(events), 'utf8');
  console.log(`ICS文件已生成: ${CONFIG.icsOutput}`);
  console.log(`共生成 ${events.length} 个事件`);
}

generateICS();
