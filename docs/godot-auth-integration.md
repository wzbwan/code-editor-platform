# Godot WebView 代码闯关登录停用说明

本文档记录旧版 Godot WebView 代码闯关方案的当前状态。

## 当前策略

代码闯关只允许通过 Godot 原生客户端访问，不再允许通过网页端或 Godot 内嵌 WebView 访问。

保留并继续使用的接口是：

- `POST /api/godot/challenges/login`
- `GET /api/godot/challenges/me`
- `GET /api/godot/challenges/home`
- `GET /api/godot/challenges/chapters/{chapterKey}`
- `GET /api/godot/challenges/chapters/{chapterKey}/levels/{levelKey}`
- `POST /api/godot/challenges/submit`

这些接口使用 `Authorization: Bearer <accessToken>` 鉴权，详见 `docs/godot-challenges-api.md`。

## 已停用的 WebView 入口

以下旧接口已停用：

- `POST /api/godot/auth/login`
- `GET /api/godot/auth/exchange`

当前行为：

- `POST /api/godot/auth/login` 返回 `410 Gone`
- `GET /api/godot/auth/exchange` 返回 `410 Gone`
- 不再签发 `launchUrl`
- 不再写入 `clientType = GODOT` 的 NextAuth cookie
- 旧的交换码即使仍在数据库中，也无法再换出 WebView 会话

## Web 页面访问限制

以下学生 Web 页面不再提供闯关内容：

- `GET /student/challenges`
- `GET /student/challenges/{chapterKey}`
- `GET /student/challenges/{chapterKey}/{levelKey}`

这些页面统一返回 404。学生导航栏也不再展示“代码闯关”入口。

旧的 cookie 版提交接口也已停用：

- `POST /api/challenges/submit` 返回 `403 Forbidden`

## Godot 客户端迁移要求

Godot 端不要再打开 WebView `launchUrl`，也不要直接打开 `/student/challenges` 页面。

推荐流程：

1. 使用 `POST /api/godot/challenges/login` 登录，获得 `accessToken`。
2. 后续请求都带 `Authorization: Bearer <accessToken>`。
3. 使用原生 Godot UI 展示章节、关卡、代码编辑器和判题结果。
4. 通过 `POST /api/godot/challenges/submit` 提交代码和 local-runner 执行结果。
