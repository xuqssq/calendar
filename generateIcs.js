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

// ============ 工具函数 ============
const generateUID = (date, type, index = 0) => `${date}-${type}-${index}@calendar`;
const formatDate = (year, month, day) => `${year}${month}${day.padStart(2, '0')}`;
const escapeICS = (text) => text?.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n') ?? '';
const getTimestamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

// 生成单个事件
function generateEvent(date, summary, description, category, index = 0) {
  return [
    'BEGIN:VEVENT',
    `UID:${generateUID(date, category, index)}`,
    `DTSTAMP:${getTimestamp()}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `CATEGORIES:${category}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\n');
}

// ============ 节日处理 ============
function extractMajorFestival(festivalStr) {
  if (!festivalStr) return null;
  const matched = CONFIG.majorHolidays.find(h => festivalStr.includes(h));
  if (matched) return CONFIG.holidayNameMap[matched] || matched;
  return festivalStr.match(/^([^\s（(]+)/)?.[1] ?? null;
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

// ============ 事件生成 ============
function generateFestivalEvents(day) {
  if (!day.festival) return [];
  return day.festival.split(/\s+/).filter(Boolean).map((festival, index) =>
    generateEvent(day.dateStr, festival, `农历: ${day.lunar}\n干支: ${day.ganzhi}`, '节日', index)
  );
}

function generateDayTypeEvent(day, info) {
  if (!info) return null;
  const summary = info.type === '休'
    ? `${info.festival}休息日 第${info.dayNumber}天`
    : `${info.festival}补班 第${info.dayNumber}天`;
  return generateEvent(day.dateStr, summary, `农历: ${day.lunar}`, '调休');
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
  ].join('\n');
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
