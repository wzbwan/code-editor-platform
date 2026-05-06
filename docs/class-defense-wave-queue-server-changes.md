# 班级守护队列波次规则服务端调整说明

本文档记录 Godot 客户端新表现需要服务端配合的规则。

## 目标规则

- 每一波怪物从地图上方同一横排出现，按固定列位垂直向下移动。
- 一横排怪物数量由客户端按屏幕宽度显示，当前 1672x941 战场约为 18 个。
- 地图下方有一条班级防线。怪物穿过防线后，班级生命 `classHp` 扣 1，该怪物自动消失。
- 一波怪物全部消失后，等待几秒再生成下一波。建议间隔 3-5 秒。
- 战斗中的怪物不暂停移动。即使 `lockedByStudentId` 有值，服务端也继续推进该怪物的 `routeProgress`。
- 玩家进入战斗后 30 秒内没有提交答案，按回答错误结算，由怪物攻击玩家。

## 快照字段要求

现有 `session_snapshot.monsters[]` 继续作为客户端权威数据源。建议补充或稳定以下字段：

```json
{
  "id": "monsterId",
  "waveIndex": 0,
  "laneIndex": 0,
  "monsterKey": "slime",
  "status": "WALKING",
  "hp": 30,
  "maxHp": 30,
  "routeProgress": 0.42,
  "lockedByStudentId": null
}
```

- `laneIndex`：建议服务端生成，0 起始，从左到右。客户端缺失时会按同波怪物 `id` 排序兜底，但击杀后可能留下非预期列位。
- `routeProgress`：0 表示地图上方出生点，1 表示抵达下方防线。客户端会把它映射为垂直坐标。
- `status`：
  - `WAITING`：已排入后续波次，但还不显示。
  - `WALKING` 或战斗锁定中的其他活动状态：显示并继续下移。
  - `KILLED`：被击杀后不显示。
  - `REACHED`：穿过防线并扣班级血后不显示。

## 波次推进

服务端建议使用单一波次状态机：

1. 当前波开始时，把本波怪物置为 `WALKING`，广播 `session_snapshot`。
2. 定时推进所有活动怪物的 `routeProgress`，包括正在战斗的怪物。
3. 当怪物 `routeProgress >= 1` 且未死亡：
   - 将怪物置为 `REACHED`。
   - `classHp -= 1`。
   - 清理该怪物的战斗锁定；若有人正在答题，应结束该战斗并通知该玩家。
   - 广播新的 `session_snapshot`。
4. 当当前波所有怪物均为 `KILLED` 或 `REACHED`：
   - 等待 `nextWaveDelaySeconds`，建议 3-5 秒。
   - 再激活下一波怪物。

## 战斗超时

服务端必须做权威超时判定，不能只依赖客户端。

- `combat_started.data.combat.expiresAt` 建议设置为战斗开始后 30 秒。
- 若 30 秒内没有收到有效 `submit_answer`，服务端按错误答案结算本回合。
- 客户端现在也会在 30 秒本地倒计时结束时发送一次超时提交，作为体验优化：

```json
{
  "type": "submit_answer",
  "requestId": "answer-12",
  "combatId": "combatId",
  "answer": "__TIMEOUT__",
  "timeout": true,
  "reason": "ANSWER_TIMEOUT"
}
```

服务端收到该消息时应按错误答案处理，返回普通 `combat_result` 即可：

```json
{
  "type": "combat_result",
  "requestId": "answer-12",
  "data": {
    "combatId": "combatId",
    "monsterId": "monsterId",
    "isCorrect": false,
    "damageToMonster": 0,
    "damageToStudent": 12,
    "monsterKilled": false,
    "studentDown": false,
    "battleEnded": false,
    "nextQuestion": {}
  }
}
```

若服务端先触发超时结算，也直接给该玩家发送同样结构的 `combat_result`。客户端会停止倒计时并播放怪物攻击反馈。

## 与现有接口兼容

- `attack_monster`、`submit_answer`、`flee_combat` 消息类型不需要改名。
- 客户端仍以 `routeProgress`、`status`、`lockedByStudentId` 展示战场。
- 新增 `laneIndex` 是推荐字段，不是强制字段，但服务端提供后队列列位最稳定。
