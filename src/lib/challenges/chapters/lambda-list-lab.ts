import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const lambdaListLabChapter: ChallengeChapterDefinition = {
  key: 'lambda-list-lab',
  title: '数据速写实验室',
  theme: 'lambda 与列表推导式',
  description:
    '你是数据速写实验室的 Python 小助手，需要用 lambda、map、filter、sorted、max 和列表推导式快速整理学习与商品数据。',
  helpDoc: {
    title: 'lambda 与列表推导式提示卡',
    intro:
      '这一章练习用更简洁、更 Pythonic 的方式处理数据。做题时先确认要保存哪些变量，再判断适合用列表推导式、map/filter，还是给 sorted/max 提供 lambda 排序规则。',
    sections: [
      {
        title: '1. lambda 的基本写法',
        points: [
          'lambda 可以创建一个没有名字的小函数，格式是 lambda 参数: 返回值。',
          'lambda 适合写一行就能说明白的小规则，例如取字典里的分数或价格。',
          '如果逻辑需要多行判断，更适合用 def 定义普通函数。',
        ],
        exampleTitle: '示例',
        exampleCode: `add = lambda x, y: x + y\nresult = add(3, 5)`,
      },
      {
        title: '2. 列表推导式',
        points: [
          '列表推导式可以快速生成新列表，格式是 [表达式 for 变量 in 列表]。',
          '如果要筛选元素，可以在后面加 if 条件。',
          '如果每个元素都要保留，只是根据条件转换成不同结果，可以把 if-else 写在表达式位置。',
        ],
        exampleTitle: '示例',
        exampleCode: `nums = [1, 2, 3, 4]\ndoubles = [x * 2 for x in nums]\nevens = [x for x in nums if x % 2 == 0]`,
      },
      {
        title: '3. map、filter 和排序规则',
        points: [
          'map(lambda x: ..., data) 会把同一个变换应用到每个元素上，通常需要用 list() 转成列表。',
          'filter(lambda x: 条件, data) 会筛出满足条件的元素，也通常需要用 list() 转成列表。',
          'sorted(data, key=lambda item: item["字段"]) 和 max(data, key=lambda item: item["字段"]) 常用于处理字典列表。',
        ],
        exampleTitle: '示例',
        exampleCode: `students = [{'name': 'Alice', 'score': 88}, {'name': 'Bob', 'score': 95}]\nranking = sorted(students, key=lambda s: s['score'], reverse=True)\nbest = max(students, key=lambda s: s['score'])`,
      },
    ],
    closingTip:
      '列表推导式更适合“生成新列表”，lambda 更适合“临时告诉函数一个规则”。不要为了写得短而牺牲清晰度。',
  },
  levels: [
    {
      key: 'double-likes',
      title: '第1关：点赞翻倍',
      summary: '用最基础的列表推导式把每个数字乘 2。',
      description:
        '任务：likes 是几条动态的点赞数。请使用列表推导式，把每个点赞数翻倍，并保存到 new_likes。',
      points: 2,
      initialCode: `likes = [3, 10, 25, 7]\n\n# 请使用列表推导式保存 new_likes\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          new_likes: [6, 20, 50, 14],
        },
      },
    },
    {
      key: 'pick-passed-scores',
      title: '第2关：筛选及格分',
      summary: '用带 if 的列表推导式筛选分数。',
      description:
        '任务：请从 scores 中筛选出大于等于 60 的分数，按原顺序保存到 passed_scores。',
      points: 2,
      initialCode: `scores = [45, 78, 90, 32, 66]\n\n# 请使用列表推导式保存 passed_scores\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          passed_scores: [78, 90, 66],
        },
      },
    },
    {
      key: 'make-today-menu',
      title: '第3关：生成今日菜单',
      summary: '用列表推导式把字符串批量加工成新列表。',
      description:
        "任务：请把 drinks 中每个饮品后面加上 ' - 今日推荐'，生成菜单列表 menu。",
      points: 2,
      initialCode: `drinks = ['珍珠奶茶', '柠檬茶', '芋泥波波']\n\n# 请使用列表推导式保存 menu\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          menu: ['珍珠奶茶 - 今日推荐', '柠檬茶 - 今日推荐', '芋泥波波 - 今日推荐'],
        },
      },
    },
    {
      key: 'score-labels',
      title: '第4关：成绩评价速写',
      summary: '用带 if-else 的列表推导式把成绩转换成评价。',
      description:
        "任务：请把 scores 转换成评价列表 score_labels。规则：90 分及以上为 '优秀'，60 到 89 为 '及格'，60 以下为 '不及格'。每个分数都要对应一个评价。",
      points: 3,
      initialCode: `scores = [95, 82, 59, 40, 76]\n\n# 请使用带 if-else 的列表推导式保存 score_labels\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          score_labels: ['优秀', '及格', '不及格', '不及格', '及格'],
        },
      },
    },
    {
      key: 'map-triple-numbers',
      title: '第5关：map 批量三倍',
      summary: '用 map 和 lambda 对列表元素做同一变换。',
      description:
        '任务：请使用 map 和 lambda，把 nums 中每个数字变成三倍，并用 list() 转成列表，保存到 triple_nums。',
      points: 3,
      initialCode: `nums = [2, 4, 6, 8]\n\n# 请使用 map 和 lambda 保存 triple_nums\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          triple_nums: [6, 12, 18, 24],
        },
      },
    },
    {
      key: 'filter-active-students',
      title: '第6关：filter 找活跃同学',
      summary: '用 filter 和 lambda 筛选字典列表。',
      description:
        "任务：students 中记录了同学的练习次数。请使用 filter 和 lambda 筛选 practice_count 大于等于 5 的同学，结果转成列表保存到 active_students；再用列表推导式从 active_students 中取出姓名，保存到 active_names。",
      points: 4,
      initialCode: `students = [\n    {'name': '林小星', 'practice_count': 6},\n    {'name': '周远航', 'practice_count': 3},\n    {'name': '许晨光', 'practice_count': 5},\n    {'name': '沈知秋', 'practice_count': 8},\n]\n\n# 请保存 active_students 和 active_names\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          active_students: [
            { name: '林小星', practice_count: 6 },
            { name: '许晨光', practice_count: 5 },
            { name: '沈知秋', practice_count: 8 },
          ],
          active_names: ['林小星', '许晨光', '沈知秋'],
        },
      },
    },
    {
      key: 'sort-student-ranking',
      title: '第7关：成绩排行榜',
      summary: '用 sorted、max 和 lambda 处理学生字典列表。',
      description:
        "任务：请用 sorted 和 lambda 按 score 从高到低给 students 排序，保存到 ranking；再用 max 和 lambda 找到分数最高的同学，保存到 top_student；最后用列表推导式取出排名姓名，保存到 ranking_names。",
      points: 4,
      initialCode: `students = [\n    {'name': 'Alice', 'score': 88},\n    {'name': 'Bob', 'score': 95},\n    {'name': 'Cindy', 'score': 79},\n    {'name': 'David', 'score': 92},\n]\n\n# 请保存 ranking、top_student、ranking_names\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          ranking: [
            { name: 'Bob', score: 95 },
            { name: 'David', score: 92 },
            { name: 'Alice', score: 88 },
            { name: 'Cindy', score: 79 },
          ],
          top_student: { name: 'Bob', score: 95 },
          ranking_names: ['Bob', 'David', 'Alice', 'Cindy'],
        },
      },
    },
    {
      key: 'build-shop-report',
      title: '第8关：商品数据报告',
      summary: '综合使用列表推导式、lambda 排序和 max 完成小型数据报告。',
      description:
        "任务：products 中记录了商品名、价格和库存。请完成 4 个结果：1. affordable_names：价格小于等于 50 的商品名列表，按原顺序。2. total_values：每个商品的库存总价值列表，计算 price * stock。3. price_ranking：按 price 从低到高排序后的商品列表。4. most_stock_product：库存 stock 最大的商品。",
      points: 5,
      initialCode: `products = [\n    {'name': '键盘贴纸', 'price': 12, 'stock': 30},\n    {'name': '数据线', 'price': 29, 'stock': 18},\n    {'name': '机械键盘', 'price': 199, 'stock': 6},\n    {'name': '鼠标垫', 'price': 35, 'stock': 25},\n    {'name': '显示器支架', 'price': 89, 'stock': 9},\n]\n\n# 请保存 affordable_names、total_values、price_ranking、most_stock_product\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          affordable_names: ['键盘贴纸', '数据线', '鼠标垫'],
          total_values: [360, 522, 1194, 875, 801],
          price_ranking: [
            { name: '键盘贴纸', price: 12, stock: 30 },
            { name: '数据线', price: 29, stock: 18 },
            { name: '鼠标垫', price: 35, stock: 25 },
            { name: '显示器支架', price: 89, stock: 9 },
            { name: '机械键盘', price: 199, stock: 6 },
          ],
          most_stock_product: { name: '键盘贴纸', price: 12, stock: 30 },
        },
      },
    },
  ],
}
