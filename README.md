# Python代码编辑器平台

一个基于Next.js的Python代码编辑和作业提交平台，核心特性是编辑器禁止粘贴，学生必须手动输入代码。

## 功能特性

### 学生端
- 查看作业列表和详情
- **禁止粘贴的代码编辑器**（核心功能）
- Python语法高亮
- 提交作业并查看批阅结果

### 教师端
- 管理学生账号（添加/删除）
- 创建和管理作业
- 批阅学生提交的代码

## 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: SQLite + Prisma ORM
- **认证**: NextAuth.js
- **代码编辑器**: react-simple-code-editor + prism-react-renderer

## 快速开始

```bash
# 进入项目目录
cd code-editor-platform

# 安装依赖
npm install

# 生成Prisma客户端
npm run db:generate

# 初始化数据库并填充测试数据
npm run db:push
npm run db:seed

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 访问应用。

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 教师 | teacher | 123456 |
| 学生 | student1 | 123456 |
| 学生 | student2 | 123456 |

## 项目结构

```
src/
├── app/
│   ├── api/           # API路由
│   ├── login/         # 登录页
│   ├── register/      # 注册页
│   ├── student/       # 学生端页面
│   │   └── assignment/[id]/  # 作业编辑页
│   └── teacher/       # 教师端页面
│       ├── students/  # 学生管理
│       └── submissions/ # 批阅作业
├── components/        # 公共组件
│   ├── CodeEditor.tsx # 代码编辑器（禁止粘贴）
│   └── Navbar.tsx     # 导航栏
├── lib/               # 工具函数
│   ├── auth.ts        # 认证工具
│   └── prisma.ts      # 数据库客户端
└── types/             # TypeScript类型定义
```

## 核心功能说明

### 禁止粘贴的代码编辑器

编辑器实现了以下防粘贴措施：
1. 阻止 `Ctrl/Cmd + V` 快捷键
2. 阻止右键粘贴
3. 监听全局粘贴事件
4. 尝试粘贴时显示警告提示
