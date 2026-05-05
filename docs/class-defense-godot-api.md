# 守护班级 Godot 客户端接口文档

本文档描述 Godot 原生客户端接入“守护班级”塔防答题游戏的服务端接口。

## 服务地址

- HTTP API：与当前 Web 项目同域，例如 `https://example.com`
- WebSocket：独立服务，默认本地为 `ws://localhost:3001`
- 本地开发启动：
  - Web：`npm run dev`
  - WebSocket：`npm run dev:class-defense-ws`

生产环境建议把 WebSocket 代理为同域路径，例如：

```text
wss://example.com/class-defense-ws
```

## 整体流程

1. Godot 调 `POST /api/godot/game/login` 登录，拿 `accessToken`
2. Godot 调 `GET /api/godot/game/sessions/active` 查询本班是否有进行中的游戏
3. Godot 调 `POST /api/godot/game/ws-ticket` 换短期 WebSocket ticket
4. Godot 连接 WebSocket 服务
5. Godot 发送 `join_session`
6. 服务端返回 `joined` 和 `session_snapshot`
7. 玩家点击怪物时发送 `attack_monster`
8. 服务端返回 `combat_started`，其中只发给该玩家本次战斗题目
9. 玩家答题后发送 `submit_answer`
10. 服务端返回 `combat_result`；如果双方都未死亡，响应里会带 `nextQuestion`，客户端继续同一场锁定战斗
11. 直到怪物死亡或学生死亡，服务端才结束本次战斗，并向全房间广播最新 `session_snapshot`

## HTTP API

### 1. Godot 游戏登录

`POST /api/godot/game/login`

请求体：

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
    "id": "studentId",
    "username": "student1",
    "name": "张三",
    "role": "STUDENT",
    "className": "一班",
    "hasPet": true,
    "pet": {
      "speciesKey": "fox",
      "name": "狐狸",
      "title": "机敏猎手",
      "imagePath": "/pets/fox.png",
      "nickname": "小火",
      "level": 3
    }
  }
}
```

说明：

- `accessToken` 默认有效期 8 小时
- 仅允许学生账号登录
- 该 token 用于 HTTP API，不直接作为 WebSocket 入场凭证
- `hasPet = false` 时客户端应提示学生先去个人中心选择宠物；服务端也会拒绝其进入 WebSocket 战场

### 2. 查询当前班级进行中的游戏

`GET /api/godot/game/sessions/active`

请求头：

```http
Authorization: Bearer <accessToken>
```

成功响应：

```json
{
  "active": true,
  "session": {
    "id": "sessionId",
    "className": "一班",
    "status": "ACTIVE",
    "classHp": 10,
    "maxClassHp": 10,
    "startedAt": "2026-05-02T12:00:00.000Z"
  }
}
```

如果当前班级没有进行中的游戏：

```json
{
  "active": false,
  "session": null
}
```

### 3. 换取 WebSocket ticket

`POST /api/godot/game/ws-ticket`

请求头：

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

请求体：

```json
{
  "sessionId": "sessionId"
}
```

成功响应：

```json
{
  "ticket": "xxxxx",
  "expiresIn": 60,
  "sessionId": "sessionId",
  "user": {
    "id": "studentId",
    "username": "student1",
    "name": "张三",
    "role": "STUDENT",
    "className": "一班"
  }
}
```

说明：

- `ticket` 默认有效期 60 秒
- `ticket` 只用于 WebSocket 入场
- 过期后重新调用本接口换新 ticket

## WebSocket 消息

所有消息都是 JSON。

客户端消息推荐带 `requestId`，服务端响应会原样带回，便于 Godot 匹配请求。

### 1. 连接成功

服务端主动发送：

```json
{
  "type": "connected",
  "data": {
    "clientId": "abc123",
    "serverTime": "2026-05-02T12:00:00.000Z"
  }
}
```

### 2. 加入游戏

客户端发送：

```json
{
  "type": "join_session",
  "requestId": "join-1",
  "ticket": "wsTicket",
  "sessionId": "sessionId"
}
```

成功响应：

```json
{
  "type": "joined",
  "requestId": "join-1",
  "data": {
    "student": {},
    "participant": {},
    "snapshot": {}
  }
}
```

服务端随后也可能广播：

```json
{
  "type": "participant_joined",
  "data": {
    "student": {},
    "participant": {}
  }
}
```

### 3. 房间快照

服务端会在加入、怪物移动、锁怪、答题结算、复活、扣班级血时广播：

```json
{
  "type": "session_snapshot",
  "data": {
    "serverTime": "2026-05-02T12:00:00.000Z",
    "session": {
      "id": "sessionId",
      "status": "ACTIVE",
      "classHp": 9,
      "maxClassHp": 10,
      "stateVersion": 12
    },
    "participants": [
      {
        "studentId": "studentId",
        "status": "ALIVE",
        "hp": 100,
        "maxHp": 100,
        "reviveAt": null,
        "student": {
          "id": "studentId",
          "username": "student1",
          "name": "张三",
          "className": "一班"
        },
        "pet": {
          "speciesKey": "fox",
          "name": "狐狸",
          "title": "机敏猎手",
          "imagePath": "/pets/fox.png",
          "nickname": "小火",
          "level": 3,
          "stats": {
            "maxHp": 158,
            "attack": 34,
            "defense": 15,
            "critRate": 9.4,
            "dodgeRate": 9.2
          }
        }
      }
    ],
    "monsters": [
      {
        "id": "monsterId",
        "waveIndex": 0,
        "monsterKey": "monsterTypeId",
        "monsterName": "史莱姆",
        "monsterLevel": 1,
        "imagePath": "/monsters/slime.png",
        "status": "WALKING",
        "hp": 30,
        "maxHp": 30,
        "routeProgress": 0.34,
        "lockedByStudentId": null
      }
    ],
    "activeCombat": null
  }
}
```

Godot 客户端应以 `session_snapshot` 为显示权威来源。

### 4. 点击怪物进入战斗

客户端发送：

```json
{
  "type": "attack_monster",
  "requestId": "atk-1",
  "monsterId": "monsterId"
}
```

成功响应只发给发起攻击的学生：

```json
{
  "type": "combat_started",
  "requestId": "atk-1",
  "data": {
    "combat": {
      "id": "combatId",
      "monsterId": "monsterId",
      "studentId": "studentId",
      "expiresAt": "2026-05-02T12:00:45.000Z"
    },
    "question": {
      "id": "questionId",
      "content": "题干",
      "type": "单选题",
      "score": 5,
      "options": [
        { "key": "A", "value": "选项 A" },
        { "key": "B", "value": "选项 B" }
      ]
    }
  }
}
```

如果怪物已被别人锁定、学生死亡、学生已有战斗、怪物不可攻击，服务端返回：

```json
{
  "type": "error",
  "requestId": "atk-1",
  "error": "怪物已被其他同学锁定或不可攻击"
}
```

### 5. 提交答案

客户端发送：

```json
{
  "type": "submit_answer",
  "requestId": "answer-1",
  "combatId": "combatId",
  "answer": "A"
}
```

成功响应：

```json
{
  "type": "combat_result",
  "requestId": "answer-1",
  "data": {
    "combatId": "combatId",
    "sessionId": "sessionId",
    "monsterId": "monsterId",
    "roundIndex": 1,
    "isCorrect": true,
    "damageToMonster": 20,
    "damageToStudent": 0,
    "isCritical": false,
    "isDodged": false,
    "battleStats": {
      "maxHp": 120,
      "attack": 20,
      "defense": 8,
      "critRate": 5,
      "dodgeRate": 3,
      "source": "PET",
      "pet": {
        "speciesKey": "fox",
        "name": "狐狸",
        "title": "机敏猎手",
        "imagePath": "/pets/fox.png",
        "level": 2
      }
    },
    "monsterHp": 10,
    "monsterKilled": false,
    "studentHp": 100,
    "studentDown": false,
    "battleEnded": false,
    "nextQuestion": {
      "id": "nextQuestionId",
      "content": "下一题题干",
      "type": "单选题",
      "score": 5,
      "options": [
        { "key": "A", "value": "选项 A" },
        { "key": "B", "value": "选项 B" }
      ]
    },
    "reviveAt": null
  }
}
```

说明：

- `battleEnded = false` 时，怪物仍被当前学生锁定，客户端应展示 `nextQuestion` 继续下一回合。
- `battleEnded = true` 且 `monsterKilled = true` 时，本次战斗胜利，服务端才结算击杀积分和宠物经验。
- `battleEnded = true` 且 `studentDown = true` 时，本次战斗失败，学生等待 `reviveAt` 后复活。

### 6. 逃跑

客户端在当前学生已有进行中的战斗时发送：

```json
{
  "type": "flee_combat",
  "requestId": "flee-1",
  "combatId": "combatId",
  "monsterId": "monsterId"
}
```

服务端处理要求：

- 必须校验 WebSocket ticket 对应的学生就是该 `combatId` 的参战学生。
- 必须校验战斗仍在进行中，且 `monsterId` 与战斗锁定怪物一致。
- 逃跑成功时，结束本次战斗锁定，但不结算击杀奖励，不扣怪物生命，不改变怪物路线进度。
- 逃跑失败时，战斗保持进行中，当前题目保持不变；客户端会禁用再次逃跑，直到玩家至少提交并结算一道题。
- 无论成功或失败，都建议返回 `requestId`，方便客户端对应本次请求。

推荐成功响应：

```json
{
  "type": "flee_result",
  "requestId": "flee-1",
  "data": {
    "combatId": "combatId",
    "sessionId": "sessionId",
    "monsterId": "monsterId",
    "studentId": "studentId",
    "success": true,
    "escaped": true,
    "battleEnded": true,
    "message": "逃跑成功，已脱离战斗。"
  }
}
```

推荐失败响应：

```json
{
  "type": "flee_result",
  "requestId": "flee-1",
  "data": {
    "combatId": "combatId",
    "sessionId": "sessionId",
    "monsterId": "monsterId",
    "studentId": "studentId",
    "success": false,
    "escaped": false,
    "battleEnded": false,
    "message": "逃跑失败，需要先答一道题才能再次逃跑。"
  }
}
```

客户端兼容的响应类型：

- 推荐：`flee_result`
- 兼容：`combat_flee_result`
- 兼容：`combat_fled`

客户端成功判定字段：

- 推荐返回 `success: true`
- 也兼容 `escaped`、`isSuccess`、`fleeSucceeded`、`isEscaped`

错误响应：

```json
{
  "type": "error",
  "requestId": "flee-1",
  "error": "当前战斗不存在或不能逃跑"
}
```

状态广播建议：

- 逃跑成功后，服务端应向会话内所有客户端广播新的 `session_snapshot`。
- 成功快照里该怪物的 `lockedByStudentId` 应清空或置为 `null`，怪物仍按原状态留在战场。
- 逃跑失败一般不需要广播全局快照，只需要给发起者返回 `flee_result`；如果服务端记录了逃跑冷却、失败次数等会影响 UI 的状态，也应广播或在响应中携带。

### 7. 心跳

客户端建议每 15-30 秒发送一次：

```json
{
  "type": "heartbeat",
  "requestId": "hb-1"
}
```

服务端响应：

```json
{
  "type": "heartbeat_ack",
  "requestId": "hb-1",
  "serverTime": "2026-05-02T12:00:00.000Z"
}
```

## 状态枚举

### 会话状态

- `PENDING`：教师已创建，尚未开始
- `ACTIVE`：进行中
- `ENDED`：已结束

### 玩家状态

- `ALIVE`：可攻击
- `DOWN`：死亡，等待 `reviveAt` 到达后复活

### 怪物状态

- `WAITING`：已排入波次，尚未出场
- `WALKING`：正在沿路线移动，可点击攻击
- `COMBAT`：被某个学生锁定战斗中
- `KILLED`：已被击败
- `REACHED`：已冲过终点并扣除班级血量

## 服务端权威规则

- 客户端不能自行决定伤害、血量、死亡、复活、怪物移动或班级扣血
- 客户端只发送操作意图
- 怪物锁定由服务端原子处理，同一时间只能被一个学生战斗
- 答案判定使用服务端题库答案
- 战斗中无论答对或答错，只要怪物和学生都没有死亡，就继续抽题进入下一回合
- 玩家战斗属性由服务端读取该学生当前宠物计算：`maxHp` 决定玩家血量，`attack` 决定答对伤害，`defense` 抵消怪物反击，`critRate` 决定暴击，`dodgeRate` 决定闪避
- 没有宠物的学生不能进入游戏，`join_session` 会返回错误
- 只有击杀怪物时才结算积分和宠物经验，单次答对但未击杀不结算奖励
- 学生死亡后必须等待 `reviveAt`，到时间后由服务端 tick 自动复活

## 教师端管理 API

教师端使用 Web 登录态。

教师也可以直接访问 Web 配置页：

```text
/teacher/class-defense
```

创建会话：

```http
POST /api/class-defense/sessions
```

请求体：

```json
{
  "className": "一班",
  "paperId": "practicePaperId",
  "config": {
    "maxClassHp": 10,
    "reviveSeconds": 30,
    "combatSeconds": 45,
    "killPointReward": 1,
    "tickMs": 1000
  }
}
```

开始会话：

```http
PUT /api/class-defense/sessions/{sessionId}
Content-Type: application/json

{ "action": "START" }
```

结束会话：

```http
PUT /api/class-defense/sessions/{sessionId}
Content-Type: application/json

{ "action": "END" }
```
