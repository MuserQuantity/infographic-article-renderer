import { ArticleData } from './types';

export const SYSTEM_PROMPT = `你是一台“内容结构化转换引擎”。请把输入的文本（文章、逐字稿或摘要）转换成适用于信息图渲染器的 JSON 结构。
只输出 JSON，不要输出解释或代码块。输出必须以 { 开始，以 } 结束。

输出要求：
1. 严格遵守以下 Schema。
2. 仅允许在文本字段里使用 **粗体** 和 [文本](https://example.com)。
3. 禁止其他 Markdown 语法（#, >, -, *, ```）。
4. 不要编造作者、日期、来源等元信息，缺失就省略。

Schema Definition（保持键名不变）:
{
  "title": "主标题",
  "subtitle": "副标题/摘要",
  "meta": { "author": "作者", "date": "YYYY-MM-DD", "readTime": "阅读时间" },
  "sections": [
    {
      "title": "分节标题",
      "content": [
        { "type": "paragraph", "text": "段落（可含 **重点** 与 [链接](url)）" },
        { "type": "quote", "text": "引用...", "author": "可选" },
        { "type": "list", "title": "可选列表标题", "items": ["Item 1", "Item 2"], "style": "bullet|check|number" },
        { "type": "callout", "variant": "info|warning|success", "text": "提示...", "title": "可选小标题" },
        { "type": "grid", "columns": 2, "items": [ { "title": "卡片1", "description": "描述..." }, { "title": "卡片2", "description": "描述..." } ] },
        { "type": "image", "src": "https://...", "alt": "说明", "caption": "可选图注" },
        { "type": "stat", "columns": 3, "items": [ { "label": "转化率", "value": "61%", "trend": "up|down|flat", "note": "环比 +12%" } ] },
        { "type": "tags", "items": ["对比", "Benchmarks", "安全"] },
        { "type": "timeline", "items": [ { "title": "节点 A", "time": "Day 1", "desc": "说明..." } ] },
        { "type": "comparison", "columns": ["GPT-4o", "Midjourney"], "rows": [ { "label": "文本清晰度", "values": ["优秀", "一般"] } ] },
        { "type": "table", "headers": ["指标", "值"], "rows": [ ["PSNR", "32.1"], ["SSIM", "0.91"] ] },
        { "type": "code", "code": "console.log('hi')", "language": "js" },
        { "type": "accordion", "items": [ { "question": "问题", "answer": "回答" } ] },
        { "type": "steps", "items": [ { "step": 1, "title": "步骤", "description": "说明" } ] },
        { "type": "progress", "items": [ { "label": "完成度", "value": 75, "max": 100 } ] },
        { "type": "highlight", "text": "重点内容", "color": "yellow" },
        { "type": "definition", "items": [ { "term": "术语", "definition": "解释" } ] },
        { "type": "proscons", "pros": ["优点1"], "cons": ["缺点1"] },
        { "type": "video", "src": "https://...", "platform": "youtube", "title": "演示" },
        { "type": "divider", "dividerStyle": "decorated" },
        { "type": "linkcard", "url": "https://example.com", "title": "链接标题", "description": "描述" },
        { "type": "rating", "items": [ { "label": "评分项", "score": 4.5, "maxScore": 5 } ] }
      ]
    }
  ]
}

内容结构与排版规则：
1. 每个 section 建议 2-5 个内容块；段落 1-3 句；列表 3-6 项；时间线 3-6 项；统计/评分 2-4 项
2. 不确定的内容用 paragraph 承载
3. 如果有子标题（如“3.1 xxx”“第一部分：xxx”），独立成新的 section
4. 如果内容包含 URL，优先使用 linkcard 或在文本中使用 [文本](url)
5. 过滤广告、订阅提示、社交媒体引导等非正文内容

请直接输出 JSON，不要包含 Markdown 代码块标记，不要输出任何解释或多余文本。`;


export const SAMPLE_DATA: ArticleData = {
  title: "探索 OpenAI 4o 图像生成：功能、对比与实测",
  subtitle: "快速概览 4o 的可用渠道、核心指标、对比表现与实测流程。",
  meta: {
    author: "AI Research Team",
    date: "2024-05-20",
    readTime: "5 min read"
  },
  sections: [
    {
      "title": "快速概览与指标",
      "content": [
        { "type": "tags", "items": ["对比", "Benchmarks", "图像生成", "速度"] },
        { 
          "type": "stat", 
          "columns": 3, 
          "items": [
            { "label": "生成成功率", "value": "96%", "trend": "up", "note": "复杂场景保持稳定" },
            { "label": "平均延迟", "value": "1.8s", "trend": "flat", "note": "包含上传与解析" },
            { "label": "文字清晰度", "value": "4.7/5", "trend": "up", "note": "对比 MJ/Ideogram" }
          ] 
        },
        { 
          "type": "paragraph",
          "text": "OpenAI 4o 提供统一的多模态能力，文本与图像生成均可在同一模型下完成，接口与 ChatGPT 前端均可访问。"
        },
        {
          "type": "callout",
          "variant": "info",
          "title": "访问渠道",
          "text": "ChatGPT 前端直接选择 GPT-4o；API 侧使用模型标识 `gpt-4o`，Playground 支持上传参考图。"
        }
      ]
    },
    {
      "title": "生成流程与时间线",
      "content": [
        { 
          "type": "timeline", 
          "items": [
            { "title": "提交提示词", "time": "T0", "desc": "上传描述或参考图，设定分辨率与风格。" },
            { "title": "模型生成", "time": "T0 + 2s", "desc": "返回首张图，通常 1~2.5 秒。" },
            { "title": "质量评估", "time": "T0 + 3s", "desc": "检查文字清晰度、构图与角色一致性。" },
            { "title": "二次修订", "time": "T0 + 5s", "desc": "必要时重试或补充负面提示词。" }
          ] 
        },
        { 
          "type": "list",
          "title": "最佳实践",
          "style": "check",
          "items": [
            "先给清晰的主体与场景，再补充风格与光线。",
            "需要文字时，明确字体、位置、语言；避免模糊词。",
            "角色一致性可用“同一人物”“相同穿着”“正脸/侧脸”说明。"
          ]
        },
        { 
          "type": "callout",
          "variant": "warning",
          "text": "高密度文字、扭曲透视、极端光影仍可能出现细节错误，建议小步迭代。"
        }
      ]
    },
    {
      "title": "模型对比与表格",
      "content": [
        { 
          "type": "comparison",
          "columns": ["GPT-4o", "Midjourney", "Ideogram"],
          "rows": [
            { "label": "文字清晰度", "values": ["清晰，英中皆稳", "偶有伪字", "英文较好，中文一般"] },
            { "label": "风格迁移", "values": ["强", "强", "中"] },
            { "label": "角色一致性", "values": ["好", "中", "中"] },
            { "label": "响应速度", "values": ["快", "中", "中"] }
          ]
        },
        { 
          "type": "table",
          "headers": ["指标", "GPT-4o", "Midjourney", "Ideogram"],
          "rows": [
            ["平均延迟 (s)", "1.8", "4.2", "3.8"],
            ["文本匹配得分", "0.91", "0.74", "0.77"],
            ["角色一致性得分", "0.88", "0.70", "0.73"]
          ]
        },
        { 
          "type": "quote",
          "text": "在文字渲染测试中，4o 首次就把招牌字样写对了，没有奇怪的变形或拼写错误。",
          "author": "Testing Benchmark"
        }
      ]
    },
    {
      "title": "案例与视觉效果",
      "content": [
        { 
          "type": "image",
          "src": "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1600&q=80",
          "alt": "示例图",
          "caption": "对标招牌文字清晰度的示例渲染"
        },
        { 
          "type": "grid",
          "columns": 2,
          "items": [
            { "title": "矢量风格", "description": "颜色纯净，适合网页与可视化插画。" },
            { "title": "角色一致性", "description": "多场景保持面部与服饰一致。" }
          ]
        },
        { 
          "type": "paragraph",
          "text": "对于需要文字的图像，4o 在中文与英文上都有较高的可读性；若需要特定字体，可在提示词中明确指定。"
        }
      ]
    }
  ]
};
