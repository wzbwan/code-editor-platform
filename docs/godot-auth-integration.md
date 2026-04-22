# Godot 代码闯关登录对接文档

本文档对应当前项目：

- Web 项目：`/Users/zengbao/workspace/8/code-editor-platform`
- 适用客户端：Godot 宿主应用 + 内嵌 WebView

当前实现目标：

1. 学生在 Godot 原生登录界面输入账号密码
2. Godot 调服务端登录接口，拿到一次性 `launchUrl`
3. Godot 用 WebView 打开该 `launchUrl`
4. 服务端校验一次性交换码，写入与 `NextAuth` 兼容的 session cookie
5. WebView 自动跳转到真正的代码闯关页面

这样 Godot 端不需要直接操作站内 cookie，也不需要把长期身份凭证拼进闯关 URL。

## 1. 已完成的 Web 侧约束

### 1.1 学生网页导航已移除“代码闯关”

学生导航不再展示 `/student/challenges` 入口，教师导航保留。

### 1.2 当前访问策略

当前阶段，代码闯关仍然允许：

- 普通网页登录态访问
- Godot 登录换出的会话访问

也就是说，`clientType = GODOT` 目前只用于区分来源，暂时还不作为强制访问门槛。

后续如果 Godot 端验证稳定，再可以把下面这些页面/接口切换成只允许 Godot 会话访问：

- `GET /student/challenges`
- `GET /student/challenges/:chapterKey`
- `GET /student/challenges/:chapterKey/:levelKey`
- `GET /api/local-runner/session`
- `POST /api/challenges/submit`

### 1.3 Godot 嵌入模式

如果闯关页面 URL 带 `embedded=godot`，站点顶部 `Navbar` 会隐藏，避免和 Godot 宿主顶栏重复。

## 2. 接口总览

本次新增 2 个核心接口：

1. `POST /api/godot/auth/login`
2. `GET /api/godot/auth/exchange`

## 3. 接口详情

### 3.1 Godot 原生登录

`POST /api/godot/auth/login`

用途：

- 在 Godot 原生登录界面校验学生账号密码
- 返回一次性的 `launchUrl`

请求头：

```http
Content-Type: application/json
```

请求体：

```json
{
  "username": "student1",
  "password": "123456",
  "nextPath": "/student/challenges/list-milk-tea?embedded=godot"
}
```

字段说明：

- `username`：学生账号
- `password`：学生密码
- `nextPath`：可选，登录成功后 Godot WebView 最终要进入的站内路径

限制：

- 只允许学生账号
- `nextPath` 只接受 `/student/challenges` 开头的站内路径
- 服务端会自动补上 `embedded=godot`
- 如果 `nextPath` 非法或为空，会回落到：
  `/student/challenges?embedded=godot`

成功响应 `200`：

```json
{
  "launchUrl": "https://your-domain.com/api/godot/auth/exchange?code=xxxxx",
  "expiresAt": "2026-04-21T10:30:00.000Z",
  "targetPath": "/student/challenges/list-milk-tea?embedded=godot",
  "user": {
    "id": "clx123",
    "username": "student1",
    "name": "张三",
    "role": "STUDENT"
  }
}
```

失败响应：

- `400`：用户名或密码为空
- `401`：用户名或密码错误，或不是学生账号

重要说明：

- `launchUrl` 内部带的是一次性短期交换码，不是长期登录 token
- 当前交换码有效期为 `5 分钟`
- 每次登录会清理该学生之前未使用的旧交换码

### 3.2 WebView 会话交换

`GET /api/godot/auth/exchange?code=xxxxx`

用途：

- 由 Godot WebView 直接打开
- 服务端校验交换码
- 写入与 `NextAuth` 兼容的 session cookie
- `302` 跳转到真正的闯关页面

行为：

1. 校验 `code`
2. 校验该交换码是否存在、是否过期、是否已使用
3. 标记该交换码为已使用
4. 写入 `NextAuth` session cookie，`clientType = GODOT`
5. 跳转到 `targetPath`

成功结果：

- 返回 `302 Redirect`
- WebView 最终会进入代码闯关页面

失败结果：

- 返回一个简洁的 HTML 错误页
- 提示“请返回 Godot 重新登录”

## 4. Godot 端推荐对接流程

### 4.1 登录流程

1. 学生在 Godot 原生登录界面输入用户名和密码
2. Godot 调用：

```http
POST /api/godot/auth/login
```

3. 从响应中取出：
   - `launchUrl`
   - `user`
   - `targetPath`
4. Godot 原生 UI 可以立刻显示登录成功的用户信息
5. Godot 用 WebView 打开 `launchUrl`

### 4.2 WebView 启动流程

Godot 不要直接打开 `/student/challenges/...`

而是必须打开：

```text
launchUrl
```

原因：

- `launchUrl` 会先在服务端完成“交换码 -> 站内 session”的转换
- 只有这样，闯关页内部后续的受保护接口才会正常工作

### 4.3 刷新与重新进入

- 在同一次 Godot 会话内，WebView 已经拿到 cookie 后，站内刷新是正常的
- 如果 Godot 清空 WebView cookie，或者重新启动应用，需要重新调用登录接口拿新的 `launchUrl`
- 不要缓存或长期复用旧的 `launchUrl`

## 5. 推荐调用示例

### 5.1 登录时请求某个章节

```json
{
  "username": "student1",
  "password": "123456",
  "nextPath": "/student/challenges/list-milk-tea?embedded=godot"
}
```

### 5.2 登录时请求某个具体关卡

```json
{
  "username": "student1",
  "password": "123456",
  "nextPath": "/student/challenges/list-milk-tea/level-1?embedded=godot"
}
```

## 6. 当前安全边界

1. 不使用长期 token 直出闯关 URL
2. 交换码为一次性、短期有效
3. 交换码只能换出学生会话
4. Godot 会话会写入 `clientType = GODOT`
5. 学生网页导航已移除闯关入口

说明：

- 当前还没有对 `clientType = GODOT` 做强制校验拦截
- 这样可以同时保留网页端和 Godot 端访问闯关，便于联调和灰度测试

## 7. 部署与本地更新

本次改动新增了 Prisma 模型：

- `GodotSessionBootstrap`

部署或本地同步后需要执行：

```bash
npm run db:generate
npm run db:push
```

如果是生产环境，请确保：

- `NEXTAUTH_SECRET` 已正确配置
- `NEXTAUTH_URL` 已正确配置为正式域名

## 8. 对接建议

Godot 端建议把下面两类状态分开：

1. 原生登录状态
   - 用于显示当前学生信息
   - 来源是 `/api/godot/auth/login` 的响应

2. WebView 站内会话
   - 由 `launchUrl` 自动建立
   - 用于访问闯关页面及其内部受保护接口

不要尝试让 Godot 自己伪造站内 cookie，也不要直接把用户名密码注入网页登录表单。
