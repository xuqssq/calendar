<div align="center">

# Chinese Calendar Data

**中国日历数据采集工具**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![ICS](https://img.shields.io/badge/Format-ICS-orange)](https://icalendar.org/)

从万年历网站采集中国日历数据，包含农历、节日、宜忌、干支等信息，支持导出为标准 ICS 日历格式。

[快速开始](#快速开始) · [数据格式](#数据格式) · [订阅日历](#订阅日历) · [API 文档](#配置说明)

</div>

---

## 特性

- **批量采集** - 支持指定年份范围的日历数据批量获取
- **高性能** - 并发请求，可配置并发数量
- **稳定可靠** - 自动重试失败请求，保证数据完整性
- **增量更新** - 智能跳过已存在数据，避免重复采集
- **标准格式** - 导出 RFC 5545 标准 ICS 格式，兼容主流日历应用
- **云端上传** - 支持上传至 Cloudflare R2，实现日历订阅
- **天气订阅** - 支持获取中国城市天气 ICS 日历，自动翻译为中文

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- Yarn 或 npm

### 安装依赖

```bash
# 使用 Yarn
yarn install

# 或使用 npm
npm install
```

### 采集数据

```bash
yarn start
```

> 默认采集当前年份前后 10 年的数据（如 2026 年则采集 2016-2036 年），可在 `main.js` 中修改年份范围。
> 数据保存在 `output/` 目录，按月份存储为 JSON 文件（如 `2026-01.json`）。

### 生成 ICS 文件

```bash
yarn generate-ics
```

生成的 `calendar.ics` 文件包含：
- 🎊 节日事件（带节日图标）
- 🎉 休息日标记
- 💼 调休上班标记
- 农历、干支、宜忌信息

### 上传至云端

配置环境变量后，可将日历文件上传至 Cloudflare R2：

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 填入 R2 配置
yarn upload-cf
```

### 获取天气日历

获取中国城市天气数据并生成 ICS 日历文件：

```bash
yarn weather
```

> 天气数据来源于 weather-in-calendar.com，自动翻译为中文。
> 数据保存在 `weather/` 目录，按城市名分目录存储。

## 订阅日历

无需本地运行，直接订阅在线日历：

```
https://cdn.xuqssq.com/calendar.ics
```

**支持的日历应用：**

| 应用 | 订阅方式 |
|:-----|:---------|
| Apple 日历 | 设置 → 日历 → 账户 → 添加账户 → 其他 → 添加已订阅的日历 |
| Google 日历 | 设置 → 添加日历 → 通过 URL 添加 |
| Outlook | 添加日历 → 从 Internet 订阅 |

## 数据格式

每日数据包含以下字段：

| 字段 | 类型 | 说明 | 示例 |
|:-----|:-----|:-----|:-----|
| `dayType` | string | 日期类型 | `休`（休息日）/ `班`（调休上班） |
| `title` | string | 日期标题 | `2026年1月1日` |
| `day` | string | 公历日期 | `2026-01-01` |
| `lunar` | string | 农历日期 | `腊月十二` |
| `ganzhi` | string | 干支纪年 | `乙巳年 戊子月 甲寅日` |
| `festival` | string | 节日名称 | `元旦` |
| `yi` | array | 宜事项 | `["祭祀", "祈福"]` |
| `ji` | array | 忌事项 | `["动土", "安葬"]` |
| `details` | object | 详细信息 | 生肖、星座、节气等 |

<details>
<summary>查看完整数据示例</summary>

```json
{
  "dayType": "休",
  "title": "2026年1月1日",
  "day": "2026-01-01",
  "lunar": "腊月十二",
  "ganzhi": "乙巳年 戊子月 甲寅日",
  "festival": "元旦",
  "yi": ["祭祀", "祈福", "求嗣"],
  "ji": ["动土", "安葬", "开市"],
  "details": {
    "zodiac": "蛇",
    "constellation": "摩羯座",
    "solarTerm": null
  }
}
```

</details>

## 项目结构

```
calendar/
├── main.js              # 数据采集主程序
├── generateIcs.js       # ICS 日历生成脚本
├── weather.js           # 天气日历获取脚本
├── uploadToCF.js        # 上传至 Cloudflare R2
├── package.json         # 项目配置
├── .env.example         # 环境变量模板
├── lib/
│   ├── api.js           # API 请求封装
│   ├── parser.js        # HTML 解析器
│   ├── utils.js         # 工具函数
│   └── uploadToR2.js    # R2 上传工具库
├── output/              # JSON 数据输出目录
│   ├── 2026-01.json
│   └── ...
├── weather/             # 天气 ICS 输出目录
│   ├── beijing/
│   │   └── beijing.ics
│   └── ...
└── calendar.ics         # 生成的 ICS 日历文件
```

## 环境变量

上传功能需要配置以下环境变量（在 `.env` 文件中）：

| 变量 | 必填 | 说明 |
|:-----|:-----|:-----|
| `CF_ACCESS_KEY_ID` | ✓ | Cloudflare R2 Access Key ID |
| `CF_ACCESS_SECRET` | ✓ | Cloudflare R2 Secret Access Key |
| `CF_ENDPOINT` | ✓ | R2 Endpoint URL |
| `CF_BUCKET` | ✓ | 存储桶名称 |
| `CF_PUBLIC_ACCESS_URL` | | 公开访问 URL 前缀 |

## 配置说明

### 数据采集配置

在 `main.js` 中可调整以下配置：

```javascript
const CONFIG = {
  concurrency: 10,    // 并发请求数
  retries: 3,         // 失败重试次数
  retryDelay: 1000,   // 重试间隔（毫秒）
};
```

| 配置项 | 默认值 | 说明 |
|:-------|:-------|:--------|
| `concurrency` | 10 | 同时发起的请求数量，建议不超过 20 |
| `retries` | 3 | 请求失败后的重试次数 |
| `retryDelay` | 1000 | 每次重试之间的等待时间（ms） |

### 天气获取配置

在 `weather.js` 中可调整以下配置：

```javascript
const CONFIG = {
  baseUrl: 'https://weather-in-calendar.com/cal/weather-cal.php',
  outputDir: path.join(__dirname, 'weather'),
  concurrency: 5,    // 并发请求数
  retries: 3,        // 失败重试次数
  retryDelay: 2000,  // 重试间隔（毫秒）
};
```

**支持的城市：**

脚本内置 80+ 个中国主要城市，包括：

- 直辖市：北京、上海、天津、重庆
- 省会城市：广州、杭州、南京、武汉、成都等
- 其他城市：苏州、深圳、青岛、大连等

如需添加城市，修改 `CITIES` 数组即可。对于同名城市（如苏州），可在 `SPECIAL_CITIES` 中指定省份：

```javascript
const SPECIAL_CITIES = [
  { name: 'suzhoujs', query: 'suzhou,js,cn' },  // 江苏苏州
];
```

**天气翻译：**

脚本自动将英文天气描述翻译为中文：

- 天气状况：Overcast clouds → 多云，Light rain → 小雨
- 风向：from N → 北，from SE → 东南

### 上传工具库

`lib/uploadToR2.js` 提供可复用的上传函数：

```javascript
import { uploadToR2 } from './lib/uploadToR2.js';

await uploadToR2({
  accessKeyId: 'xxx',
  secretAccessKey: 'xxx',
  endpoint: 'https://xxx.r2.cloudflarestorage.com',
  bucket: 'my-bucket',
  localFile: './file.txt',
  remoteKey: 'path/to/file.txt',
  contentType: 'text/plain',
  publicUrl: 'https://cdn.example.com',  // 可选
  onProgress: (loaded, total) => {},     // 可选，进度回调
  silent: false,                          // 可选，静默模式
});
```

## 常见问题

<details>
<summary>如何修改采集的年份范围？</summary>

编辑 `main.js` 文件，修改 `startYear` 和 `endYear` 变量。

</details>

<details>
<summary>采集速度太慢怎么办？</summary>

可以适当增加 `concurrency` 配置值，但不建议设置过高以避免被限流。

</details>

<details>
<summary>数据采集中断了怎么办？</summary>

直接重新运行 `yarn start`，程序会自动跳过已采集的月份，继续采集未完成的数据。

</details>

## License

本项目基于 [MIT License](LICENSE) 开源。

---

<div align="center">

**如果这个项目对你有帮助，欢迎 Star 支持！**

</div>
