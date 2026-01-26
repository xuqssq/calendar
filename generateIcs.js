import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const ICS_OUTPUT = path.join(__dirname, 'calendar.ics');

// 生成唯一ID
function generateUID(date, type) {
  return `${date}-${type}@calendar`;
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
function generateEvent(date, summary, description, category) {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `BEGIN:VEVENT
UID:${generateUID(date, category)}
DTSTAMP:${now}
DTSTART;VALUE=DATE:${date}
DTEND;VALUE=DATE:${date}
SUMMARY:${escapeICS(summary)}
DESCRIPTION:${escapeICS(description)}
CATEGORIES:${category}
TRANSP:TRANSPARENT
END:VEVENT`;
}

// 主函数
function generateICS() {
  const events = [];

  // 读取所有JSON文件
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    const match = file.match(/^(\d{4})-(\d{2})\.json$/);
    if (!match) continue;

    const [, year, month] = match;
    const filePath = path.join(OUTPUT_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const day of data) {
      const dateStr = formatDate(year, month, day.day);

      // 添加节日事件
      if (day.festival) {
        events.push(generateEvent(
          dateStr,
          day.festival,
          `农历: ${day.lunar}\n干支: ${day.ganzhi}`,
          '节日'
        ));
      }

      // 添加休息日/工作日标记
      if (day.dayType) {
        const summary = day.dayType === '休' ? '休息日' : '调休上班';
        const desc = day.festival ? `${day.festival}相关` : '';
        events.push(generateEvent(
          dateStr,
          summary,
          desc,
          '调休'
        ));
      }
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
