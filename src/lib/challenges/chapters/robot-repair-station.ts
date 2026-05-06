import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const robotRepairStationChapter: ChallengeChapterDefinition = {
  key: 'robot-repair-station',
  title: '机器人维修站',
  theme: 'Python 面向对象',
  description:
    '你是星港维修站的新任工程师，需要用类、实例、属性、方法、类属性、类方法和静态方法，让一批机器人重新投入任务。',
  helpDoc: {
    title: '面向对象闯关提示卡',
    intro:
      '这一章围绕 Python 面向对象基础展开。类像一张制造图纸，实例是按图纸造出来的具体对象；属性描述对象有什么，方法描述对象能做什么。',
    sections: [
      {
        title: '1. 类与实例',
        points: [
          '用 class 定义类，类名通常使用大驼峰命名法，例如 RepairBot。',
          '调用类名并传入参数，可以创建一个实例对象。',
          '通过 实例.__dict__ 可以查看实例身上的属性。',
        ],
        exampleTitle: '示例',
        exampleCode: `class RepairBot:\n    def __init__(self, name, energy):\n        self.name = name\n        self.energy = energy\n\nbot = RepairBot('阿尔法', 80)\nprofile = bot.__dict__`,
      },
      {
        title: '2. __init__ 与实例属性',
        points: [
          '__init__ 是初始化方法，创建实例时会自动调用。',
          'self 表示当前正在创建或调用方法的实例对象。',
          'self.属性名 = 值 会给当前实例添加实例属性，不同实例的属性互不影响。',
        ],
      },
      {
        title: '3. 实例方法',
        points: [
          '定义在类中的普通方法，第一个参数通常写 self。',
          '实例方法可以访问和修改 self 身上的属性。',
          '方法可以 print，也可以 return；闯关中更常见的是把 return 的结果保存到指定变量。',
        ],
        exampleTitle: '示例',
        exampleCode: `class Battery:\n    def __init__(self, power):\n        self.power = power\n\n    def use(self, amount):\n        self.power -= amount\n        return self.power`,
      },
      {
        title: '4. 类属性',
        points: [
          '直接写在类中的赋值语句会创建类属性。',
          '类属性属于类本身，所有实例都能访问同一份公共数据。',
          '实例.属性名 = 值 只会影响当前实例，不会直接修改类属性。',
        ],
      },
      {
        title: '5. 类方法与静态方法',
        points: [
          '@classmethod 修饰类方法，第一个参数通常写 cls，适合访问类属性或创建实例。',
          '@staticmethod 修饰静态方法，不接收 self 或 cls，适合放工具函数。',
          '类方法和静态方法都推荐通过类名调用，让代码语义更清晰。',
        ],
      },
      {
        title: '6. 字符串分割 split()',
        points: [
          '字符串.split(分隔符) 可以按照指定内容拆分字符串。',
          'split() 返回一个列表，常用于解析规则化文本。',
          "例如 '关羽-云长-青龙偃月刀'.split('-') 会得到 ['关羽', '云长', '青龙偃月刀']。",
          '拆分后可以使用多个变量依次接收结果。',
        ],
        exampleTitle: '示例',
        exampleCode: `record = '晨星-2026-4'\nname, year, times = record.split('-')\nyear = int(year)\ntimes = int(times)`,
      },
    ],
    closingTip:
      '遇到复杂关卡时，先写类，再创建实例，最后把题目要求的结果保存到变量。不要只定义方法而忘记调用。',
  },
  levels: [
    {
      key: 'build-first-bot',
      title: '第1关：唤醒第一台维修机器人',
      summary: '定义类、编写 __init__，并创建第一个实例。',
      description:
        "任务：定义 RepairBot 类，__init__(self, name, model, energy) 中保存 name、model、energy 三个实例属性。创建 bot_alpha = RepairBot('阿尔法', 'R-1', 80)，并把 bot_alpha.__dict__ 保存到 bot_profile。",
      points: 3,
      initialCode: `# 请定义 RepairBot 类\n# 创建 bot_alpha，并保存 bot_profile\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          bot_profile: {
            name: '阿尔法',
            model: 'R-1',
            energy: 80,
          },
        },
      },
    },
    {
      key: 'independent-bots',
      title: '第2关：两台机器人互不干扰',
      summary: '理解不同实例拥有各自独立的实例属性。',
      description:
        "任务：定义 CourierBot 类，__init__ 保存 name 和 energy。创建 名为‘晨星’，能量为100的bot_a、创建名为‘夜航’，能量为70的bot_b。随后只把 bot_a的能量改为 55，并给 bot_a 追加 status = '充电中'。最后分别保存 bot_a_info、bot_b_info。",
      points: 3,
      initialCode: `# 请定义 CourierBot 类\n# 创建两个实例，按要求修改 bot_a，并保存 bot_a_info、bot_b_info\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          bot_a_info: {
            name: '晨星',
            energy: 55,
            status: '充电中',
          },
          bot_b_info: {
            name: '夜航',
            energy: 70,
          },
        },
      },
    },
    {
      key: 'charge-method',
      title: '第3关：能量补给协议',
      summary: '编写实例方法，读取并修改实例属性。',
      description:
        "任务：定义 BatteryPack 类，__init__(self, owner, energy) 保存 owner 和 energy。再定义 charge(self, amount) 方法：把 energy 增加 amount，但最高不能超过 100，并返回更新后的 energy。创建BatteryPack的实例pack，名字为‘晨星’，能量为65，依次充能20、30，把两次充能的返回值保存到 first_charge、second_charge，最后保存 pack_info。",
      points: 4,
      initialCode: `# 请定义 BatteryPack 类和 charge 方法\n# 创建 pack，按顺序调用两次 charge，并保存 first_charge、second_charge、pack_info\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_charge: 85,
          second_charge: 100,
          pack_info: {
            owner: '晨星',
            energy: 100,
          },
        },
      },
    },
    {
      key: 'task-board-methods',
      title: '第4关：维修任务看板',
      summary: '在实例方法中综合使用列表和条件判断。',
      description:
        "任务：\n(1)定义 TaskBoard 类，__init__(self, owner) 保存 owner，并创建空列表 tasks。\n(2)定义 add_task(self, task) 方法，把任务加入 tasks 并返回任务总数。\n(3)定义 finish_task(self) 方法：如果 tasks 不为空，删除并返回第一个任务；如果为空，返回 '暂无任务'。\n(4)创建 board = TaskBoard('阿尔法')，依次添加任务 '检测电路'、'更换履带'、'上传日志'。然后将当前的任务数保存到task_count_after_add。\n(5)然后连续完成两项任务，把这两项保存到 finished_tasks，并保存此时剩余任务 remaining_tasks。\n(6)最后创建一个空看板 empty_board = TaskBoard('测试')，调用 empty_board.finish_task()，把返回值保存到 empty_check。",
      points: 5,
      initialCode: `# 请定义 TaskBoard 类、add_task 方法和 finish_task 方法\n# 按任务要求调用方法，并保存结果\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          task_count_after_add: 3,
          finished_tasks: ['检测电路', '更换履带'],
          remaining_tasks: ['上传日志'],
          empty_check: '暂无任务',
        },
      },
    },
    {
      key: 'station-class-attrs',
      title: '第5关：维修站公共规则',
      summary: '使用类属性保存所有实例共享的数据。',
      description:
        "任务：定义 ServiceTicket 类，类属性 station = '第七码头维修站'，max_priority = 5。__init__(self, code, priority) 保存 code，并把 priority 限制在 1 到 ServiceTicket.max_priority 之间：小于 1 按 1 保存，大于 max_priority 按 max_priority 保存。创建 ticket_a = ServiceTicket('T-01', 3)、ticket_b = ServiceTicket('T-02', 9)，保存 station_name、ticket_a_info、ticket_b_info。再执行 ticket_a.station = '临时维修点'，保存 class_station、ticket_a_station、ticket_b_station。",
      points: 5,
      initialCode: `# 请定义 ServiceTicket 类，并按要求创建实例和保存变量\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          station_name: '第七码头维修站',
          ticket_a_info: {
            code: 'T-01',
            priority: 3,
            station: '临时维修点'
          },
          ticket_b_info: {
            code: 'T-02',
            priority: 5,
          },
          class_station: '第七码头维修站',
          ticket_a_station: '临时维修点',
          ticket_b_station: '第七码头维修站',
        },
      },
    },
    {
      key: 'record-factory',
      title: '第6关：从日志生成维修档案',
      summary: '使用类方法作为工厂方法创建实例。',
      description:
        "任务：定义 RepairRecord 类，类属性 default_status = '待复核'。\n__init__(self, bot_name, year, times, status) 保存四个实例属性。\n定义类方法 from_text(cls, text)，text 形如 '晨星-2026-4'，请拆分出机器人名、年份、维修次数，并返回 cls(bot_name, int(year), int(times), cls.default_status)。\n调用 RepairRecord.from_text('晨星-2026-4') 创建 record，保存 record_info。",
      points: 5,
      initialCode: `# 请定义 RepairRecord 类和 from_text 类方法\n# 创建 record，并保存 record_info\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          record_info: {
            bot_name: '晨星',
            year: 2026,
            times: 4,
            status: '待复核',
          },
        },
      },
    },
    {
      key: 'static-tools',
      title: '第7关：安全工具箱',
      summary: '使用静态方法封装与类相关的工具逻辑。',
      description:
        "任务：定义 SecurityTool 类。\n添加静态方法 mask_code(code)，返回前 3 位 + '***' + 后 2 位；添加静态方法 level(score)，score 大于等于 90 返回 'S'，大于等于 75 返回 'A'，大于等于 60 返回 'B'，否则返回 'C'。\n请调用静态方法，把 mask_code('RX9-2026-AB') 保存到 masked_code，把 [96, 82, 73, 51] 的等级列表保存到 score_levels。",
      points: 4,
      initialCode: `# 请定义 SecurityTool 类和两个静态方法\n# 保存 masked_code、score_levels\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          masked_code: 'RX9***AB',
          score_levels: ['S', 'A', 'B', 'C'],
        },
      },
    },
    {
      key: 'final-dispatch-report',
      title: '第8关：终极调度报告',
      summary: '综合类、实例方法、类属性、列表、集合和字典完成报告。',
      description:
        "任务：定义 DispatchCenter 类。\n1. 类属性 base_bonus = 10。\n2. __init__(self, name) 保存 name，并创建空列表 robots。\n3. add_robot(self, name, model, tasks) 把 {'name': name, 'model': model, 'tasks': tasks} 加入 robots。\n4. build_report(self) 返回字典，包含：center 为调度中心名称；robot_count 为机器人数量；models 为去重后的型号集合；total_tasks 为所有 tasks 总和；power_score 为 total_tasks * DispatchCenter.base_bonus；busy_robots 为 tasks 大于等于 3 的机器人名字列表。\n创建 center = DispatchCenter('星港北站')，依次添加 ('晨星', 'R-1', 4)、('夜航', 'R-2', 2)、('流光', 'R-1', 5)、('青锋', 'R-3', 1)，把 center.build_report() 保存到 final_report。",
      points: 7,
      initialCode: `# 请定义 DispatchCenter 类\n# 添加机器人数据，并保存 final_report\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          final_report: {
            center: '星港北站',
            robot_count: 4,
            models: ['R-1', 'R-2', 'R-3'],
            total_tasks: 12,
            power_score: 120,
            busy_robots: ['晨星', '流光'],
          },
        },
      },
    },
  ],
}
