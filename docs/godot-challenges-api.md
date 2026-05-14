# Godot 原生代码闯关 API 对接文档

本文档面向 Godot 原生客户端。当前方案是：

1. Godot 使用学生账号登录服务端，获得 Bearer token。
2. Godot 从服务端获取章节、关卡、进度和公开判题提示。
3. Godot 调用学生电脑上的 local-runner 执行 Python。
4. Godot 将代码和 local-runner 执行结果提交给服务端。
5. 服务端根据私有判题配置判定是否通关并记录积分。
6. Godot 在学生使用“求助AI”时调用 Py点扣除接口，服务端维护额度余额。

服务端不会执行学生 Python，也不会把标准答案下发给 Godot。

代码闯关不再支持网页端或 Godot 内嵌 WebView 访问。旧的 `/api/godot/auth/login`、`/api/godot/auth/exchange` 和 `/student/challenges` 页面入口已停用；Godot 必须使用本文档中的原生 Bearer API。

## 1. 鉴权

除登录接口外，所有接口都需要请求头：

```http
Authorization: Bearer <accessToken>
```

token 当前有效期为 8 小时。过期后重新登录。

## 2. 登录

`POST /api/godot/challenges/login`

请求：

```json
{
  "username": "student1",
  "password": "123456"
}
```

成功响应：

```json
{
  "accessToken": "xxxxx",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": {
    "id": "clx123",
    "username": "student1",
    "name": "张三",
    "role": "STUDENT",
    "className": "一班",
    "pyPointBalance": 10
  }
}
```

失败：

- `401`：账号不存在、密码错误、非学生账号

## 3. 当前用户

`GET /api/godot/challenges/me`

响应：

```json
{
  "user": {
    "id": "clx123",
    "username": "student1",
    "name": "张三",
    "role": "STUDENT",
    "className": "一班",
    "pyPointBalance": 10
  }
}
```

`pyPointBalance` 是当前学生的 Py点余额，用于客户端显示求助AI额度。该字段会读取服务端最新余额。

## 4. 闯关首页

`GET /api/godot/challenges/home`

响应：

```json
{
  "className": "一班",
  "pyPointBalance": 10,
  "chapters": [
    {
      "key": "list-milk-tea",
      "title": "经营奶茶店",
      "theme": "Python 列表",
      "description": "你是奶茶店的小程序管理员...",
      "isUnlocked": true,
      "totalLevels": 8,
      "passedLevels": 2,
      "accessibleLevels": 3
    }
  ]
}
```

`pyPointBalance` 是进入闯关首页时的当前余额。客户端从求助AI返回后也可以重新调用本接口刷新余额。

## 5. 章节详情

`GET /api/godot/challenges/chapters/{chapterKey}`

响应核心结构：

```json
{
  "chapter": {
    "key": "list-milk-tea",
    "title": "经营奶茶店",
    "theme": "Python 列表",
    "description": "...",
    "helpDoc": {
      "title": "列表基础速查",
      "intro": "...",
      "sections": []
    },
    "isUnlocked": true,
    "levels": [
      {
        "key": "create-orders",
        "title": "第一关：创建订单本",
        "summary": "创建订单列表和一个空的 VIP 订单列表。",
        "description": "...",
        "points": 2,
        "isAccessible": true,
        "isPassed": false,
        "attemptCount": 0,
        "awardedPoints": 0,
        "firstPassedAt": null,
        "isManuallyUnlocked": false
      }
    ]
  }
}
```

## 6. 关卡详情

`GET /api/godot/challenges/chapters/{chapterKey}/levels/{levelKey}`

未解锁时返回：

- `403`
- `{ "error": "当前关卡尚未解锁" }`

成功响应中的 `level.publicJudge` 是给 Godot/local-runner 使用的公开判题提示，不包含标准答案。

变量判题关卡示例：

```json
{
  "level": {
    "key": "create-orders",
    "title": "第一关：创建订单本",
    "description": "任务：...",
    "points": 2,
    "initialCode": "# 创建订单列表 orders\n",
    "latestCode": null,
    "latestJudgeMessage": null,
    "latestStdout": null,
    "latestStderr": null,
    "latestSubmittedAt": null,
    "publicJudge": {
      "mode": "VARIABLES",
      "variableNames": ["orders", "vip_orders"],
      "variableStartMarker": "__CODEX_CHALLENGE_VARIABLES_START__",
      "variableEndMarker": "__CODEX_CHALLENGE_VARIABLES_END__",
      "variableProbeScript": "\nimport json\n..."
    }
  }
}
```

输出判题关卡示例：

```json
{
  "level": {
    "key": "loop-orders",
    "publicJudge": {
      "mode": "OUTPUT"
    }
  }
}
```

## 7. local-runner 执行方式

### 7.1 变量判题

如果 `publicJudge.mode = "VARIABLES"`，Godot 应把学生代码和 `variableProbeScript` 拼接后交给 local-runner：

```text
<student_code>

<variableProbeScript>
```

local-runner 的 stdout 会包含三部分：

1. 学生自己的输出
2. `variableStartMarker`
3. JSON 变量结果
4. `variableEndMarker`

Godot 可以选择自己解析变量，也可以把带 marker 的 stdout 原样提交给服务端。服务端会自动从 stdout 中提取变量结果，并把 marker 内容从最终记录的 stdout 中移除。

### 7.2 输出判题

如果 `publicJudge.mode = "OUTPUT"`，Godot 直接运行学生代码，把 stdout/stderr/exitCode/timedOut 提交给服务端即可。

## 8. Py点查询与扣除

Py点是学生求助AI的额度。服务端只负责余额、流水和扣除幂等；AI 请求本身由 Godot 客户端按实际产品流程处理。

### 8.1 查询 Py点

`GET /api/godot/challenges/py-points`

响应：

```json
{
  "pyPointBalance": 10,
  "user": {
    "id": "clx123",
    "username": "student1",
    "name": "张三",
    "pyPointBalance": 10
  }
}
```

### 8.2 扣除 Py点

`POST /api/godot/challenges/py-points/consume`

请求：

```json
{
  "amount": 1,
  "requestId": "ai-help-20260512-0001",
  "reason": "代码闯关求助AI"
}
```

字段说明：

- `amount`：本次扣除数量，正整数；不传时默认为 `1`。
- `requestId`：强烈建议传。客户端为一次求助AI生成一个唯一 ID，网络重试时沿用同一个 ID，服务端会返回同一条扣除结果，不会重复扣点。
- `reason`：可选，不传时服务端记录为 `Godot 求助AI消耗`。

成功响应：

```json
{
  "success": true,
  "alreadyProcessed": false,
  "pyPointBalance": 9,
  "record": {
    "id": "cly123",
    "studentId": "clx123",
    "studentUsername": "student1",
    "delta": -1,
    "balanceBefore": 10,
    "balanceAfter": 9,
    "reason": "代码闯关求助AI",
    "source": "GODOT_AI_HELP",
    "clientRequestId": "ai-help-20260512-0001",
    "occurredAt": "2026-05-12T03:20:00.000Z"
  }
}
```

如果同一个 `requestId` 已经扣过，响应仍然是 `200`，但：

```json
{
  "success": true,
  "alreadyProcessed": true,
  "pyPointBalance": 9
}
```

错误状态：

- `400`：扣除数量不是正整数、`requestId` 过长或请求格式错误
- `401`：未授权或 token 失效
- `402`：Py点余额不足，响应 `{ "error": "Py点余额不足" }`

推荐客户端流程：

1. 用户点击“求助AI”。
2. 先生成并保存本次 `requestId`。
3. 调用扣除接口。
4. `200` 后更新界面余额为响应中的 `pyPointBalance`，再发起实际 AI 求助流程。
5. 如果网络超时但本地已生成 `requestId`，重试时必须复用同一个 `requestId`。
6. 如果返回 `402`，提示额度不足，不要发起 AI 请求。

## 9. 提交判题

`POST /api/godot/challenges/submit`

请求：

```json
{
  "chapterKey": "list-milk-tea",
  "levelKey": "create-orders",
  "code": "orders = ['珍珠奶茶']\n",
  "execution": {
    "stdout": "__CODEX_CHALLENGE_VARIABLES_START__\n{\"orders\":{\"missing\":false,\"value\":[\"珍珠奶茶\"]}}\n__CODEX_CHALLENGE_VARIABLES_END__\n",
    "stderr": "",
    "exitCode": 0,
    "timedOut": false
  }
}
```

也可以由 Godot 自己解析变量后提交：

```json
{
  "chapterKey": "list-milk-tea",
  "levelKey": "create-orders",
  "code": "orders = ['珍珠奶茶']\n",
  "execution": {
    "stdout": "",
    "stderr": "",
    "exitCode": 0,
    "timedOut": false,
    "variables": {
      "orders": {
        "missing": false,
        "value": ["珍珠奶茶"]
      },
      "vip_orders": {
        "missing": true
      }
    }
  }
}
```

成功响应：

```json
{
  "passed": true,
  "message": "恭喜通关，结果正确。",
  "stdout": "",
  "stderr": "",
  "isFirstPass": true,
  "pointsAwarded": 2
}
```

失败响应也可能是 `200`，此时 `passed = false`：

```json
{
  "passed": false,
  "message": "变量 orders 的结果不正确。",
  "stdout": "",
  "stderr": "",
  "isFirstPass": false,
  "pointsAwarded": 0
}
```

错误状态：

- `400`：请求字段缺失、关卡不存在、提交失败
- `401`：未授权或 token 失效
- `403`：关卡未解锁
- `429`：提交过于频繁，响应中会带 `retryAfterSeconds`

## 10. Godot 端推荐流程

1. 登录：`POST /api/godot/challenges/login`。
2. 拉首页：`GET /api/godot/challenges/home`。
3. 进入章节：`GET /api/godot/challenges/chapters/{chapterKey}`。
4. 进入关卡：`GET /api/godot/challenges/chapters/{chapterKey}/levels/{levelKey}`。
5. 展示 `pyPointBalance`，用户点击求助AI时先调用 `POST /api/godot/challenges/py-points/consume`。
6. 用户点击运行：
   - 变量判题：运行 `code + variableProbeScript`。
   - 输出判题：运行 `code`。
7. 用户点击提交：`POST /api/godot/challenges/submit`。
8. 如果通关，重新拉章节或关卡数据刷新下一关状态。

## 11. 安全边界

当前方案降低的是低成本作弊风险：

- Godot 不提交 `passed: true`。
- Godot 不拿标准答案。
- 服务端用私有 judge 配置判定结果。
- 服务端保存代码、stdout、stderr、尝试次数和通关积分。

但学生本地机器仍然不是可信环境。理论上学生可以抓包伪造 local-runner 执行结果，或修改 Godot/local-runner。若后续积分排名非常高价值，可以再增加 local-runner 签名、一次性 nonce、设备绑定或独立沙箱 judge。
