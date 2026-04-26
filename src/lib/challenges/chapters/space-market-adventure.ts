import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const spaceMarketAdventureChapter: ChallengeChapterDefinition = {
  key: 'space-market-adventure',
  title: '星际集市大冒险',
  theme: 'Python 综合闯关',
  description:
    '你是星际集市的新任调度员，需要用列表、元组、集合、字典、条件分支、循环和函数完成 8 个逐步升级的任务。',
  helpDoc: {
    title: '综合闯关提示卡',
    intro:
      '这一章把前面学过的基础知识放在同一个故事里使用。遇到复杂任务时，先看清要保存到哪些变量，再把问题拆成“存数据、判断、重复处理、封装函数”几步。',
    sections: [
      {
        title: '1. 容器怎么选',
        points: [
          '列表适合保存有顺序、可能变化的一组数据。',
          '元组适合保存不打算修改的一组固定数据，例如坐标。',
          '集合适合去重和判断“是否出现过”。',
          '字典适合用名称查信息，例如用商品名查价格。',
        ],
        exampleTitle: '示例',
        exampleCode: `items = ['能量棒', '维修包']\nbase = (3, 5)\nunique_items = set(items)\nprices = {'能量棒': 6, '维修包': 12}`,
      },
      {
        title: '2. 分支和循环',
        points: [
          'if、elif、else 用来处理不同情况。',
          'for 循环适合逐个处理列表、集合、字典等容器里的数据。',
          'while 循环适合在条件满足时反复执行。',
        ],
        exampleTitle: '示例',
        exampleCode: `score = 86\nif score >= 90:\n    rank = 'S'\nelif score >= 80:\n    rank = 'A'\nelse:\n    rank = 'B'\n\nfor item in items:\n    print(item)`,
      },
      {
        title: '3. 函数的作用',
        points: [
          '函数可以把一段经常使用的代码封装起来。',
          'def 用来定义函数，return 用来返回结果。',
          '函数写好后，要调用它并把返回值保存到题目要求的变量里。',
        ],
        exampleTitle: '示例',
        exampleCode: `def calc_total(price, count):\n    return price * count\n\ntotal = calc_total(6, 4)`,
      },
      {
        title: '4. 做综合题的方法',
        points: [
          '先把题目给的数据读完，不急着写第一行代码。',
          '需要多个结果时，按变量名一个一个完成。',
          '循环里常见做法是先准备空列表、空集合或计数器，再逐步添加结果。',
        ],
      },
    ],
    closingTip: '综合题不要求一行写完，清晰、正确、能解释自己的代码，比炫技更重要。',
  },
  levels: [
    {
      key: 'pack-launch-kit',
      title: '第1关：出发装备清点',
      summary: '创建列表、元组和集合，为冒险准备基础数据。',
      description:
        "任务：1. 创建列表 backpack，内容为 ['星图', '能量棒', '维修包']。2. 创建元组 base_position，内容为 (7, 3)。3. 根据 signals = ['A12', 'B07', 'A12', 'C09', 'B07'] 创建去重后的集合 unique_signals。",
      points: 2,
      initialCode: `signals = ['A12', 'B07', 'A12', 'C09', 'B07']\n\n# 请创建 backpack、base_position、unique_signals\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          backpack: ['星图', '能量棒', '维修包'],
          base_position: [7, 3],
          unique_signals: ['A12', 'B07', 'C09'],
        },
      },
    },
    {
      key: 'repair-inventory',
      title: '第2关：维修摊位补货',
      summary: '用字典记录库存，并练习修改、增加和读取。',
      description:
        "任务：inventory 已给出。\n1. 把 '能量棒' 的库存改为 18。\n2. 新增 '导航芯片'，库存为 6。\n3. 把库存总数保存到 total_stock。",
      points: 3,
      initialCode: `inventory = {'能量棒': 12, '维修包': 5, '星尘电池': 9, '急救包': 4, '护盾发生器': 2, '燃料罐': 15, '电子元件': 18}\n\n# 请直接修改 inventory，并保存 total_stock\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          inventory: {
            能量棒: 18,
            维修包: 5,
            星尘电池: 9,
            导航芯片: 6,
            急救包: 4,
            护盾发生器: 2,
            燃料罐: 15,
            电子元件: 18
          },
          total_stock: 77,
        },
      },
    },
    {
      key: 'gate-pass-check',
      title: '第3关：集市入口安检',
      summary: '使用条件分支判断每位访客的通行等级和是否需要复检。',
      description:
        "任务：(1)请遍历 scores，根据每个字典中的 score 填写 pass_level：90 分及以上为 '金色通行证'，75 到 89 为 '银色通行证'，60 到 74 为 '临时通行证'，60 以下为 '暂缓入场'。\n(2)如果 cargo_count 大于 5 或 has_unknown_signal 为 True，则 need_review 为 True，否则为 False。",
      points: 3,
      initialCode: `scores = [
    {"score": 95, "pass_level": ""},
    {"score": 82, "pass_level": ""},
    {"score": 68, "pass_level": ""},
    {"score": 55, "pass_level": ""},
    {"score": 91, "pass_level": ""},
    {"score": 84, "pass_level": ""},
    {"score": 73, "pass_level": ""},
    {"score": 64, "pass_level": ""},
    {"score": 54, "pass_level": ""}
]
cargo_count = 6
has_unknown_signal = False

# 请修改 scores 中每个字典的 pass_level，并保存 need_review
    `,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          scores: [
            { score: 95, pass_level: '金色通行证' },
            { score: 82, pass_level: '银色通行证' },
            { score: 68, pass_level: '临时通行证' },
            { score: 55, pass_level: '暂缓入场' },
            { score: 91, pass_level: '金色通行证' },
            { score: 84, pass_level: '银色通行证' },
            { score: 73, pass_level: '临时通行证' },
            { score: 64, pass_level: '临时通行证' },
            { score: 54, pass_level: '暂缓入场' },
          ],
          need_review: true,
        },
      },
    },
    {
      key: 'route-energy-plan',
      title: '第4关：补给路线规划',
      summary: '用循环筛选列表、累计数值，并保存路线节点。',
      description:
        '任务：stations 中每个元组表示(站点名, 距离, 能量消耗)。请用循环完成：1. 把能量消耗不超过 8 的站点名保存到 safe_stations。2. 计算总距离 total_distance。3. 计算总能量 total_energy。',
      points: 4,
      initialCode: `stations = [
  ('晨星港', 4, 6),
  ('蓝环站', 7, 9),
  ('银轨仓', 5, 8),
  ('远航门', 9, 12),
  ('雾灯塔', 3, 5),
  ('赤砂驿', 6, 11),
  ('月影桥', 8, 7),
  ('星尘库', 2, 4),
  ('北风口', 10, 13),
]

# 请用循环保存 safe_stations、total_distance、total_energy
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          safe_stations: ['晨星港', '银轨仓', '雾灯塔', '月影桥', '星尘库'],
          total_distance: 54,
          total_energy: 75,
        },
      },
    },
    {
      key: 'discount-terminal',
      title: '第5关：折扣终端调试',
      summary: '定义函数，根据会员等级计算订单实付金额。',
      description:
        "任务：\n定义函数 calc_pay(price, count, vip_level)。\n先计算 price * count；vip_level 为 'gold' 打 8 折，'silver' 打 9 折，其他等级不打折。\n把 calc_pay(15, 4, 'gold')、calc_pay(20, 3, 'silver')、calc_pay(8, 5, 'visitor') 的结果分别保存到 pay_gold、pay_silver、pay_visitor。",
      points: 4,
      initialCode: `# 请定义 calc_pay(price, count, vip_level)\n# 再保存 pay_gold、pay_silver、pay_visitor\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          pay_gold: 48,
          pay_silver: 54,
          pay_visitor: 40,
        },
      },
    },
    {
      key: 'order-tag-map',
      title: '第6关：订单标签整理',
      summary: '综合使用列表、字典、集合和循环整理订单。',
      description:
        "任务：orders 中每个字典是一笔订单。请用循环完成：\n1. 统计每个商品购买次数，保存到 item_count。\n2. 收集所有不同标签，保存到 all_tags。\n3. 找出数量大于等于 2 的订单编号，保存到 big_order_ids。",
      points: 5,
      initialCode: `orders = [\n    {'id': 'A001', 'item': '能量棒', 'count': 3, 'tags': ['食品', '热销']},\n    {'id': 'A002', 'item': '维修包', 'count': 1, 'tags': ['工具']},\n    {'id': 'A003', 'item': '能量棒', 'count': 2, 'tags': ['食品']},\n    {'id': 'A004', 'item': '星尘电池', 'count': 5, 'tags': ['能源', '热销']},\n    {'id': 'A005', 'item': '导航芯片', 'count': 1, 'tags': ['电子', '稀有']},\n    {'id': 'A006', 'item': '维修包', 'count': 4, 'tags': ['工具', '补给']},\n    {'id': 'A007', 'item': '护盾发生器', 'count': 2, 'tags': ['防护', '稀有']},\n    {'id': 'A008', 'item': '能量棒', 'count': 1, 'tags': ['食品', '补给']},\n    {'id': 'A009', 'item': '导航芯片', 'count': 3, 'tags': ['电子', '热销']},\n    {'id': 'A010', 'item': '星尘电池', 'count': 2, 'tags': ['能源']},\n]\n\n# 请保存 item_count、all_tags、big_order_ids\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          item_count: {
            能量棒: 3,
            维修包: 2,
            星尘电池: 2,
            导航芯片: 2,
            护盾发生器: 1,
          },
          all_tags: ['工具', '热销', '电子', '稀有', '能源', '补给', '防护', '食品'],
          big_order_ids: ['A001', 'A003', 'A004', 'A006', 'A007', 'A009', 'A010'],
        },
      },
    },
    {
      key: 'signal-while-rescue',
      title: '第7关：信号塔倒计时救援',
      summary: '使用 while 循环处理倒计时，并配合分支保存状态。',
      description:
        "任务：energy 表示信号塔剩余能量。每轮 while 循环消耗 7 点能量，直到 energy 小于等于 0。请保存：1. rounds 为循环执行次数。2. log 为每轮结束后的剩余能量列表。3. final_status：如果 rounds 小于等于 4，值为 '及时完成'，否则为 '超时风险'。",
      points: 5,
      initialCode: `energy = 31\n\n# 请用 while 循环保存 rounds、log、final_status\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          rounds: 5,
          log: [24, 17, 10, 3, -4],
          final_status: '超时风险',
        },
      },
    },
    {
      key: 'final-market-report',
      title: '第8关：终极集市报告',
      summary: '把函数、循环、分支和四类容器组合成完整结算。',
      description:
        "请完成函数 build_report(orders, price_map, vip_names)。\norders 中每个元组表示(顾客名, 商品名, 数量)。\n函数需要返回字典 report，包含：\n1. total_income：总收入，vip_names 中的顾客打 8 折。\n2. vip_buyers：购买过商品的 VIP 顾客列表，按首次出现顺序。\n3. normal_buyers：非 VIP 顾客集合。\n4. item_sales：每种商品售出数量字典。\n最后调用函数，把结果保存到 final_report。",
      points: 6,
      initialCode: `orders = [\n    ('林小星', '能量棒', 3),\n    ('周远航', '维修包', 1),\n    ('林小星', '星尘电池', 2),\n    ('许晨光', '能量棒', 4),\n    ('周远航', '导航芯片', 2),\n]\nprice_map = {'能量棒': 10, '维修包': 30, '星尘电池': 25, '导航芯片': 40}\nvip_names = {'林小星', '许晨光'}\n\n# 请定义 build_report(orders, price_map, vip_names)\n# 最后把调用结果保存到 final_report\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          final_report: {
            total_income: 230,
            vip_buyers: ['林小星', '许晨光'],
            normal_buyers: ['周远航'],
            item_sales: {
              能量棒: 7,
              维修包: 1,
              星尘电池: 2,
              导航芯片: 2,
            },
          },
        },
      },
    },
  ],
}
