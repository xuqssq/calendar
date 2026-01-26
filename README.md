# 中国日历数据爬取工具

从万年历网站爬取中国日历数据，包含农历、节日、宜忌、干支等信息，并支持导出为 ICS 日历格式。

## 功能特性

- 批量爬取指定年份范围的日历数据
- 支持并发请求，可配置并发数
- 自动重试失败请求
- 增量更新，已存在的数据自动跳过
- 导出为标准 ICS 日历格式，可导入各类日历应用

## 数据内容

每日数据包含：

| 字段 | 说明 |
|------|------|
| dayType | 休息日(休)/调休上班(班) |
| title | 日期标题 |
| day | 公历日期 |
| lunar | 农历日期 |
| ganzhi | 干支纪年 |
| festival | 节日 |
| yi | 宜 |
| ji | 忌 |
| details | 详细信息(生肖、星座、节气等) |

## 安装

```bash
yarn install
```

## 使用方法

### 爬取日历数据

```bash
yarn start
```

默认爬取 1999-2050 年的数据，可在 `main.js` 中修改年份范围。

数据保存在 `output/` 目录，按月份存储为 JSON 文件（如 `2026-01.json`）。

### 生成 ICS 日历文件

```bash
yarn generate-ics
```

生成的 `calendar.ics` 文件包含：
- 节日事件（含农历、干支信息）
- 调休标记（休息日/调休上班）

可直接导入 Apple 日历、Google 日历、Outlook 等应用。

## 项目结构

```
calendar/
├── main.js           # 主程序入口
├── generateIcs.js    # ICS 生成脚本
├── lib/
│   ├── api.js        # API 请求模块
│   ├── parser.js     # HTML 解析模块
│   └── utils.js      # 工具函数
├── output/           # 数据输出目录
└── calendar.ics      # 生成的日历文件
```

## 配置

在 `main.js` 中可调整：

```javascript
const CONFIG = {
    concurrency: 10,  // 并发数
    retries: 3,       // 重试次数
    retryDelay: 1000, // 重试延迟(ms)
};
```

## License

MIT
