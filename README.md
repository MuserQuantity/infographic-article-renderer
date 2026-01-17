# infographic-article-renderer
这是一个基于 Vite + React 的小型前端应用，用于把结构化的 JSON 摘要转成类似科技博客风格的文章式信息图，可本地运行并部署。

## 浏览器插件

本项目包含一个 Chrome 浏览器插件，位于 `chrome-extension` 文件夹中。该插件支持一键将当前页面（或 B 站视频）发送至分析服务生成信息图。更多细节请查看 [chrome-extension/README.md](./chrome-extension/README.md)。

### 安装步骤

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目中的 `chrome-extension` 文件夹

### 使用说明

1. 在文章或视频页面点击浏览器工具栏的插件图标
2. 点击「分析此页面」按钮
3. 系统将自动在新标签页展示分析后的信息图
