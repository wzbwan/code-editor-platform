# 守护班级 Boss 协作模式服务端改造说明

本文档定义“少量 Boss + 多人协作答题输出”的服务端目标协议。目标是把实时怪物运行态从数据库移到内存，显著降低数据库写入、查询和 WebSocket 广播压力。

## 核心玩法

- 每个开启方向最多同时存在 1 个 Boss。
- Boss 不能被单个学生锁定，同一方向所有学生都可以同时点击并答题攻击。
- 学生每次点击 Boss 只进入一次答题攻击；答题结算后自动脱离本次攻击，不需要逃跑。
- 答对造成伤害，答错可由 Boss 反击学生或增加班级压力。
- Boss 被击败后，按学生对该 Boss 造成的累计伤害分配宠物经验和积分。
- 客户端只负责表现 Boss、血条、贡献值、答题面板；伤害、经验、积分由服务端权威结算。

## 服务端状态模型

Boss 运行态建议放在 WebSocket 常驻进程内存中，不按秒写数据库。

```ts
interface ClassDefenseBossRoom {
  sessionId: string
  classHp: number
  maxClassHp: number
  startedAt: number
  directions: Map<string, DirectionBossState>
  participants: Map<string, ParticipantRuntimeState>
}

interface DirectionBossState {
  directionId: string
  boss: BossRuntimeState | null
  defenderStudentIds: Set<string>
}

interface BossRuntimeState {
  id: string
  directionId: string
  bossKey: string
  bossName: string
  imagePath?: string
  phase: number
  hp: number
  maxHp: number
  attack: number
  status: 'ACTIVE' | 'DEFEATED' | 'ESCAPED'
  spawnedAt: number
  contributionByStudentId: Map<string, number>
}
```

数据库只保留业务事实：

- session 开始/结束。
- 学生加入、选择方向、倒下、复活。
- 每次答题记录。
- Boss 受击事件或最终击败结算。
- 学生积分和宠物经验变更。

不要每秒写 Boss HP 以外的运行态；HP 也只在答题结算或 Boss 阶段切换时写业务事件。

## 快照格式

加入会话、选择方向、Boss 状态变化时，服务端返回或广播轻量快照。

```json
{
  "type": "direction_snapshot",
  "data": {
    "serverTime": "2026-05-07T10:00:00.000Z",
    "session": {
      "id": "sessionId",
      "status": "ACTIVE",
      "classHp": 10,
      "maxClassHp": 10,
      "enabledDirections": ["east", "south", "west", "north"]
    },
    "directions": [
      {
        "directionId": "east",
        "label": "东",
        "enabled": true,
        "defenderCount": 8,
        "bossCount": 1,
        "bossHp": 820,
        "bossMaxHp": 1200
      }
    ],
    "bosses": [
      {
        "id": "boss-east-1",
        "bossId": "boss-east-1",
        "directionId": "east",
        "bossKey": "stone_golem",
        "bossName": "岩甲统领",
        "imagePath": "/monsters/stone_golem.png",
        "phase": 1,
        "status": "ACTIVE",
        "hp": 820,
        "maxHp": 1200,
        "myDamage": 120,
        "totalDamage": 380
      }
    ],
    "participants": []
  }
}
```

兼容字段：

- 客户端优先读 `bosses[]`。
- 也兼容 `boss`、`directionBosses[directionId]`、`directions[].boss`。
- Boss ID 统一放 `id` 和 `bossId`，客户端都会识别。

## 攻击 Boss

客户端点击 Boss 后发送：

```json
{
  "type": "attack_boss",
  "requestId": "boss-atk-12",
  "bossId": "boss-east-1",
  "monsterId": "boss-east-1",
  "directionId": "east"
}
```

服务端校验：

- session 必须 ACTIVE。
- 学生必须已加入并选择了 `directionId`。
- 学生未处于 DOWN 状态。
- Boss 必须存在且属于学生当前方向。
- 不检查 `lockedByStudentId`，Boss 不加锁。

成功返回：

```json
{
  "type": "boss_combat_started",
  "requestId": "boss-atk-12",
  "data": {
    "combat": {
      "id": "combatId",
      "bossId": "boss-east-1",
      "isBoss": true,
      "expiresAt": "2026-05-07T10:00:30.000Z"
    },
    "question": {
      "id": "questionId",
      "type": "SINGLE_CHOICE",
      "content": "题干",
      "options": []
    }
  }
}
```

## 提交答案

客户端沿用 `submit_answer`：

```json
{
  "type": "submit_answer",
  "requestId": "answer-13",
  "combatId": "combatId",
  "answer": "A"
}
```

服务端返回：

```json
{
  "type": "boss_combat_result",
  "requestId": "answer-13",
  "data": {
    "combatId": "combatId",
    "bossId": "boss-east-1",
    "isBoss": true,
    "isCorrect": true,
    "damageToBoss": 36,
    "damageToMonster": 36,
    "damageToStudent": 0,
    "isCritical": false,
    "isDodged": false,
    "bossHp": 784,
    "bossMaxHp": 1200,
    "myDamage": 156,
    "totalDamage": 416,
    "bossDefeated": false,
    "battleEnded": true
  }
}
```

说明：

- `battleEnded: true` 表示本次答题攻击结束，不表示 Boss 被击败。
- 如果 Boss 已被击败，设置 `bossDefeated: true`。
- 为兼容旧客户端，可同时返回 `damageToMonster` 和 `monsterHp`。
- Boss 模式一般不返回 `nextQuestion`，学生再次点击 Boss 才开始下一次答题攻击。

## Boss 状态广播

答题结算、阶段变化、击败时广播增量。

```json
{
  "type": "boss_updated",
  "data": {
    "bossId": "boss-east-1",
    "directionId": "east",
    "patch": {
      "hp": 784,
      "maxHp": 1200,
      "phase": 1,
      "totalDamage": 416
    }
  }
}
```

Boss 击败：

```json
{
  "type": "boss_defeated",
  "data": {
    "bossId": "boss-east-1",
    "directionId": "east",
    "status": "DEFEATED",
    "rewards": [
      {
        "studentId": "studentId",
        "damage": 156,
        "expReward": 18,
        "pointReward": 2
      }
    ]
  }
}
```

## 经验结算建议

推荐按贡献伤害分配，避免“最后一击”争抢：

```ts
studentShare = studentDamage / max(1, totalBossDamage)
expReward = round(baseBossExp * studentShare)
pointReward = round(baseBossPoint * studentShare)
```

可以设置保底：

- 参与且造成伤害 > 0：至少 1 点经验。
- 答对但 Boss 已在并发中被击败：仍记录一次参与，可给少量参与经验。

并发要求：

- 同一学生可以同时只有一个 ACTIVE combat。
- 多个学生同时答对时，对 Boss HP 做原子扣减或在房间单线程事件队列中顺序处理。
- Boss HP 最小为 0；击败结算只执行一次。

## 客户端兼容状态

当前 Godot 客户端已支持：

- `bosses[]`、`boss`、`directionBosses`、`directions[].boss`。
- `attack_boss`。
- `boss_combat_started` / `boss_combat_result`。
- `boss_updated` / `boss_damaged` / `boss_contribution`。
- `boss_removed` / `boss_defeated`。
- 旧 `monsters[]` / `attack_monster` 仍保留。

服务端切换时可以先灰度：某些 session 返回 Boss 字段，旧小怪 session 不受影响。
