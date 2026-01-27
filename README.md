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
- **标准格式** - 导出 ICS 格式，兼容主流日历应用

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

> 默认采集 1999-2050 年的数据，可在 `main.js` 中修改年份范围。
> 数据保存在 `output/` 目录，按月份存储为 JSON 文件（如 `2026-01.json`）。

### 生成 ICS 文件

```bash
yarn generate-ics
```

生成的 `calendar.ics` 文件包含：
- 节日事件（含农历、干支信息）
- 调休标记（休息日/调休上班）

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
├── main.js              # 主程序入口
├── generateIcs.js       # ICS 日历生成脚本
├── package.json         # 项目配置
├── lib/
│   ├── api.js           # HTTP 请求封装
│   ├── parser.js        # HTML 解析器
│   └── utils.js         # 工具函数
├── output/              # JSON 数据输出目录
│   ├── 2026-01.json
│   ├── 2026-02.json
│   └── ...
└── calendar.ics         # 生成的 ICS 日历文件
```

## 配置说明

在 `main.js` 中可调整以下配置：

```javascript
const CONFIG = {
  concurrency: 10,    // 并发请求数
  retries: 3,         // 失败重试次数
  retryDelay: 1000,   // 重试间隔（毫秒）
};
```

| 配置项 | 默认值 | 说明 |
|:-------|:-------|:-----|
| `concurrency` | 10 | 同时发起的请求数量，建议不超过 20 |
| `retries` | 3 | 请求失败后的重试次数 |
| `retryDelay` | 1000 | 每次重试之间的等待时间（ms） |

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
