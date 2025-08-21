BUG终结智创营 — 前端静态站点说明

概述
----
这是一个用于班级知识共享的前端静态站点（客户端实现）。主要目标是提供：

- 轮播图（班级相册展示）
- 登录/登出（基于 `passwords.csv` 的本地账户表）
- 知识共享库（文档列表、查看、编辑、点赞、删除）
- 富文本 Markdown 编辑（Typora 风格的原位渲染）
- 公式支持（KaTeX）与代码语法高亮（highlight.js）

项目结构（重要文件）
-------------------
- `web/index.html` — 页面入口（包含 CDNs、轮播图片列表 `window.CAROUSEL_PHOTOS`）
- `web/styles.css` — 页面样式（布局、轮播、编辑器样式）
- `web/app.js` — 前端逻辑（CSV 加载、身份认证、文档 CRUD、编辑器、轮播）
- `web/passwords.csv` — 用户表（学号/姓名/密码）
- `web/class_photos/` — 轮播图片目录

主要功能清单
-----------
- 登录/登出：使用 `passwords.csv` 中的账号进行本地登录（客户端验证）。
- 文档库：文档保存在浏览器 `localStorage`，每篇文档包含标题、正文、作者、时间、点赞数等。
- 编辑器：基于 CodeMirror 的 Markdown 编辑器，支持语法高亮；实现 Typora 风格的“原位渲染”overlay（输入时实时渲染，点击 overlay 回到编辑）。
- Markdown 渲染：使用 `marked` 解析 Markdown，使用 `DOMPurify` 进行清理后插入 DOM。
- 公式渲染：使用 KaTeX（`renderMathInElement`）渲染 `$$...$$` 与行内数学。
- 代码高亮：使用 highlight.js 在渲染后高亮代码块。
- 轮播图：页面顶部轮播，图片来自 `web/class_photos/`，支持上一张/下一张与自动轮播，保证整图可见并在窗口缩放时对齐。

本地运行
---------------
通过 HTTP 服务打开页面（直接用 file:// 会导致 fetch 跨域问题）。推荐用 Python 内置的简单服务器：

在 PowerShell 中运行：

```powershell
cd d:\class_website\web; python -m http.server 8000
```

然后在浏览器打开：

http://localhost:8000

## 线上运行

本项目已上传至阿里云，注册域名为[classbcxhzcwl.top](http://classbcxhzcwl.top/)

目前暂未添加后台服务器代码，所以在网站上做的修改不会同步

账户与 `passwords.csv`（编码注意）
--------------------------------
- `passwords.csv` 存放格式为：学号,姓名,密码（第一行为表头可省略）。
- 如果 CSV 中中文出现乱码，请确保文件是 UTF-8 编码；Windows 上常见为 GBK/GB18030，浏览器端的 `TextDecoder` 对某些编码支持不一。可以使用 PowerShell 将文件转换为 UTF-8：

```powershell
# 在 d:\class_website\web 执行（覆盖原文件前请备份）
Get-Content passwords.csv | Out-File -FilePath passwords.utf8.csv -Encoding utf8
```

然后替换或备份原文件为 UTF-8 编码版本。

使用说明（快速）
----------------
- 打开页面后，顶部可以点击 “登录” 输入学号/密码。
- 登录后，右侧显示编辑器面板（新建/保存/编辑/删除），左侧为文档列表。
- 在编辑器中输入 Markdown，编辑器会在输入后约 700ms 在原位（overlay）显示渲染效果；点击 overlay 回到编辑。
- 使用 `$$ ... $$` 可以书写公式（KaTeX 会渲染）；代码块会自动高亮。
- 文档保存到浏览器 `localStorage`，不依赖服务器端存储。

调试与常见问题
----------------
- 若看不到编辑器可输入内容：尝试点击编辑区令 CodeMirror 获得焦点，或刷新页面；如果仍不可输入，打开浏览器控制台查看错误并粘贴给开发者。
- 如果轮播图无法显示或显示异常：检查 `web/class_photos/` 是否包含在 `window.CAROUSEL_PHOTOS` 列表中的文件名，并在浏览器 Network/Console 面板查看图片加载错误。
- 如果 `passwords.csv` 加载失败或账号无法登录，请检查控制台是否有 `Failed to load passwords.csv` 或解码警告，必要时将 CSV 转为 UTF-8。
- 若想清空本地保存的文档，可在浏览器控制台运行：

```javascript
localStorage.removeItem('docs');
location.reload();
```

安全与限制
------------
- 当前实现为纯客户端演示：所有数据保存在用户浏览器，不适合生产环境或多人实时协作。
- 为减少 XSS 风险，渲染前使用了 `DOMPurify` 清理 HTML，但仍建议不要在公开场景接受不受信任的 HTML 输入。

下一步建议（可选）
------------------
- 将用户与文档同步到后端（Express/Node 或其他），支持多人共享与权限控制。
- 支持本地离线缓存或导出/导入 Markdown 文件。
- 增加编辑器功能：侧边目录（TOC）、版本历史、图片上传。

已实现关键文件/位置参考
-----------------------
- `web/index.html` — 页面布局与 CDN 引入
- `web/styles.css` — 样式调整（轮播、两列布局、编辑器）
- `web/app.js` — CSV 加载、编辑器初始化（CodeMirror）、Typora 原位渲染、轮播逻辑

