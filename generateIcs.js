import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const ICS_OUTPUT = path.join(__dirname, 'calendar.ics');

// 生成唯一ID
function generateUID(date, type, index = 0) {
  return `${date}-${type}-${index}@calendar`;
}

// 格式化日期为ICS格式 (YYYYMMDD)
function formatDate(year, month, day) {
  return `${year}${month}${day.padStart(2, '0')}`;
}

// 转义ICS特殊字符
function escapeICS(text) {
  if (!text) return '';
  return text.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
}

// 生成单个事件
function generateEvent(date, summary, description, category, index = 0) {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `BEGIN:VEVENT
UID:${generateUID(date, category, index)}
DTSTAMP:${now}
DTSTART;VALUE=DATE:${date}
DTEND;VALUE=DATE:${date}
SUMMARY:${escapeICS(summary)}
DESCRIPTION:${escapeICS(description)}
CATEGORIES:${category}
TRANSP:TRANSPARENT
END:VEVENT`;
}

// 主要法定节假日关键词（用于识别真正的假期）
const MAJOR_HOLIDAYS = [
  '元旦', '春节', '除夕', '清明', '劳动节', '端午', '中秋', '国庆'
];

// 节日名称映射（统一显示名称）
const HOLIDAY_NAME_MAP = {
  '除夕': '春节'  // 除夕统一显示为春节
};

// 提取主要节日名（只保留法定假日相关名称）
function extractMajorFestival(festivalStr) {
  if (!festivalStr) return null;
  
  // 检查是否包含主要节日
  for (const holiday of MAJOR_HOLIDAYS) {
    if (festivalStr.includes(holiday)) {
      // 应用名称映射
      return HOLIDAY_NAME_MAP[holiday] || holiday;
    }
  }
  
  // 如果没有匹配到主要节日，提取第一个词
  const festivalMatch = festivalStr.match(/^([^\s（(]+)/);
  return festivalMatch ? festivalMatch[1] : null;
}

// 识别休息日组（只包含连续的休息日）
function identifyRestGroups(allDays) {
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < allDays.length; i++) {
    const day = allDays[i];
    
    if (day.dayType === '休') {
      if (!currentGroup) {
        currentGroup = {
          festival: null,
          days: [],
          startIndex: i,
          endIndex: i
        };
      }

      // 如果这一天有节日，尝试提取主要节日名
      if (day.festival) {
        const majorFestival = extractMajorFestival(day.festival);
        if (majorFestival && !currentGroup.festival) {
          currentGroup.festival = majorFestival;
        }
      }

      currentGroup.days.push(day);
      currentGroup.endIndex = i;
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
    }
  }

  // 处理最后一个组
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

// 为补班日找到关联的休息日组
function findAssociatedRestGroup(dayIndex, restGroups) {
  let closestGroup = null;
  let minDistance = Infinity;

  for (const group of restGroups) {
    // 计算到休息日组的距离（补班通常在休息日前后7天内）
    const distanceToStart = Math.abs(dayIndex - group.startIndex);
    const distanceToEnd = Math.abs(dayIndex - group.endIndex);
    const distance = Math.min(distanceToStart, distanceToEnd);

    if (distance < minDistance && distance <= 14) { // 最多14天范围
      minDistance = distance;
      closestGroup = group;
    }
  }

  return closestGroup;
}

// 主函数
function generateICS() {
  const events = [];

  // 读取所有JSON文件
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  // 首先收集所有天的数据，同时带上年月信息
  const allDays = [];
  for (const file of files) {
    const match = file.match(/^(\d{4})-(\d{2})\.json$/);
    if (!match) continue;

    const [, year, month] = match;
    const filePath = path.join(OUTPUT_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const day of data) {
      allDays.push({
        ...day,
        year,
        month,
        dateStr: formatDate(year, month, day.day)
      });
    }
  }

  // 识别休息日组
  const restGroups = identifyRestGroups(allDays);

  // 创建日期到假期信息的映射
  const dayTypeInfoMap = new Map();

  // 处理休息日
  for (const group of restGroups) {
    const festival = group.festival || '调休';
    group.days.forEach((day, index) => {
      dayTypeInfoMap.set(day.dateStr, {
        type: '休',
        festival,
        dayNumber: index + 1,
        totalDays: group.days.length
      });
    });
  }

  // 处理补班日（单独处理，关联到最近的休息日组）
  // 为每个休息日组创建对应的补班日列表
  const workDaysByRestGroup = new Map(); // 按休息日组ID分组

  for (let i = 0; i < allDays.length; i++) {
    const day = allDays[i];
    if (day.dayType === '班') {
      const associatedGroup = findAssociatedRestGroup(i, restGroups);
      
      if (associatedGroup) {
        // 使用休息日组的起始索引作为唯一标识
        const groupId = associatedGroup.startIndex;
        if (!workDaysByRestGroup.has(groupId)) {
          workDaysByRestGroup.set(groupId, {
            festival: associatedGroup.festival || '调休',
            days: []
          });
        }
        workDaysByRestGroup.get(groupId).days.push(day);
      } else {
        // 没有关联的休息日组，单独处理
        dayTypeInfoMap.set(day.dateStr, {
          type: '班',
          festival: '调休',
          dayNumber: 1,
          totalDays: 1
        });
      }
    }
  }

  // 为每个组的补班日设置信息
  for (const [groupId, groupInfo] of workDaysByRestGroup) {
    groupInfo.days.forEach((day, index) => {
      dayTypeInfoMap.set(day.dateStr, {
        type: '班',
        festival: groupInfo.festival,
        dayNumber: index + 1,
        totalDays: groupInfo.days.length
      });
    });
  }

  // 生成事件
  for (const day of allDays) {
    // 添加节日事件（每个节日单独一个事件）
    if (day.festival) {
      const festivals = day.festival.split(/\s+/).filter(Boolean);
      festivals.forEach((festival, index) => {
        events.push(generateEvent(
          day.dateStr,
          festival,
          `农历: ${day.lunar}\n干支: ${day.ganzhi}`,
          '节日',
          index
        ));
      });
    }

    // 添加休息日/工作日标记（带节日名称和天数）
    const dayTypeInfo = dayTypeInfoMap.get(day.dateStr);
    if (dayTypeInfo) {
      let summary;
      if (dayTypeInfo.type === '休') {
        summary = `${dayTypeInfo.festival}休息日 第${dayTypeInfo.dayNumber}天`;
      } else {
        summary = `${dayTypeInfo.festival}补班 第${dayTypeInfo.dayNumber}天`;
      }

      events.push(generateEvent(
        day.dateStr,
        summary,
        `农历: ${day.lunar}`,
        '调休'
      ));
    }
  }

  // 生成ICS文件内容
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Calendar Generator//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:中国日历
X-WR-TIMEZONE:Asia/Shanghai
${events.join('\n')}
END:VCALENDAR`;

  fs.writeFileSync(ICS_OUTPUT, icsContent, 'utf8');
  console.log(`ICS文件已生成: ${ICS_OUTPUT}`);
  console.log(`共生成 ${events.length} 个事件`);
}

generateICS();
