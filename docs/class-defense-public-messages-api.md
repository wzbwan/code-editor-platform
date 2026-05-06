# 守护班级公共消息栏接口需求

本文档定义 Godot 客户端右侧“公共消息”栏需要服务端广播的 WebSocket 事件。客户端已兼容该事件；服务端接入后可让所有在线学生同时看到战况提醒。

## 目标

- 当某方向怪物冲过防线导致班级掉血时，广播“某防线正在遭受攻击，请求支援”。
- 当某学生在战斗中倒下时，广播“{name}在战斗中壮烈牺牲”。
- 消息应发给当前守护班级 session 内的所有在线学生，包括正在看总览和正在某方向战斗的学生。

## 推荐事件：`public_message`

```json
{
  "type": "public_message",
  "data": {
    "id": "pm-20260506-0001",
    "kind": "direction_under_attack",
    "sessionId": "sessionId",
    "directionId": "north",
    "message": "北防线正在遭受攻击，请求支援",
    "createdAt": "2026-05-06T14:00:52.000Z"
  }
}
```

```json
{
  "type": "public_message",
  "data": {
    "id": "pm-20260506-0002",
    "kind": "student_down",
    "sessionId": "sessionId",
    "directionId": "north",
    "studentId": "studentId",
    "studentName": "张三",
    "message": "张三在战斗中壮烈牺牲",
    "createdAt": "2026-05-06T14:01:10.000Z"
  }
}
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 建议 | 消息唯一 ID，便于客户端后续去重或扩展历史消息 |
| `kind` | string | 是 | `direction_under_attack` 或 `student_down` |
| `sessionId` | string | 是 | 当前守护班级 session ID |
| `directionId` | string | 条件必填 | 方向相关消息必填，取 `east/south/west/north/southeast/northeast/southwest/northwest` |
| `studentId` | string | 条件必填 | 学生倒下消息建议提供 |
| `studentName` | string | 条件必填 | 学生倒下消息必填，客户端会用于兜底生成文案 |
| `message` | string | 建议 | 服务端直接给展示文案；没有时客户端会按 `kind` 兜底拼接 |
| `createdAt` | string | 建议 | ISO 时间，便于以后做历史消息或排序 |

## 触发时机

### 防线受击

当怪物状态变为 `REACHED`，且服务端执行 `classHp -= 1` 后，广播：

```json
{
  "type": "public_message",
  "data": {
    "kind": "direction_under_attack",
    "sessionId": "sessionId",
    "directionId": "north",
    "message": "北防线正在遭受攻击，请求支援"
  }
}
```

服务端仍应继续广播已有的 `direction_summary` / `monster_removed`。为兼容旧客户端，`monster_removed` 建议在 `reason: "REACHED"` 时带上 `directionId`。

### 学生倒下

当战斗结算导致学生或宠物生命归零，且服务端返回 `combat_result.studentDown = true` 后，向全 session 广播：

```json
{
  "type": "public_message",
  "data": {
    "kind": "student_down",
    "sessionId": "sessionId",
    "directionId": "north",
    "studentId": "studentId",
    "studentName": "张三",
    "message": "张三在战斗中壮烈牺牲"
  }
}
```

## 客户端兼容行为

当前 Godot 客户端除了 `public_message`，还兼容以下别名事件名：`public_event`、`battle_notice`。

在服务端未接入 `public_message` 前，客户端会做有限兜底：

- 收到 `monster_removed.reason = "REACHED"` 时，显示对应方向受击消息。
- 本机收到 `combat_result.studentDown = true` 时，显示当前学生倒下消息。
- 如果快照或 `direction_summary` 里 `classHp` 下降，且包含 `directionId` / `lastDamageDirectionId` / `damagedDirectionId`，客户端会显示对应方向受击消息；否则只能显示“有防线正在遭受攻击，请求支援”。

为保证“公共消息”真正对全班可见，服务端仍需要广播 `public_message`。
