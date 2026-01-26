import * as cheerio from 'cheerio';

export const parseCalendarHtml = (html) => {
    const $ = cheerio.load(html);
    const days = [];

    // 先解析日历格子，获取休假/上班信息
    const dayTypes = {};
    $('.wnrl_riqi').each((_, element) => {
        const $day = $(element);
        const $link = $day.find('a');
        const id = $link.attr('id')?.replace('wnrl_riqi_id_', '');
        if (!id) return;

        // 判断日期类型
        if ($link.hasClass('wnrl_riqi_xiu')) {
            dayTypes[id] = '休';  // 休息日/假期
        } else if ($link.hasClass('wnrl_riqi_ban')) {
            dayTypes[id] = '班';  // 调休上班
        }
    });

    // 遍历每一天的详细信息
    $('[id^="wnrl_k_you_id_"]').each((_, element) => {
        const $detail = $(element);
        const id = $detail.attr('id').replace('wnrl_k_you_id_', '');
        const dayData = { index: parseInt(id) };

        // 休假/上班类型
        if (dayTypes[id]) {
            dayData.dayType = dayTypes[id];
        }

        // 标题信息 (如: 2026年 01月 (大) 星期四)
        const titleText = $detail.find('.wnrl_k_you_id_biaoti').text().trim();
        dayData.title = titleText;

        // 公历日期
        const dateNum = $detail.find('.wnrl_k_you_id_wnrl_riqi').text().trim();
        dayData.day = dateNum;

        // 农历日期
        const lunarText = $detail.find('.wnrl_k_you_id_wnrl_nongli').text().trim();
        dayData.lunar = lunarText;

        // 干支纪年
        const ganzhi = $detail.find('.wnrl_k_you_id_wnrl_nongli_ganzhi').text().trim();
        dayData.ganzhi = ganzhi;

        // 节日
        const festival = $detail.find('.wnrl_k_you_id_wnrl_jieri_neirong').text().trim();
        if (festival) {
            dayData.festival = festival;
        }

        // 宜
        const yi = $detail.find('.wnrl_k_you_id_wnrl_yi_neirong').text().trim();
        if (yi) {
            dayData.yi = yi.split(/\s+/).filter(Boolean);
        }

        // 忌
        const ji = $detail.find('.wnrl_k_you_id_wnrl_ji_neirong').text().trim();
        if (ji) {
            dayData.ji = ji.split(/\s+/).filter(Boolean);
        }

        days.push(dayData);
    });

    // 解析底部详细信息
    $('[id^="wnrl_k_xia_id_"]').each((_, element) => {
        const $xia = $(element);
        const id = $xia.attr('id').replace('wnrl_k_xia_id_', '');
        const dayIndex = parseInt(id);
        const dayData = days.find(d => d.index === dayIndex);
        if (!dayData) return;

        dayData.details = {};
        $xia.find('.wnrl_k_xia_nr_wnrl_beizhu').each((_, el) => {
            const $item = $(el);
            const key = $item.find('.wnrl_k_xia_nr_wnrl_beizhu_biaoti').text().trim();
            const value = $item.find('.wnrl_k_xia_nr_wnrl_beizhu_neirong').text().trim();
            if (key && value) {
                dayData.details[key] = value;
            }
        });
    });

    // 按index排序并移除index字段
    days.sort((a, b) => a.index - b.index);
    days.forEach(d => delete d.index);

    return days;
};
