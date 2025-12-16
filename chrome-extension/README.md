# Infographic Article Analyzer - Chrome Extension

一键将当前页面发送到信息图分析网站。

## 安装方法

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `chrome-extension` 文件夹

## 使用方法

1. 在任意文章页面，点击浏览器工具栏中的插件图标
2. 可选择是否「翻译为中文」
3. 点击「分析此页面」按钮
4. 会自动在新标签页打开分析结果

## 设置

点击「设置」可以自定义服务域名：

- **服务域名**: 你的 Infographic Renderer 服务地址
- 默认为: `https://infographic.muserquantity.cn`

## 添加自定义图标（可选）

在 `icons` 文件夹中添加以下尺寸的 PNG 图标：
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

然后修改 `manifest.json` 添加图标配置：

```json
{
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

## 权限说明

- `activeTab`: 获取当前标签页的 URL
- `storage`: 保存用户设置（服务域名等）
