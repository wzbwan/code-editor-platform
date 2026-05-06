# 守护班级八方向房间接口对接文档

本文档定义 Godot 客户端八方向守城所需的服务端 WebSocket 数据契约。目标是降低 50 人同时在线时的出口带宽和单包大小。

## 核心规则

- 战场固定有 8 个方向：`east`、`south`、`west`、`north`、`southeast`、`northeast`、`southwest`、`northwest`。
- 显示名分别是：东、南、西、北、东南、东北、西南、西北。
- 服务端可以配置开启哪些方向，关闭方向不能进入。
- 服务端配置的怪物类型和数量在各开启方向保持一致，但每个方向有独立怪物实例、生命、锁定状态、行进进度。
- 学生进入守护班级后先收到八方向摘要，只订阅自己选择的方向。
- 学生切换方向后，服务端停止向该连接推旧方向的怪物细节，只推新方向。
- 全班共享数据只保留摘要，例如班级生命、方向压力、各方向守城人数。

## 推荐方向 ID

```json
[
  {"id": "northwest", "label": "西北"},
  {"id": "north", "label": "北"},
  {"id": "northeast", "label": "东北"},
  {"id": "west", "label": "西"},
  {"id": "east", "label": "东"},
  {"id": "southwest", "label": "西南"},
  {"id": "south", "label": "南"},
  {"id": "southeast", "label": "东南"}
]
```

## 加入会话

客户端仍发送 `join_session`，可以附带上次选择的方向。没有方向时服务端只返回总览摘要。

```json
{
  "type": "join_session",
  "requestId": "join-1",
  "ticket": "wsTicket",
  "sessionId": "sessionId",
  "directionId": ""
}
```

服务端返回：

```json
{
  "type": "joined",
  "requestId": "join-1",
  "data": {
    "student": {},
    "participant": {},
    "snapshot": {
      "serverTime": "2026-05-05T12:00:00.000Z",
      "session": {
        "id": "sessionId",
        "status": "ACTIVE",
        "classHp": 100,
        "maxClassHp": 100,
        "enabledDirections": ["east", "south", "west", "north"]
      },
      "directions": [
        {
          "directionId": "east",
          "label": "东",
          "enabled": true,
          "monsterCount": 18,
          "defenderCount": 7
        }
      ],
      "participants": [],
      "monsters": []
    }
  }
}
```

## 选择方向

客户端点击方向后发送：

```json
{
  "type": "select_direction",
  "requestId": "dir-2",
  "sessionId": "sessionId",
  "directionId": "east"
}
```

服务端校验：

- `directionId` 必须是 8 个合法方向之一。
- 方向必须在本场 session 的 `enabledDirections` 内。
- 同一学生同一时间只属于一个方向。
- 切换方向时更新各方向 `defenderCount`，并广播总览摘要。

成功后只给该客户端返回当前方向轻量快照：

```json
{
  "type": "direction_snapshot",
  "requestId": "dir-2",
  "data": {
    "serverTime": "2026-05-05T12:00:02.000Z",
    "directionId": "east",
    "session": {
      "id": "sessionId",
      "classHp": 100,
      "maxClassHp": 100,
      "stateVersion": 31,
      "enabledDirections": ["east", "south", "west", "north"]
    },
    "directions": [
      {"directionId": "east", "label": "东", "enabled": true, "monsterCount": 18, "defenderCount": 8}
    ],
    "participants": [
      {
        "studentId": "studentId",
        "directionId": "east",
        "status": "ALIVE",
        "hp": 100,
        "maxHp": 100,
        "student": {"name": "张三"},
        "pet": {"speciesKey": "fox", "nickname": "小火"}
      }
    ],
    "monsters": [
      {
        "id": "east-m-001",
        "directionId": "east",
        "waveIndex": 0,
        "laneIndex": 0,
        "monsterKey": "slime",
        "status": "WALKING",
        "hp": 30,
        "maxHp": 30,
        "routeProgress": 0.18,
        "lockedByStudentId": null
      }
    ]
  }
}
```

## 取消方向订阅

客户端回到总览时发送：

```json
{
  "type": "select_direction",
  "requestId": "dir-3",
  "sessionId": "sessionId",
  "directionId": null
}
```

服务端将该连接移出方向房间，之后只推 `direction_summary`，不推怪物细节。

## 总览摘要广播

方向人数、怪物数、班级生命变化时，服务端向所有在线学生广播轻量摘要：

```json
{
  "type": "direction_summary",
  "data": {
    "session": {
      "id": "sessionId",
      "classHp": 99,
      "maxClassHp": 100,
      "enabledDirections": ["east", "south", "west", "north"]
    },
    "directions": [
      {"directionId": "east", "label": "东", "enabled": true, "monsterCount": 17, "defenderCount": 8},
      {"directionId": "south", "label": "南", "enabled": true, "monsterCount": 20, "defenderCount": 11},
      {"directionId": "west", "label": "西", "enabled": true, "monsterCount": 19, "defenderCount": 6},
      {"directionId": "north", "label": "北", "enabled": true, "monsterCount": 18, "defenderCount": 5},
      {"directionId": "southeast", "label": "东南", "enabled": false, "monsterCount": 0, "defenderCount": 0}
    ]
  }
}
```

该消息不应包含完整怪物列表。

## 方向内增量事件

服务端只向订阅对应方向的客户端广播以下事件。

### 怪物生成

```json
{
  "type": "monster_spawned",
  "data": {
    "directionId": "east",
    "monster": {
      "id": "east-m-002",
      "directionId": "east",
      "waveIndex": 0,
      "laneIndex": 1,
      "monsterKey": "slime",
      "status": "WALKING",
      "hp": 30,
      "maxHp": 30,
      "routeProgress": 0.0,
      "lockedByStudentId": null
    }
  }
}
```

### 怪物状态变化

```json
{
  "type": "monster_updated",
  "data": {
    "directionId": "east",
    "monsterId": "east-m-001",
    "patch": {
      "hp": 18,
      "status": "WALKING",
      "routeProgress": 0.32,
      "lockedByStudentId": "studentId"
    }
  }
}
```

### 怪物消失

```json
{
  "type": "monster_removed",
  "data": {
    "directionId": "east",
    "monsterId": "east-m-001",
    "reason": "KILLED"
  }
}
```

### 守城人数变化

```json
{
  "type": "direction_defenders",
  "data": {
    "directionId": "east",
    "defenderCount": 8,
    "defenders": [
      {
        "studentId": "studentId",
        "directionId": "east",
        "student": {"name": "张三"},
        "pet": {"speciesKey": "fox", "nickname": "小火"}
      }
    ]
  }
}
```

`defenders` 最多返回 10 个即可，供 Godot 底部宠物栏展示。完整在线名单不应高频广播。

## 网络流量约束

- 学生端 `direction_snapshot.monsters[]` 只包含当前方向活动怪，不包含其他方向，也不包含等待中的全量怪物池。
- 怪物字段保持最小化，不要包含数据库创建时间、完整配置、技能描述、完整图片 URL。
- `laneIndex` 必须由服务端生成并稳定保存，避免客户端对大量怪物排序。
- `routeProgress` 不建议每帧广播。推荐 250-1000ms 一次，客户端本地插值。
- 如使用 `spawnedAt`、`speed`、`startProgress`，可进一步减少移动更新频率。
- 单条 WebSocket 消息建议控制在 32KB 以下，超过时拆分或改用增量事件。

## 与旧客户端兼容

- `attack_monster`、`submit_answer`、`flee_combat` 仍可沿用。
- 攻击、答题、逃跑请求需要带 `monsterId`，服务端根据怪物所属方向和学生当前方向校验。
- 旧 `session_snapshot` 可以继续存在，但学生端不应再收到全量所有方向怪物。
