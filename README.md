# Python 代码教学平台

一个面向课堂教学场景的 Python 作业与答题平台。  
项目覆盖学生作业编写、教师批阅、学生积分管理、题库/试卷管理、课堂练习下发与结算等完整流程。

核心定位：

- 学生在网页内完成 Python 作业与课堂答题
- 教师在同一后台完成学生管理、作业管理、题库管理、练习组织与成绩结算
- 支持“禁止复制/粘贴”的作业编辑场景
- 支持本地 Python 运行器，实现网页内 `input()` 交互执行

## 功能概览

### 学生端

- 登录后查看作业列表
- 进入作业页编写代码、运行代码、提交作业
- 作业页支持三栏布局：
  - 作业要求
  - 运行结果 / 交互终端
  - 代码编辑器
- 作业要求区域支持折叠，便于给终端腾出空间
- 作业要求与代码区域禁止复制/粘贴
- 支持教师预设“默认代码”
- 个人中心查看：
  - 当前积分
  - 积分记录
  - 作业得分与评语
  - 宠物养成面板
  - 修改密码
- 首次进入个人中心可选择初始宠物
- 获得正向积分时，宠物同步获得经验并自动升级
- 查看班级宠物状态：
  - 同班宠物列表
  - 等级榜 / 战力榜 / 本周成长榜
  - 查看同学宠物公开属性、装备槽位、技能槽位
- 自动接收教师发起的课堂练习：
  - 逐题练习
  - 整卷练习

### 教师端

- 学生管理
  - 单个新增学生
  - Excel 批量导入学生
  - 通过用户名回填班级
  - 快速搜索学生
  - 查看学生积分与积分流水
  - 重置学生密码为 `111111`
- 作业管理
  - 创建 / 编辑 / 启用 / 停用作业
  - 为作业配置“默认代码”
- 作业批阅
  - 单条批阅提交
  - 批量下载作业 ZIP
  - 批量导入 Excel 批阅结果
- 作业提交状态
  - 按作业、班级查看提交状态
  - 卡片式查看全班提交情况
  - 点击学生查看代码、评语、积分与最近记录
- 题库与试卷
  - Excel 导入题库
  - 从题库组卷
  - Excel 导入试卷
  - 题库删题
  - 试卷查看、编辑、删除
  - 试卷题目逐题编辑 / 删除
- 课堂练习
  - 逐题练习
  - 整卷练习
  - 教师端实时查看提交人数 / 总人数
  - 逐题练习按答对先后结算积分奖励
  - 整卷练习按时限前 50% 提交给予加成
  - 支持删除“没有任何学生答题记录”的误建练习
- 班级宠物查看
  - 教师可切换班级查看学生宠物养成状态
  - 复用学生端班级宠物看板展示公开属性、装备槽位、技能槽位

## 课堂练习规则

### 逐题练习

- 教师选择班级后开始逐题下发
- 学生只可提交一次，提交后不可修改
- 教师结束本题后统一结算
- 仅答对学生可获得积分奖励
- 奖励系数按答对提交名次分段：

| 名次区间 | 系数 |
| --- | --- |
| 前 10% | `1.5` |
| 10% - 20% | `1.4` |
| 20% - 30% | `1.3` |
| 30% - 40% | `1.2` |
| 40% - 50% | `1.1` |
| 50% - 60% | `1.0` |
| 60% - 70% | `0.7` |
| 70% - 80% | `0.5` |
| 80% - 90% | `0.4` |
| 90% - 100% | `0.3` |

说明：

- 实际结算采用“按人数上限切档”，保证小班级也能命中前几档
- 奖励积分保留 1 位小数

### 整卷练习

- 教师设置答题时长后统一下发
- 每个学生的题目顺序和选项顺序可随机打乱
- 学生必须在时限内交卷
- 在总时长前 50% 内提交，最终成绩按 `1.2x` 结算
- 整卷练习得分会同步写入积分
- 最终积分保留 1 位小数

## 技术栈

- 前端：Next.js 14 + React 18 + TypeScript + Tailwind CSS
- 路由：App Router
- 认证：NextAuth Credentials
- 数据库：SQLite
- ORM：Prisma
- Excel 处理：`xlsx`
- 作业压缩导出：`jszip`
- 代码编辑器：`react-simple-code-editor` + `prism-react-renderer`
- 终端：`xterm.js`
- 本地 Python 运行器：Go

## 技术实现说明

### 1. Web 应用架构

- 前端页面与服务端 API 都放在 Next.js 项目中
- 业务接口主要位于 `src/app/api`
- 教师端与学生端页面按角色分区：
  - `src/app/student`
  - `src/app/teacher`

### 2. 数据模型

核心模型位于 [prisma/schema.prisma](prisma/schema.prisma)：

- `User`
  - 学生 / 教师账号
  - 包含 `className`、`pointBalance`
- `Assignment`
  - 作业定义
  - 包含 `defaultCode`
- `Submission`
  - 学生作业提交与教师批阅结果
- `StudentPointRecord`
  - 积分流水
- `StudentPet`
  - 学生当前宠物
  - 记录品种、等级、经验、当前生命值
- `StudentPetEquipmentSlot`
  - 宠物装备槽位（4 格）
- `StudentPetSkillSlot`
  - 宠物技能槽位（4 格）
- `StudentPetInventorySlot`
  - 宠物背包槽位（16 格）
- `StudentPetExpRecord`
  - 宠物经验流水
- `QuestionBankItem`
  - 题库题目
- `PracticePaper`
  - 试卷
- `PaperQuestion`
  - 试卷内题目快照
- `PracticeSession`
  - 一次课堂练习会话
- `PracticeSessionStudent`
  - 某学生在某次练习中的总体状态
- `PracticeResponse`
  - 某学生某题的作答记录

设计特点：

- 作业批阅分数仍为整数
- 课堂练习奖励与积分流水支持 1 位小数
- 宠物经验只从宠物系统上线后的新正向积分开始累计，不追溯历史积分
- 班级宠物页只展示同班同学的公开宠物信息，不展示成长记录明细与背包内容
- 试卷中的题目是快照，不直接依赖题库原题后续修改

### 3. 本地 Python 运行器

项目内置 `local-runner` 子目录，用于学生电脑本地执行 Python：

- 监听 `127.0.0.1`
- 支持标准输出、标准错误输出
- 支持 `input()` 交互
- 通过 Origin + Token 限制来源
- 默认超时 `300` 秒

对应说明见：

- [local-runner/README.md](local-runner/README.md)

### 4. 实时更新方式

课堂练习、提交状态等实时界面当前使用前端轮询实现，不是 WebSocket。

## 快速开始

### 运行环境

- Node.js 18+
- npm 9+
- 可选：Go 1.22+（仅在需要构建本地运行器时）

### 安装与启动

```bash
npm ci
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

启动后访问：

- [http://localhost:3000](http://localhost:3000)

### 默认测试账号

由 [prisma/seed.ts](prisma/seed.ts) 创建：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 教师 | `teacher` | `123456` |
| 学生 | `student1` | `123456` |
| 学生 | `student2` | `123456` |

## 环境变量

### Web 应用

最少建议配置：

```bash
NEXTAUTH_SECRET=replace-with-your-secret
NEXTAUTH_URL=http://localhost:3000
```

生产环境务必设置：

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### 手机端接口

如果需要对接手机 App，还需要：

```bash
MOBILE_API_TOKEN=your-mobile-api-token
MOBILE_API_OPERATOR_USERNAME=teacher
MOBILE_API_OPERATOR_LABEL=巡课App
```

### 本地运行器对接

网页服务端会读取：

```bash
LOCAL_RUNNER_URL=http://127.0.0.1:18423
LOCAL_RUNNER_SHARED_TOKEN=your-runner-token
LOCAL_RUNNER_TIMEOUT_SECONDS=300
```

如果未设置 `LOCAL_RUNNER_SHARED_TOKEN`，当前代码会回退读取 `MOBILE_API_TOKEN`。

## 部署说明

### 首次部署

```bash
git pull
npm ci
npm run db:generate
npm run db:push
npm run build
```

然后启动服务：

```bash
npm run start
```

### 已有数据的升级部署

当前版本把课堂练习积分相关字段从整数调整为小数。  
如果你的服务器数据库来自旧版本，升级时建议执行：

```bash
git pull
npm ci
npm run db:generate
npx prisma db push --accept-data-loss
npm run build
```

说明：

- 这里的“data loss warning”来自 Prisma 对 `Int -> Float` 的结构变更提示
- 实际场景是整数扩展为浮点，不会清空已有积分

## 本地运行器构建

在 `local-runner` 目录执行：

```bash
go build -o ./bin/local-runner ./cmd/runner
```

打包学生分发版本：

```bash
cd local-runner
./package-release.sh
```

生成的发行包位于：

- `local-runner/release/local-runner-windows-amd64*.zip`
- `local-runner/release/local-runner-linux-amd64.tar.gz`
- `local-runner/release/local-runner-linux-arm64.tar.gz`

## 主要页面与接口

### 页面

- `/login`：登录页
- `/register`：注册页
- `/student`：学生首页 / 作业列表
- `/student/assignment/[id]`：作业编辑页
- `/student/profile`：个人中心
- `/student/practice`：课堂练习页
- `/teacher`：教师首页
- `/teacher/students`：学生管理
- `/teacher/submissions`：作业批阅
- `/teacher/assignment-status`：作业提交状态
- `/teacher/questions`：题库与试卷管理
- `/teacher/practice/[id]`：练习控制台
- `/teacher/papers/[id]`：试卷详情编辑

### 主要 API

- `/api/users`
- `/api/users/import`
- `/api/assignments`
- `/api/submissions`
- `/api/submissions/export`
- `/api/submissions/review-import`
- `/api/assignment-status`
- `/api/assignment-status/detail`
- `/api/questions/import`
- `/api/questions/[id]`
- `/api/papers`
- `/api/papers/import`
- `/api/papers/[id]/questions/[questionId]`
- `/api/practice-sessions`
- `/api/practice-sessions/[id]`
- `/api/student-practice/active`
- `/api/student-practice/question-submit`
- `/api/student-practice/paper-submit`
- `/api/points`
- `/api/mobile/auth/login`
- `/api/mobile/auth/me`
- `/api/mobile/students`
- `/api/mobile/points`

## 项目结构

```text
src/
├── app/
│   ├── api/                         # 业务接口
│   ├── student/                     # 学生端页面
│   └── teacher/                     # 教师端页面
├── components/                      # 公共组件
├── lib/                             # 业务逻辑、鉴权、Prisma、工具函数
prisma/
├── schema.prisma                    # 数据模型
└── seed.ts                          # 测试数据
local-runner/                        # 学生本地 Python 运行器（Go）
docs/
└── mobile-app-integration.md        # 手机端接口说明
```

## 相关文档

- 手机端接口接入说明：
  [docs/mobile-app-integration.md](docs/mobile-app-integration.md)
- 本地运行器说明：
  [local-runner/README.md](local-runner/README.md)

## 当前已实现但值得注意的点

- 课堂练习“实时”依赖轮询，不是 WebSocket
- 填空题、简答题当前是标准答案匹配，不含人工阅卷流
- 删除练习仅允许删除“没有学生答题记录”的会话
- 教师手工加减分仍按整数处理，课堂练习奖励支持 1 位小数
