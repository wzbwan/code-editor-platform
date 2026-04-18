import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const listMilkTeaChapter: ChallengeChapterDefinition = {
  key: 'list-milk-tea',
  title: '经营奶茶店',
  theme: 'Python 列表',
  description:
    '你是奶茶店的小程序管理员，需要用 Python 列表快速处理订单、销量和巡店任务。',
  helpDoc: {
    title: '列表基础速查',
    intro:
      '这一章主要围绕 Python 列表的创建、索引、增删改查、统计与遍历。先理解“列表是有顺序、可修改、可重复”的数据结构，再进入闯关会更顺手。',
    sections: [
      {
        title: '1. 列表是什么',
        points: [
          '列表用方括号定义，例如 [1, 2, 3]。',
          '列表中的元素有顺序，可以通过索引访问。',
          '列表可以存放重复元素，也可以同时存放多种类型的数据。',
        ],
        exampleTitle: '示例',
        exampleCode: `cities = ['北京', '上海', '深圳']\nprint(cities[0])\nprint(cities[-1])`,
      },
      {
        title: '2. 常见增删改查',
        points: [
          'append(x) 在末尾增加一个元素。',
          'insert(i, x) 在指定位置插入元素。',
          'remove(x) 删除指定元素，pop(i) 删除指定索引处的元素。',
          '通过 list[i] = 新值 可以直接修改元素。',
        ],
        exampleTitle: '示例',
        exampleCode: `items = ['铅笔', '橡皮']\nitems.append('尺子')\nitems.insert(1, '钢笔')\nitems[0] = '自动铅笔'`,
      },
      {
        title: '3. 统计与遍历',
        points: [
          'len() 统计元素个数，sum() 适用于数字列表求和。',
          'max() 和 min() 可以求最大值和最小值。',
          'for item in items 适合逐个遍历元素。',
          'enumerate(items, start=1) 适合一边遍历一边拿序号。',
        ],
        exampleTitle: '示例',
        exampleCode: `scores = [78, 92, 85]\nprint(len(scores))\nprint(max(scores))\nfor index, score in enumerate(scores, start=1):\n    print(index, score)`,
      },
    ],
    closingTip: '做题时优先把结果保存到题目要求的变量里，再考虑是否打印输出。',
  },
  levels: [
    {
      key: 'create-orders',
      title: '第一关：创建订单本',
      summary: '创建订单列表和一个空的 VIP 订单列表。',
      description:
        "任务：1. 新建列表 orders，内容为 ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']。2. 再创建一个空列表 vip_orders。",
      points: 2,
      initialCode: `# 创建订单列表 orders\n# 再创建一个空列表 vip_orders\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          orders: ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水'],
          vip_orders: [],
        },
      },
    },
    {
      key: 'find-orders',
      title: '第二关：快速找订单',
      summary: '通过索引找到第一个订单、最后一个订单和指定订单。',
      description:
        '任务：请从 orders 中取出第 1 个订单、最后 1 个订单、以及“芋泥波波”，分别保存到 first_order、last_order、target_order。',
      points: 2,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']\n\n# 请把结果保存到 first_order、last_order、target_order\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_order: '珍珠奶茶',
          last_order: '柠檬水',
          target_order: '芋泥波波',
        },
      },
    },
    {
      key: 'add-orders',
      title: '第三关：突发加单',
      summary: '练习 append、insert、extend 三种新增方式。',
      description:
        "任务：1. 在末尾添加 '百香果双响炮'。2. 在第 2 个位置插入 '芝士葡萄'。3. 再批量添加 ['红豆奶茶', '椰椰奶冻']。最终结果保存在 orders 中。",
      points: 3,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']\n\n# 请直接修改 orders\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          orders: [
            '珍珠奶茶',
            '芝士葡萄',
            '杨枝甘露',
            '芋泥波波',
            '柠檬水',
            '百香果双响炮',
            '红豆奶茶',
            '椰椰奶冻',
          ],
        },
      },
    },
    {
      key: 'update-order',
      title: '第四关：客户改单',
      summary: '根据索引修改列表中的指定元素。',
      description:
        "任务：把 orders 中的 '柠檬水' 改成 '冰柠美式'，并保留在 orders 变量中。",
      points: 2,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']\n\n# 请直接修改 orders\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          orders: ['珍珠奶茶', '杨枝甘露', '芋泥波波', '冰柠美式'],
        },
      },
    },
    {
      key: 'remove-order',
      title: '第五关：客户退单',
      summary: '删除指定订单，并清空测试列表。',
      description:
        "任务：1. 从 orders 中删除第 2 个订单。2. 再删除 '芋泥波波'。3. 清空 test_orders。最终保持 orders_after_remove 和 test_orders_after_clear 两个变量。",
      points: 3,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']\ntest_orders = ['测试1', '测试2']\n\n# 请把处理后的结果分别保存到 orders_after_remove 和 test_orders_after_clear\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          orders_after_remove: ['珍珠奶茶', '柠檬水'],
          test_orders_after_clear: [],
        },
      },
    },
    {
      key: 'count-hot',
      title: '第六关：统计爆款',
      summary: '使用 index 和 count 统计列表中的热门饮品。',
      description:
        "任务：请把 '珍珠奶茶' 第一次出现的下标保存到 first_index，把出现次数保存到 milk_tea_count。",
      points: 2,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '珍珠奶茶', '芋泥波波', '珍珠奶茶']\n\n# 请把结果保存到 first_index 和 milk_tea_count\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_index: 0,
          milk_tea_count: 3,
        },
      },
    },
    {
      key: 'sales-ranking',
      title: '第七关：今日销量榜',
      summary: '统计销量总和、极值、数量，并输出降序榜单。',
      description:
        '任务：请把总销量、最高销量、最低销量、订单个数、降序排序结果，分别保存到 total_sales、max_sales、min_sales、sales_count、sorted_sales_desc。',
      points: 4,
      initialCode: `sales = [23, 15, 31, 8, 40, 19]\n\n# 请把结果保存到 total_sales、max_sales、min_sales、sales_count、sorted_sales_desc\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          total_sales: 136,
          max_sales: 40,
          min_sales: 8,
          sales_count: 6,
          sorted_sales_desc: [40, 31, 23, 19, 15, 8],
        },
      },
    },
    {
      key: 'loop-orders',
      title: '第八关：店长巡店',
      summary: '用 for、while、enumerate 依次输出订单。',
      description:
        '任务：1. 用 for 循环逐行输出订单名。2. 用 while 循环逐行输出订单名。3. 用 enumerate() 输出“第1单：珍珠奶茶”这种格式。输出顺序要与任务顺序一致。',
      points: 4,
      initialCode: `orders = ['珍珠奶茶', '杨枝甘露', '芋泥波波', '柠檬水']\n\n# 第一段：for 循环输出每个订单\n# 第二段：while 循环输出每个订单\n# 第三段：用 enumerate 输出“第1单：珍珠奶茶”这样的内容\n`,
      judge: {
        mode: 'OUTPUT',
        expectedOutput: `珍珠奶茶
杨枝甘露
芋泥波波
柠檬水
珍珠奶茶
杨枝甘露
芋泥波波
柠檬水
第1单：珍珠奶茶
第2单：杨枝甘露
第3单：芋泥波波
第4单：柠檬水`,
      },
    },
  ],
}
