import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const policeDutyDataCenterChapter: ChallengeChapterDefinition = {
  key: 'police-duty-data-center',
  title: '警务值班数据中心',
  theme: 'Python 基础综合闯关',
  description: '你是警务值班室的数据助理，需要用 Python 整理接警单、巡逻队列、警情分类、车辆关注名单和每日警务报告。',
  helpDoc: {
    title: '警务数据闯关提示卡',
    intro: '这一章根据讲义中的变量、数据类型、分支、循环、字符串、列表、元组、集合、字典、函数、lambda 与列表推导式设计。做题时先看清要求保存哪些变量，再一步一步补全或修复代码。',
    sections: [
      {
        title: '1. 变量、类型与字符串',
        points: [
          '变量使用 变量名 = 值 创建，字符串要放在引号中，数字和布尔值不要随意写成字符串。',
          '字符串可以用 strip() 去掉两端空白，用 split() 拆分字段，用 replace() 替换片段。',
          '如果题目要求保存变量，必须把计算结果赋值给指定变量，只 print 不会通过变量判题。',
        ],
        exampleTitle: '示例',
        exampleCode: 'raw = \'  J001-北区-已接警  \'\\nclean = raw.strip()\\nparts = clean.split(\'-\')',
      },
      {
        title: '2. 分支、循环与容器',
        points: [
          'if、elif、else 适合根据分数、状态、人数等条件分类，边界值要写成 >= 或 <=。',
          '列表适合保存有顺序的数据，append、insert、pop、remove、len 都是常见操作。',
          '集合适合去重，字典适合保存 key 到 value 的映射；遍历字典时可以使用 for key in 字典。',
        ],
        exampleTitle: '示例',
        exampleCode: 'levels = []\\nfor score in scores:\\n    if score >= 90:\\n        levels.append(\'红色预警\')',
      },
      {
        title: '3. 函数与列表推导式',
        points: [
          '函数用 def 定义，通常用 return 返回结果，调用函数后要把返回值保存到变量。',
          '列表推导式可以把循环筛选写得更简洁，例如 [x for x in nums if x >= 80]。',
          'sorted、max 等函数可以配合 key=lambda item: item[\'score\'] 按字典字段排序或取最大值。',
        ],
      },
    ],
    closingTip: '前几关适合直接补变量或修复一两行代码；后几关先写出中间变量，再逐步组装报告字典。',
  },
  levels: [
    {
      key: 'create-case-card',
      title: '第1关：填写接警单',
      summary: '补全基础变量，并整理成接警单字典。',
      description: '任务：请补全代码，创建一张接警单。警员姓名 officer 为 \'李明\'；派出所 station 为 \'青城派出所\'；警情编号 case_id 为 \'NM-2026-001\'；风险分 risk_score 为整数 3；是否紧急 is_urgent 为 False。最后保持 case_card 字典内容正确。',
      points: 2,
      initialCode: `officer = None
station = None
case_id = None
risk_score = None
is_urgent = None

case_card = {
    'officer': officer,
    'station': station,
    'case_id': case_id,
    'risk_score': risk_score,
    'is_urgent': is_urgent,
}
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          case_card: {
            officer: '李明',
            station: '青城派出所',
            case_id: 'NM-2026-001',
            risk_score: 3,
            is_urgent: false,
          },
        },
      },
    },
    {
      key: 'prepare-patrol-route',
      title: '第2关：准备巡逻路线',
      summary: '补全列表、元组、索引取值和长度统计。',
      description: '任务：请补全代码。patrol_points 是列表，依次为 \'北门\'、\'东门\'、\'南门\'、\'西门\'；fixed_pair 是元组，内容为 \'110接警台\' 和 \'视频巡查岗\'；first_point 保存 patrol_points 的第一个点位；last_point 保存最后一个点位。',
      points: 2,
      initialCode: `patrol_points = None
fixed_pair = None
first_point = None
last_point = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          patrol_points: [
            '北门',
            '东门',
            '南门',
            '西门',
          ],
          fixed_pair: [
            '110接警台',
            '视频巡查岗',
          ],
          first_point: '北门',
          last_point: '西门',
        },
      },
    },
    {
      key: 'clean-alarm-text',
      title: '第3关：清洗接警文本',
      summary: '使用 split 处理一条接警文本。',
      description: '任务：raw_alarm 中保存了一条接警文本。请保存 parts 为按 \'-\' 拆分后的列表；station 为派出所名称；case_type 为警情类型；status 为原始状态。',
      points: 2,
      initialCode: `raw_alarm = '110-青城派出所-噪音警情-已接警'

parts = None
station = None
case_type = None
status = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          parts: [
            '110',
            '青城派出所',
            '噪音警情',
            '已接警',
          ],
          station: '青城派出所',
          case_type: '噪音警情',
          status: '已接警',
        },
      },
    },
    {
      key: 'fix-dispatch-queue',
      title: '第4关：修复出警队列',
      summary: '列表增改代码，得到正确出警队列。',
      description: '请完成队列整理：在队尾追加 \'巡逻D组\'；把 \'巡逻C组\' 改成 \'视频巡查组\'。',
      points: 3,
      initialCode: `queue = ['巡逻A组', '巡逻B组', '巡逻C组']

# 提示：列表常用的方法有append, extend, insert, pop, remove, sort等

`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '巡逻A组',
            '巡逻B组',
            '视频巡查组',
            '巡逻D组',
          ],
        },
      },
    },
    {
      key: 'fix-risk-levels',
      title: '第5关：修复预警等级',
      summary: '修复分支边界条件和列表追加内容。',
      description: '下面代码有错误。请修复后，让每个分数得到正确预警等级。规则：90 分及以上为 \'红色预警\'；70 到 89 为 \'橙色关注\'；40 到 69 为 \'黄色观察\'；40 以下为 \'绿色正常\'。最后保存 risk_levels。',
      points: 3,
      initialCode: `scores = [95, 70, 40, 12, 90]
risk_levels = []

for score in scores:
    if score > 90:
        level = '红色预警'
    elif score > 70:
        level = '橙色关注'
    elif score > 40:
        level = '黄色观察'
    else:
        level = '绿色正常'
    risk_levels.append(score)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          risk_levels: [
            '红色预警',
            '橙色关注',
            '黄色观察',
            '绿色正常',
            '红色预警',
          ],
        },
      },
    },
    {
      key: 'fix-valid-call-types',
      title: '第6关：修复警情类型统计',
      summary: '过滤空值和重复项，统计有效警情类型。',
      description: '下面代码要统计有效警情类型。空字符串和 None 不计入有效警情；重复类型只保留第一次出现。请修复代码，保存 valid_types 和 valid_count。',
      points: 3,
      initialCode: `call_types = ['噪音', '走失', '噪音', '', '交通', None, '求助', '走失']

valid_types = []
valid_count = 0

for call_type in call_types:
    if call_type == '' and call_type == None:
        continue
    
    valid_types.append(call_type)
    valid_count = valid_count + 1
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          valid_types: [
            '噪音',
            '走失',
            '交通',
            '求助',
          ],
          valid_count: 4,
        },
      },
    },
    {
      key: 'count-incident-status',
      title: '第7关：统计警情状态',
      summary: '用循环和分支统计已处置数量、待跟进编号和涉及人数。',
      description: '任务：incidents 中每个字典是一条警情。请用循环完成：handled_count 为 status 等于 \'已处置\' 的数量；pending_ids 为 status 等于 \'待跟进\' 的警情编号列表，按出现顺序保存；total_people 为所有警情涉及人数合计。',
      points: 4,
      initialCode: `incidents = [
    {'id': 'J001', 'type': '求助', 'status': '已处置', 'people': 2},
    {'id': 'J002', 'type': '纠纷', 'status': '待跟进', 'people': 4},
    {'id': 'J003', 'type': '交通', 'status': '已处置', 'people': 1},
    {'id': 'J004', 'type': '走失', 'status': '待跟进', 'people': 1},
]

handled_count = 0
pending_ids = []
total_people = 0

# 请用循环保存 handled_count、pending_ids、total_people
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          handled_count: 2,
          pending_ids: [
            'J002',
            'J004',
          ],
          total_people: 8,
        },
      },
    },
    {
      key: 'sort-alert-board',
      title: '第8关：整理预警看板',
      summary: '使用列表推导式和 lambda 排序整理预警数据。',
      description: '任务：alerts 中每个字典是一条预警。请完成：high_alert_ids 为 score 大于等于 80 的编号列表，按原顺序保存；sorted_alert_ids 为按 score 从高到低排序后的编号列表。建议使用列表推导式和 sorted(..., key=lambda item: item[\'score\'], reverse=True)。',
      points: 4,
      initialCode: `alerts = [
    {'id': 'A01', 'area': '北区', 'score': 82},
    {'id': 'A02', 'area': '南区', 'score': 57},
    {'id': 'A03', 'area': '东区', 'score': 95},
    {'id': 'A04', 'area': '西区', 'score': 70},
]

# 请保存 high_alert_ids、sorted_alerts、sorted_alert_ids
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          high_alert_ids: [
            'A01',
            'A03',
          ],
          sorted_alert_ids: [
            'A03',
            'A01',
            'A04',
            'A02',
          ],
        },
      },
    },
    {
      key: 'build-dispatch-plan',
      title: '第9关：生成处警建议',
      summary: '定义函数，根据警情类型、人数和紧急标记返回处警建议。',
      description: '任务：定义函数 build_plan(category, people, urgent=False)。规则：如果 urgent 为 True 或 people 大于等于 5，返回 {\'level\': \'一级\', \'action\': \'立即增援\'}；否则如果 category 是 \'纠纷\' 或 \'交通事故\'，或 people 大于等于 3，返回 {\'level\': \'二级\', \'action\': \'民警到场\'}；其他情况返回 {\'level\': \'三级\', \'action\': \'电话回访\'}。最后按初始代码中的三次调用保存 plan_a、plan_b、plan_c。',
      points: 4,
      initialCode: `# 请定义 build_plan(category, people, urgent=False)

plan_a = build_plan('走失', 1, urgent=True)
plan_b = build_plan('纠纷', 3)
plan_c = build_plan('咨询', 1)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          plan_a: {
            level: '一级',
            action: '立即增援',
          },
          plan_b: {
            level: '二级',
            action: '民警到场',
          },
          plan_c: {
            level: '三级',
            action: '电话回访',
          },
        },
      },
    },
    {
      key: 'aggregate-area-cases',
      title: '第10关：汇总辖区警情',
      summary: '使用 for 循环把字符串列表转换为字典列表。',
      description: '任务：raw_incidents 中每条数据都是字符串，格式为 "编号-辖区-警情类型-风险分-状态"。请使用 for 循环遍历 raw_incidents，先用 split("-") 拆分字段，再把每条警情整理成字典，最后保存到 incidents 列表中。每个字典包含 id、area、type、score、status 五个键，其中 score 要转换为整数。',
      points: 5,
      initialCode: `raw_incidents = [
    'J001-北区-纠纷-82-已处置',
    'J002-北区-噪音-55-待跟进',
    'J003-南区-走失-96-待跟进',
    'J004-北区-纠纷-76-已处置',
    'J005-南区-求助-64-待跟进',
    'J006-东区-交通-91-待跟进',
]

incidents = []

# 请用 for 循环遍历 raw_incidents，把每条字符串转换成字典后加入 incidents
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          incidents: [
            {
              id: 'J001',
              area: '北区',
              type: '纠纷',
              score: 82,
              status: '已处置',
            },
            {
              id: 'J002',
              area: '北区',
              type: '噪音',
              score: 55,
              status: '待跟进',
            },
            {
              id: 'J003',
              area: '南区',
              type: '走失',
              score: 96,
              status: '待跟进',
            },
            {
              id: 'J004',
              area: '北区',
              type: '纠纷',
              score: 76,
              status: '已处置',
            },
            {
              id: 'J005',
              area: '南区',
              type: '求助',
              score: 64,
              status: '待跟进',
            },
            {
              id: 'J006',
              area: '东区',
              type: '交通',
              score: 91,
              status: '待跟进',
            },
          ],
        },
      },
    },
    {
      key: 'build-daily-duty-report',
      title: '第11关：生成民警考核结果',
      summary: '根据民警考核数据，计算综合成绩并划分等级。',
      description: '任务：officers 中每个字典保存一名民警的考核数据，包括姓名、年龄、性别、体能成绩、理论成绩、射击成绩。请使用循环生成新列表 result。result 中每个字典包含：name、age、gender、total_score、level。total_score 为体能成绩、理论成绩、射击成绩三项之和；level 根据综合成绩划分：270 分及以上为 "优秀"，240 到 269 分为 "良好"，240 分以下为 "不合格"。',
      points: 5,
      initialCode: `officers = [
    {'name': '李明', 'age': 28, 'gender': '男', 'physical': 92, 'theory': 88, 'shooting': 91},
    {'name': '王芳', 'age': 31, 'gender': '女', 'physical': 85, 'theory': 90, 'shooting': 86},
    {'name': '张伟', 'age': 35, 'gender': '男', 'physical': 78, 'theory': 82, 'shooting': 80},
    {'name': '赵敏', 'age': 26, 'gender': '女', 'physical': 95, 'theory': 94, 'shooting': 96},
    {'name': '刘强', 'age': 40, 'gender': '男', 'physical': 70, 'theory': 76, 'shooting': 72},
    {'name': '陈晨', 'age': 29, 'gender': '女', 'physical': 88, 'theory': 84, 'shooting': 83},
    {'name': '孙磊', 'age': 33, 'gender': '男', 'physical': 60, 'theory': 68, 'shooting': 65},
    {'name': '周静', 'age': 27, 'gender': '女', 'physical': 90, 'theory': 92, 'shooting': 89},
]

result = []

# 请用循环生成 result，每项包含 name、age、gender、total_score、level
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          result: [
            {
              name: '李明',
              age: 28,
              gender: '男',
              total_score: 271,
              level: '优秀',
            },
            {
              name: '王芳',
              age: 31,
              gender: '女',
              total_score: 261,
              level: '良好',
            },
            {
              name: '张伟',
              age: 35,
              gender: '男',
              total_score: 240,
              level: '良好',
            },
            {
              name: '赵敏',
              age: 26,
              gender: '女',
              total_score: 285,
              level: '优秀',
            },
            {
              name: '刘强',
              age: 40,
              gender: '男',
              total_score: 218,
              level: '不合格',
            },
            {
              name: '陈晨',
              age: 29,
              gender: '女',
              total_score: 255,
              level: '良好',
            },
            {
              name: '孙磊',
              age: 33,
              gender: '男',
              total_score: 193,
              level: '不合格',
            },
            {
              name: '周静',
              age: 27,
              gender: '女',
              total_score: 271,
              level: '优秀',
            },
          ],
        },
      },
    },
    {
      key: 'build-vehicle-watch',
      title: '第12关：整理车辆关注名单',
      summary: '定义函数，解析字符串记录并生成车辆关注报告。',
      description: '任务：定义函数 build_vehicle_watch(lines)。每条有效记录格式为 \'车牌,辖区,状态\'。要求：空字符串和拆分后不是 3 段的记录算 invalid_count；watched_plates 为状态等于 \'重点\' 的车牌列表。最后调用函数并保存 vehicle_report。\n vehicle_report为字典，包含invalid_count和watched_plates两个键。',
      points: 5,
      initialCode: `vehicle_lines = [
    '蒙A21023,北区,正常',
    '蒙B37788,南区,重点',
    '',
    '蒙A41023,北区,正常',
    '蒙C59001,东区,重点',
    '错误记录',
    '蒙D63366,北区,正常',
]

# 请定义 build_vehicle_watch(lines)

vehicle_report = build_vehicle_watch(vehicle_lines)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          vehicle_report: {
            invalid_count: 2,
            watched_plates: [
              '蒙B37788',
              '蒙C59001',
            ],
          },
        },
      },
    },
    
  ],
}
