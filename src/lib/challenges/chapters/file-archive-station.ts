import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const fileArchiveStationChapter: ChallengeChapterDefinition = {
  key: 'file-archive-station',
  title: '星港档案站',
  theme: 'Python 文件操作',
  description:
    '你是星港档案站的新任管理员，需要用 Python 读取、写入、追加和整理文本档案，并结合列表、字典、分支、循环和函数生成可靠报告。',
  helpDoc: {
    title: '文件操作闯关提示卡',
    intro:
      '这一章围绕 Python 文件操作展开。重点是理解文本文件和二进制文件的区别，掌握相对路径、open 函数、读取方法、写入模式，以及 with 自动关闭文件。',
    sections: [
      {
        title: '1. 文本文件与二进制文件',
        points: [
          '文本文件按字符编码保存内容，例如 .txt、.py、.md、.html。',
          '二进制文件按特定格式保存内容，例如 .jpg、.png、.mp3、.mp4。',
          '读取文本文件时通常要写 encoding="utf-8"，避免中文乱码。',
        ],
      },
      {
        title: '2. 路径与 open',
        points: [
          '相对路径会从当前程序运行目录开始查找文件。',
          'open(file, mode, encoding) 会返回文件对象。',
          '文件用完后要关闭，更推荐使用 with 自动关闭。',
        ],
        exampleTitle: '示例',
        exampleCode: `with open('log.txt', 'rt', encoding='utf-8') as file:\n    text = file.read()`,
      },
      {
        title: '3. 常见读取方式',
        points: [
          'read(size) 读取指定字符数，不写 size 就读取剩余所有内容。',
          'readline() 每次读取一行。',
          'for line in file 可以逐行遍历文件对象。',
          'readlines() 会一次性读取所有行并返回列表，适合小文件。',
        ],
      },
      {
        title: '4. 写入与追加',
        points: [
          'w 模式用于写入，打开时会先清空原文件。',
          'a 模式用于追加，新内容会写到文件末尾。',
          'x 模式用于排它性创建，文件已存在时会创建失败。',
          '+ 模式表示可读可写，常配合 seek(0, 0) 回到文件开头读取。',
        ],
        exampleTitle: '示例',
        exampleCode: `with open('report.txt', 'wt', encoding='utf-8') as file:\n    file.write('任务完成')\n\nwith open('report.txt', 'at', encoding='utf-8') as file:\n    file.write('\\n追加记录')`,
      },
      {
        title: '5. 解析文本数据',
        points: [
          '读取到的一行通常带有换行符，可以用 strip() 去掉首尾空白。',
          '规则化文本常用 split() 拆分字段。',
          '拆分后的字符串可以用 int()、float() 转成数字。',
          '循环读取文件时，经常配合列表、字典和条件分支整理数据。',
        ],
      },
    ],
    closingTip:
      '做文件题时先确认文件名、打开模式和编码，再决定用 read、readline、for 循环还是 readlines。最后别忘了把题目要求的结果保存到变量。',
  },
  levels: [
    {
      key: 'file-type-sorter',
      title: '第1关：档案类型分拣',
      summary: '根据扩展名区分文本文件、二进制文件和未知文件。',
      description:
        "任务：file_names 中保存了一批文件名。请用循环和分支判断扩展名，把文本文件名保存到 text_files，把二进制文件名保存到 binary_files，把其他文件名保存到 unknown_files。文本扩展名包括 .txt、.py、.md、.html；二进制扩展名包括 .mp3、.mp4、.doc、.ppt、.jpg、.png。",
      points: 3,
      initialCode: `file_names = ['readme.txt', 'main.py', 'lesson.md', 'index.html', 'music.mp3', 'photo.jpg', 'video.mp4', 'archive.zip', 'data.csv']\n\n# 请保存 text_files、binary_files、unknown_files\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          text_files: ['readme.txt', 'main.py', 'lesson.md', 'index.html'],
          binary_files: ['music.mp3', 'photo.jpg', 'video.mp4'],
          unknown_files: ['archive.zip', 'data.csv'],
        },
      },
    },
    {
      key: 'read-capsule',
      title: '第2关：读取密封档案',
      summary: '使用 read(size) 理解文件指针会继续向后移动。',
      description:
        "任务：初始代码已经创建 station_intro.txt。请用 open 和 read 完成三次读取：第一次读取 5 个字符保存到 first_text，第二次读取 4 个字符保存到 next_text，第三次读取剩余所有内容保存到 rest_text。",
      points: 3,
      initialCode: `with open('station_intro.txt', 'wt', encoding='utf-8') as seed_file:\n    seed_file.write('星港档案站正在整理旧日志')\n\n# 请用 read(size) 依次读取，并保存 first_text、next_text、rest_text\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_text: '星港档案站',
          next_text: '正在整理',
          rest_text: '旧日志',
        },
      },
    },
    {
      key: 'line-patrol',
      title: '第3关：逐行巡检日志',
      summary: '使用 readline 或 for 循环逐行读取文本文件。',
      description:
        "任务：初始代码已经创建 patrol_log.txt，每行格式为“站点,状态”。请读取文件并保存：1. 第一行去掉换行后的内容 first_line。2. 总行数 line_count。3. 状态为 '异常' 的站点名列表 alert_stations。",
      points: 4,
      initialCode: `with open('patrol_log.txt', 'wt', encoding='utf-8') as seed_file:\n    seed_file.write('晨星港,正常\\n蓝环站,异常\\n银轨仓,正常\\n远航门,异常\\n雾灯塔,正常\\n')\n\n# 请读取 patrol_log.txt，并保存 first_line、line_count、alert_stations\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_line: '晨星港,正常',
          line_count: 5,
          alert_stations: ['蓝环站', '远航门'],
        },
      },
    },
    {
      key: 'score-roll',
      title: '第4关：成绩卷宗统计',
      summary: '使用 readlines、split、列表和字典统计成绩。',
      description:
        "任务：初始代码已经创建 scores.txt，每行格式为“姓名,成绩”。请读取所有行并保存：1. clean_lines 为去掉换行的原始行列表。2. score_map 为姓名到成绩整数的字典。3. passed_names 为成绩大于等于 60 的姓名列表。4. average_score 为平均分。",
      points: 5,
      initialCode: `with open('scores.txt', 'wt', encoding='utf-8') as seed_file:\n    seed_file.write('林小星,96\\n周远航,82\\n许晨光,74\\n沈清,59\\n赵一鸣,89\\n顾南,65\\n')\n\n# 请读取 scores.txt，并保存 clean_lines、score_map、passed_names、average_score\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          clean_lines: ['林小星,96', '周远航,82', '许晨光,74', '沈清,59', '赵一鸣,89', '顾南,65'],
          score_map: {
            '林小星': 96,
            '周远航': 82,
            '许晨光': 74,
            '沈清': 59,
            '赵一鸣': 89,
            '顾南': 65,
          },
          passed_names: ['林小星', '周远航', '许晨光', '赵一鸣', '顾南'],
          average_score: 77.5,
        },
      },
    },
    {
      key: 'write-repair-report',
      title: '第5关：写入维修日报',
      summary: '使用 w 模式把统计结果写入文本文件。',
      description:
        "任务：请根据 task_counts 写入 report.txt。文件内容必须是 5 行：第一行“今日维修报告”，接着按 task_counts 的原顺序写“任务名:数量”，最后一行写“总数:10”。写完后重新读取文件，把完整内容保存到 report_text，把按行拆分后的列表保存到 report_lines。",
      points: 5,
      initialCode: `task_counts = {'检测电路': 3, '更换电池': 5, '上传日志': 2}\n\n# 请写入 report.txt，并保存 report_text、report_lines\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          report_text: '今日维修报告\n检测电路:3\n更换电池:5\n上传日志:2\n总数:10',
          report_lines: ['今日维修报告', '检测电路:3', '更换电池:5', '上传日志:2', '总数:10'],
        },
      },
    },
    {
      key: 'append-security-log',
      title: '第6关：追加安防记录',
      summary: '使用 a 模式在已有文件末尾追加新内容。',
      description:
        "任务：初始代码已经创建 security_log.txt，并给出 new_events。请把 new_events 中的内容逐行追加到文件末尾。追加完成后读取全部记录，去掉换行，保存到 all_events；再统计包含 '异常' 的记录数量，保存到 alert_count。",
      points: 5,
      initialCode: `with open('security_log.txt', 'wt', encoding='utf-8') as seed_file:\n    seed_file.write('08:00 正常开站\\n09:30 档案借阅\\n')\n\nnew_events = ['10:20 异常登录', '11:00 正常归档', '11:40 异常访问']\n\n# 请追加 new_events，并保存 all_events、alert_count\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          all_events: ['08:00 正常开站', '09:30 档案借阅', '10:20 异常登录', '11:00 正常归档', '11:40 异常访问'],
          alert_count: 2,
        },
      },
    },
    {
      key: 'update-mode-terminal',
      title: '第7关：可读可写终端',
      summary: '使用 + 模式和 seek 在同一个文件中写入后读取。',
      description:
        "任务：请先用 wt+ 模式打开 calibration.txt，写入“校准开始\\n”，再用 seek(0, 0) 回到开头读取内容，保存到 first_read。然后用 at+ 模式打开同一文件，追加“校准完成\\n”，再 seek(0, 0) 读取全部内容，保存到 final_text，并把总行数保存到 line_total。",
      points: 5,
      initialCode: `# 请使用 wt+、at+ 和 seek 完成任务\n# 保存 first_read、final_text、line_total\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_read: '校准开始\n',
          final_text: '校准开始\n校准完成\n',
          line_total: 2,
        },
      },
    },
    {
      key: 'final-archive-report',
      title: '第8关：终极档案报告',
      summary: '综合文件读取、函数、循环、分支、列表和字典生成报告。',
      description:
        "任务：初始代码已经创建 orders.txt、price_map 和 vip_names。请定义函数 build_archive_report(order_path, price_map, vip_names)。函数读取订单文件，每行格式为“顾客名,商品名,数量”，并返回 report 字典：\n1. order_count：订单数量。\n2. total_income：总收入，VIP 顾客按 8 折计算。\n3. vip_buyers：购买过商品的 VIP 顾客列表，按首次出现顺序去重。\n4. item_count：每种商品售出总数。\n5. large_order_names：实付金额大于等于 60 的顾客名列表。\n函数还要写入 archive_summary.txt，内容为三行：订单数、总收入、VIP顾客。最后调用函数，把返回值保存到 final_report，再读取 archive_summary.txt 的完整内容保存到 summary_text。",
      points: 8,
      initialCode: `with open('orders.txt', 'wt', encoding='utf-8') as seed_file:\n    seed_file.write('林小星,能量棒,3\\n周远航,维修包,1\\n林小星,星尘电池,2\\n许晨光,导航芯片,2\\n周远航,能量棒,4\\n沈清,护盾发生器,1\\n')\n\nprice_map = {'能量棒': 10, '维修包': 30, '星尘电池': 25, '导航芯片': 40, '护盾发生器': 90}\nvip_names = {'林小星', '许晨光'}\n\n# 请定义 build_archive_report(order_path, price_map, vip_names)\n# 保存 final_report、summary_text\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          final_report: {
            order_count: 6,
            total_income: 288,
            vip_buyers: ['林小星', '许晨光'],
            item_count: {
              '能量棒': 7,
              '维修包': 1,
              '星尘电池': 2,
              '导航芯片': 2,
              '护盾发生器': 1,
            },
            large_order_names: ['许晨光', '沈清'],
          },
          summary_text: '订单数:6\n总收入:288\nVIP顾客:林小星、许晨光',
        },
      },
    },
  ],
}
