import { ArticleData } from './types';

export const SYSTEM_PROMPT = `你是一台“内容结构化转换引擎”。请把输入的文本（文章、逐字稿或摘要）转换成适用于信息图渲染器的 JSON 结构。

**输出要求：**
1. 只返回合法 JSON，不能包含 Markdown 代码块符号(\`\`\`)。
2. 严格遵守以下 Schema。

**Schema Definition（保持键名不变）:**
{
  "title": "主标题",
  "subtitle": "副标题/摘要",
  "meta": { "author": "作者", "date": "YYYY-MM-DD" },
  "sections": [
    {
      "title": "分节标题（自动编号）",
      "content": [
        { "type": "paragraph", "text": "段落..." },
        { "type": "quote", "text": "引用...", "author": "可选" },
        { "type": "list", "title": "可选列表标题", "items": ["Item 1", "Item 2"], "style": "bullet|check|number" },
        { "type": "callout", "variant": "info|warning|success", "text": "提示...", "title": "可选小标题" },
        { "type": "grid", "columns": 2, "items": [ { "title": "卡片1", "description": "描述..." }, { "title": "卡片2", "description": "描述..." } ] },
        { "type": "image", "src": "https://...", "alt": "说明", "caption": "可选图注" },
        { "type": "stat", "columns": 3, "items": [ { "label": "转化率", "value": "61%", "trend": "up|down|flat", "note": "环比 +12%" } ] },
        { "type": "tags", "items": ["对比", "Benchmarks", "安全"] },
        { "type": "timeline", "items": [ { "title": "节点 A", "time": "Day 1", "desc": "说明..." } ] },
        { "type": "comparison", "columns": ["GPT-4o", "Midjourney"], "rows": [ { "label": "文本清晰度", "values": ["优秀", "一般"] } ] },
        { "type": "table", "headers": ["指标", "值"], "rows": [ ["PSNR", "32.1"], ["SSIM", "0.91"] ] }
      ]
    }
  ]
}

**排版建议：**
- 关键结论/金句用 'quote'，作者会显示在右下。
- 技术说明/警告用 'callout'，variant 选 info|warning|success。
- 对比/分栏内容用 'grid'；表格式对比用 'comparison'；一般表格用 'table'。
- 普通要点用 'list'（bullet/check/number）。
- KPI 数据用 'stat'；标签云/主题词用 'tags'。
- 时间线/流程用 'timeline'。
- 图片用 'image'，可附 caption。`;

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
