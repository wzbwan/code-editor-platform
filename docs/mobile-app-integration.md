# 手机端教师巡课 App 对接文档

本文档对应当前项目 `/Users/zengbao/workspace/8/code-editor-platform` 的实际后端能力。  
按本文档开发后，手机 App 可完成以下功能：

1. 教师账号登录
2. 学生列表
3. 按姓名、音序、用户名、学号后三位快速检索
4. 快速加分 / 扣分

## 1. 目标用户与使用场景

- 使用者：教师
- 使用设备：手机 App
- 典型流程：
  1. 教师输入账号密码登录
  2. App 拉取学生列表
  3. 教师通过音序或学号后三位快速定位学生
  4. 教师快速给学生加分 / 扣分
  5. App 显示最新积分结果

## 2. 接口基础信息

- Base URL：`https://你的域名`
- 所有手机端接口统一前缀：`/api/mobile`
- 数据格式：`application/json`
- 时区：服务端按 ISO 8601 时间字符串解析，例如 `2026-03-10T09:15:00+08:00`

## 3. 鉴权机制

### 3.1 登录方式

手机 App 使用教师账号密码登录：

- 登录接口校验数据库中的教师账号
- 登录成功后返回一个 Bearer Token
- App 之后调用所有手机端接口时，都要带上：

```http
Authorization: Bearer <token>
```

### 3.2 Token 说明

当前实现是“服务端固定 Token + 教师账号密码登录校验”模式，适合你现在单教师、约 200 个学生的场景。

- Token 来源：环境变量 `MOBILE_API_TOKEN`
- App 登录成功后保存该 Token
- 退出登录：App 本地删除 Token 即可
- 服务端若要强制所有设备重新登录：修改 `MOBILE_API_TOKEN`

### 3.3 服务端必备环境变量

部署时请配置：

```bash
MOBILE_API_TOKEN=your-mobile-api-token
MOBILE_API_OPERATOR_USERNAME=teacher
MOBILE_API_OPERATOR_LABEL=巡课App
```

说明：

- `MOBILE_API_TOKEN`：手机端 Bearer Token
- `MOBILE_API_OPERATOR_USERNAME`：积分流水默认操作教师账号
- `MOBILE_API_OPERATOR_LABEL`：当未绑定教师用户名时，流水中展示的操作来源名称

## 4. 推荐 App 页面结构

建议最少包含以下页面：

### 4.1 登录页

字段：

- 用户名
- 密码

操作：

- 点击登录
- 登录成功后进入学生列表页
- 登录失败显示错误提示

### 4.2 学生列表页

展示字段：

- 姓名
- 用户名 / 学号
- 当前积分

支持：

- 下拉刷新
- 搜索框
- 每个学生的快捷加减分按钮

### 4.3 加减分弹窗 / 底部面板

建议交互：

- 快捷按钮：`+1`、`+2`、`-1`
- 自定义分值输入
- 理由输入框
- 确认提交

## 5. 业务规则

### 5.1 学生检索规则

后端已支持以下检索方式：

- 按姓名检索，例如：`张三`
- 按音序检索，例如：`zs`
- 按用户名检索，例如：`24E123`
- 按用户名后三位检索，例如：`123`

### 5.2 加减分规则

- `delta > 0` 表示加分
- `delta < 0` 表示扣分
- `delta = 0` 不允许提交
- `reason` 必填
- `occurredAt` 可选；不传时服务端自动使用当前时间

### 5.3 学生积分

学生表中维护累计积分 `pointBalance`，每次加减分后都会同步返回最新积分。

## 6. 接口清单

共 4 个核心接口：

1. `POST /api/mobile/auth/login`
2. `GET /api/mobile/auth/me`
3. `GET /api/mobile/students`
4. `POST /api/mobile/points`

---

## 7. 登录接口

### 7.1 教师登录

`POST /api/mobile/auth/login`

请求头：

```http
Content-Type: application/json
```

请求体：

```json
{
  "username": "teacher",
  "password": "123456"
}
```

成功响应 `200`：

```json
{
  "token": "your-mobile-api-token",
  "tokenType": "Bearer",
  "teacher": {
    "id": "clx123",
    "username": "teacher",
    "name": "教师账号",
    "role": "TEACHER"
  }
}
```

失败响应：

- `400`：用户名或密码为空
- `401`：用户名或密码错误，或不是教师账号
- `503`：服务端未配置 `MOBILE_API_TOKEN`

App 处理建议：

- 登录成功后保存 `token`
- 同时保存 `teacher` 信息用于首页展示

---

## 8. 获取当前教师信息

### 8.1 校验 Token 并获取教师资料

`GET /api/mobile/auth/me`

请求头：

```http
Authorization: Bearer your-mobile-api-token
```

成功响应 `200`：

```json
{
  "teacher": {
    "id": "clx123",
    "username": "teacher",
    "name": "教师账号",
    "role": "TEACHER"
  }
}
```

使用场景：

- App 启动时验证本地 token 是否仍有效
- 自动登录恢复

失败响应：

- `401`：Token 无效
- `404`：绑定的教师账号不存在

---

## 9. 学生列表与检索接口

### 9.1 获取学生列表

`GET /api/mobile/students`

请求头：

```http
Authorization: Bearer your-mobile-api-token
```

成功响应 `200`：

```json
{
  "students": [
    {
      "id": "clxstu001",
      "name": "张三",
      "username": "24E123",
      "pointBalance": 6
    },
    {
      "id": "clxstu002",
      "name": "李四",
      "username": "24E124",
      "pointBalance": 2
    }
  ]
}
```

说明：

- 当不传 `query` 时，返回按用户名升序排序的学生列表
- 当前最多返回前 20 条匹配结果
- 如果你后面想做分页，再单独扩展

### 9.2 学生快速检索

`GET /api/mobile/students?query=zs`

支持的 `query` 示例：

- `张三`
- `zs`
- `24E123`
- `123`

示例请求：

```http
GET /api/mobile/students?query=123
Authorization: Bearer your-mobile-api-token
```

示例响应：

```json
{
  "students": [
    {
      "id": "clxstu001",
      "name": "张三",
      "username": "24E123",
      "pointBalance": 6
    }
  ]
}
```

App 交互建议：

- 搜索框输入时做 `300ms` 防抖
- 输入为空时直接拉全列表
- 每次搜索直接调用该接口，不需要在 App 端自己实现拼音检索算法

---

## 10. 加分 / 扣分接口

### 10.1 提交积分变更

`POST /api/mobile/points`

请求头：

```http
Authorization: Bearer your-mobile-api-token
Content-Type: application/json
```

请求体：

```json
{
  "username": "24E123",
  "delta": 2,
  "reason": "课堂练习表现积极",
  "occurredAt": "2026-03-10T09:15:00+08:00"
}
```

字段说明：

- `username`：学生用户名 / 学号
- `delta`：整数，正数加分，负数扣分
- `reason`：原因，必填
- `occurredAt`：操作发生时间，可选

成功响应 `200`：

```json
{
  "student": {
    "id": "clxstu001",
    "name": "张三",
    "username": "24E123",
    "pointBalance": 8
  },
  "record": {
    "id": "clr001",
    "studentId": "clxstu001",
    "studentUsername": "24E123",
    "operatorLabel": "教师账号",
    "delta": 2,
    "reason": "课堂练习表现积极",
    "occurredAt": "2026-03-10T01:15:00.000Z",
    "source": "MOBILE_API",
    "createdAt": "2026-03-10T01:15:02.000Z",
    "student": {
      "name": "张三",
      "username": "24E123"
    },
    "operator": {
      "name": "教师账号",
      "username": "teacher"
    }
  }
}
```

失败响应：

- `400`：参数不合法，例如分值为 0、理由为空、学生不存在
- `401`：未授权

App 处理建议：

- 提交成功后，用响应里的 `student.pointBalance` 直接刷新当前学生积分
- 可在页面顶部显示 “张三 +2 分”

---

## 11. 推荐的 App 端数据模型

建议按以下模型实现：

### 11.1 Teacher

```ts
type Teacher = {
  id: string | null
  username: string | null
  name: string | null
  role: 'TEACHER'
}
```

### 11.2 Student

```ts
type Student = {
  id: string
  name: string
  username: string
  pointBalance: number
}
```

### 11.3 PointRecord

```ts
type PointRecord = {
  id: string
  studentId: string
  studentUsername: string
  operatorLabel: string | null
  delta: number
  reason: string
  occurredAt: string
  source: 'MOBILE_API' | 'WEB'
  createdAt: string
  student: {
    name: string
    username: string
  }
  operator: {
    name: string
    username: string
  } | null
}
```

## 12. 推荐的前端交互流程

### 12.1 登录流程

1. 用户输入用户名和密码
2. 调用 `POST /api/mobile/auth/login`
3. 保存 `token` 和 `teacher`
4. 进入学生列表页

### 12.2 自动登录流程

1. App 启动时读取本地 `token`
2. 调用 `GET /api/mobile/auth/me`
3. 若成功，进入学生列表页
4. 若失败，清空 token 并跳回登录页

### 12.3 搜索流程

1. 用户在搜索框输入内容
2. 前端做短暂防抖
3. 调用 `GET /api/mobile/students?query=...`
4. 刷新列表

### 12.4 快速加减分流程

1. 教师点击某个学生旁边的 `+1` / `+2` / `-1`
2. 弹出理由输入框
3. 调用 `POST /api/mobile/points`
4. 用返回的 `student.pointBalance` 更新列表对应行
5. 给出成功提示

## 13. 推荐的错误提示文案

- 登录失败：`用户名或密码错误`
- Token 失效：`登录状态已失效，请重新登录`
- 学生不存在：`未找到该学生`
- 理由为空：`请填写加分或扣分理由`
- 网络异常：`网络连接失败，请稍后重试`

## 14. cURL 调试示例

### 14.1 登录

```bash
curl -X POST 'https://你的域名/api/mobile/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "teacher",
    "password": "123456"
  }'
```

### 14.2 获取学生列表

```bash
curl 'https://你的域名/api/mobile/students' \
  -H 'Authorization: Bearer your-mobile-api-token'
```

### 14.3 搜索学生

```bash
curl 'https://你的域名/api/mobile/students?query=123' \
  -H 'Authorization: Bearer your-mobile-api-token'
```

### 14.4 加分

```bash
curl -X POST 'https://你的域名/api/mobile/points' \
  -H 'Authorization: Bearer your-mobile-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "24E123",
    "delta": 2,
    "reason": "课堂练习表现积极"
  }'
```

### 14.5 扣分

```bash
curl -X POST 'https://你的域名/api/mobile/points' \
  -H 'Authorization: Bearer your-mobile-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "24E123",
    "delta": -1,
    "reason": "上课分心"
  }'
```

## 15. 开发建议

如果你要做一个轻量教师巡课 App，建议第一版页面顺序就是：

1. 登录页
2. 学生列表页
3. 搜索框
4. 每行显示：
   - 姓名
   - 学号
   - 当前积分
   - `+1`
   - `+2`
   - `-1`
   - 自定义

这样第一版就已经具备你当前最核心的巡课能力。

## 16. 当前接口边界

当前手机端接口已经足够支撑第一版 App，但有几个边界要知道：

- 当前 Token 是固定值，不是每次登录动态签发
- 当前学生列表最多返回 20 条匹配结果
- 当前没有分页接口
- 当前没有“查看积分历史列表”的手机端接口

如果后续你需要，我下一步可以继续补：

1. 手机端积分历史接口
2. 学生详情页接口
3. 动态登录 Token / 过期时间机制
4. 批量加减分接口
