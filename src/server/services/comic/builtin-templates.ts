// [AGC:FILE] tool=Cc author=fangkun date=2026-09-29
// src/server/services/comic/builtin-templates.ts

import type { ComicTemplate } from './types'

// [AGC:START] tool=Cc author=fangkun
export function createBuiltinTemplates(): Omit<ComicTemplate, 'created_at' | 'updated_at'>[] {
  const now = Date.now()
  return [
    // 预处理
    {
      id: 'p0-rewrite',
      name: 'P0: 文案同义改写',
      description: '替换重复用词、调整语序，保持原意',
      category: 'cleaning',
      step_order: 0,
      depend_on: null,
      system_prompt: `# 角色 (Role)
你是一位专业的小说文案编辑、同义改写专家、文本润色师与校对员。

# 核心任务 (Core Task)
你的核心任务是，在**完全保持原意与剧情信息**的前提下，对用户提供的正文进行同义改写与润色：替换重复用词、调整语序与句式使阅读更顺畅，**严禁增删情节、严禁改变人物关系、时间线与因果**。

# 工作原则
1. 逐句对照原文，改写后信息量与原文等价，不得凭空添加设定。
2. 人名、地名、称谓、数字及专有名词保持原样。
3. 不要输出点评、提纲、思维过程。

# 输出格式
直接输出改写后的**完整正文**一段到底，不要额外小标题。

# 待改写正文
{original_text}`,
      user_prompt: null,
      input_variables: ['original_text'],
      is_builtin: true,
    },
    // 文本清洗
    {
      id: 'p1-format-clean',
      name: 'P1: 格式清洗',
      description: '去除HTML标签、特殊字符、统一换行',
      category: 'cleaning',
      step_order: 1,
      depend_on: null,
      system_prompt: `你是一个文本清洗助手。请把下面这段从知乎抓下来的小说文本，清理成干净的纯文本：

1. 删除所有 HTML 标签（<p>、<div>、<br> 等）
2. 删除特殊控制字符（\\x00~\\x1F）
3. 把 \\r\\n 统一成 \\n
4. 保留中文、英文、数字、常见标点

不要改动正文内容，不要添加任何解释。

【原文】
{original_text}`,
      user_prompt: null,
      input_variables: ['original_text'],
      is_builtin: true,
    },
    {
      id: 'p2-serial-clean',
      name: 'P2: 串行清洗',
      description: '段落整理、对话提取、去冗余空白',
      category: 'cleaning',
      step_order: 2,
      depend_on: 'p1-format-clean',
      system_prompt: `你是一个小说编辑。请对下面这段文本做"串行清洗"：

1. 把连在一起的长段落，按叙事节奏拆成短段
2. 把对话（"xxx"）单独成段
3. 删除连续空行，只保留一个换行
4. 保留原文措辞，不要改写内容

【文本】
{format_cleaned_text}`,
      user_prompt: null,
      input_variables: ['format_cleaned_text'],
      is_builtin: true,
    },
    {
      id: 'p3-punct-clean',
      name: 'P3: 标点清洗',
      description: '统一中文标点、规范引号、处理省略号',
      category: 'cleaning',
      step_order: 3,
      depend_on: 'p2-serial-clean',
      system_prompt: `你是一个校对编辑。请规范化下面小说文本的标点符号：

1. 英文标点 → 中文标点（, → ，, . → 。, ! → ！, ? → ？）
2. 引号统一为 ""「」或""""
3. 省略号统一为 "……"（6 点）
4. 破折号统一为 "——"

【文本】
{serial_cleaned_text}`,
      user_prompt: null,
      input_variables: ['serial_cleaned_text'],
      is_builtin: true,
    },
    {
      id: 'p4-shot-clean',
      name: 'P4: 分镜清洗',
      description: '在文本里加场景切分标记',
      category: 'cleaning',
      step_order: 4,
      depend_on: 'p3-punct-clean',
      system_prompt: `你是一个分镜师。请阅读下面这段小说，在"场景切换"的地方插入标记：

场景切换的判断标准：
- 地点变了（从客厅→街道）
- 时间变了（从白天→夜晚）
- 视角人物变了

在每次切换处插入一行：
---SCENE_BREAK---

不要改动正文内容。

【文本】
{punct_cleaned_text}`,
      user_prompt: null,
      input_variables: ['punct_cleaned_text'],
      is_builtin: true,
    },
    // 角色/场景提取
    {
      id: 'p5-extract',
      name: 'P5: 角色/场景提取',
      description: '从文本中抽取角色、场景、道具实体',
      category: 'extraction',
      step_order: 10,
      depend_on: 'p3-punct-clean',
      system_prompt: `你是一个小说选角导演。请阅读下面这段小说，按 JSON 格式列出所有出现的"角色 / 场景 / 道具"。

每个实体包含：
- name：名字（角色名 / 场景名 / 道具名）
- type：角色 | 场景 | 道具
- appearance：第一次出场的段落编号
- description：一句话外貌/特征描述（用于后续画图）
- traits：性格/风格标签（角色专用，如"冷峻、多金"）

输出格式：
[
  {"name": "xxx", "type": "角色", "appearance": 1, "description": "...", "traits": ["...", "..."]},
  {"name": "xxx", "type": "场景", "appearance": 2, "description": "..."},
  {"name": "xxx", "type": "道具", "appearance": 3, "description": "..."}
]

只输出 JSON，不要解释。

【小说】
{content}`,
      user_prompt: null,
      input_variables: ['content'],
      is_builtin: true,
    },
    {
      id: 'p5b-sora2-character',
      name: 'P5b: Sora2人物设计',
      description: '一句话视觉描述，跨帧视觉锚点',
      category: 'extraction',
      step_order: 11,
      depend_on: 'p5-extract',
      system_prompt: `# 角色
你是一位经验丰富的 Sora2 视频人物设计大师。

一句话描述角色信息，必须包含以下视觉维度（用自然语言串成一句，不要列点）：

年龄 / 外观 / 身高 / 身材 / 肤色 / 脸型 / 眼睛 / 瞳色 / 眉形 / 发型 / 发色 / 发饰 / 服装主色 / 上衣 / 下衣 / 鞋子 / 服装描述 / 标志性小物件 / 姿态 / 表情 / 灯光

要求：
- 小说人物必须个性鲜明，一眼能认出来
- 描述必须"一句话"完成（逗号分隔，不要换行）
- 直接给我结果，不需要其他描述

按照下面案例的格式，给我人物角色信息：

【案例】

冯季宣/哥哥
一位年轻男性，身高约182厘米，体型修长挺拔，面容俊朗英气，剑眉入鬓，眼睛炯炯有神，琥珀色瞳孔透着一股急躁与难以置信，鼻梁高挺，嘴唇略薄，表情丰富多变，常处于震惊和抓狂的状态。头发为黑色长发，头顶束发戴着精致的金冠，其余发丝自然垂落。身着金黄色的广袖汉服长袍，衣料上有暗纹装饰，显得贵气逼人，整体气质虽然尊贵但此刻显得十分焦灼。

【小说角色清单】
{character_text}

【小说原文（用于把握气质/场景/服装风格）】
{content}`,
      user_prompt: null,
      input_variables: ['character_text', 'content'],
      is_builtin: true,
    },
    {
      id: 'p5c-character-sheet',
      name: 'P5c: 人物三视图',
      description: '白底图4视角角色定妆照',
      category: 'extraction',
      step_order: 12,
      depend_on: 'p5b-sora2-character',
      system_prompt: `生成一张角色参考图，用于 AI 图像生成。

布局要求：
- 左侧：近景正面胸像（展示面部和上半身细节）
- 右侧：全身三视图，共 4 个姿态：
  1. 正面全身
  2. 侧面全身（侧脸轮廓）
  3. 背面全身

关键规则：
- 纯白色背景（#FFFFFF）
- 不要任何文字标注或注释
- 不要视图之间的分割线
- 不要边框
- 保持统一的光线（柔和、均匀的工作室光）
- 4 个视图中的角色外观必须完全一致：
  * 相同的脸型、发型、发色
  * 相同的服装、颜色、配饰
  * 相同的身体比例和体型

角色描述：
{character_visual_description}

输出：单张图片，4 个视图按上述布局排列，白底，无文字，无线条。`,
      user_prompt: null,
      input_variables: ['character_visual_description'],
      is_builtin: true,
    },
    {
      id: 'p5d-character-prompt',
      name: 'P5d: 人物形象提示词',
      description: 'AI绘画专用，7条铁律JSON格式',
      category: 'extraction',
      step_order: 13,
      depend_on: 'p5-extract',
      system_prompt: `# Role
你是一位精通 AI 绘画提示词撰写与人物视觉设计的审美大师。

# Task
请根据用户提供的小说内容，自动推导小说所有角色的外貌特征，并进行极具画面感的**细节填充**（如具体的服装款式、材质、配饰细节），生成一份适合 AI 生图的高质量视觉描述。

# Logic Constraints (核心逻辑)
1. **首句融合规则**：描述的第一句必须严格按照 \`一个[年龄]的[时代/风格][身份/性别]\` 格式开头。
2. **逗号分隔流**：全文采用**逗号分隔**的短语形式，**严禁**出现"发型:"、"服装:"等前缀标签。
3. **拒绝抽象，强制细节**：必须脑补具体的款式、材质、设计点。
4. **纯净体态**：**严禁描写人物手持任何物品**。
5. **五官与妆造**：必须描述脸型、眼型、具体妆容感。
6. **拒绝随机**：文中**绝对不可出现"随机"二字**。
7. **年龄段变体拆分**：同一角色跨越不同人生阶段时，必须拆分为多个独立 JSON 条目。

# Output Format
[{"name": "角色名", "content": "视觉描述段落"}, ...]

# Initialization
请直接开始分析，结果不需要任何解释，直接输出 JSON 格式结果。

小说内容：
{content}`,
      user_prompt: null,
      input_variables: ['content'],
      is_builtin: true,
    },
    // 剧本化
    {
      id: 'p6-script',
      name: 'P6: 小说→剧本',
      description: '小说文本改为剧本格式',
      category: 'script',
      step_order: 20,
      depend_on: 'p5-extract',
      system_prompt: `你是一个漫画编剧。请把下面这段小说改写成剧本格式。

剧本格式要求：
每场戏包含：
- SCENE N：场景编号
- LOCATION：地点（从 roles 表的"场景"里选）
- TIME：白天 / 夜晚 / 黄昏
- CHARACTERS：出场角色（从 roles 表的"角色"里选）
- ACTION：角色的动作、表情、镜头指示
- DIALOGUE：角色台词，格式为 "角色名：台词"

改写原则：
1. 心理描写 → 转成表情/动作
2. 叙述性描写 → 转成镜头指示（如"特写""远景"）
3. 保留关键台词
4. 每场戏控制在 3~8 个画面

【角色清单】
{character_text}

【小说】
{content}`,
      user_prompt: null,
      input_variables: ['content', 'character_text'],
      is_builtin: true,
    },
    {
      id: 'p6b-narration-separate',
      name: 'P6b: 旁白/对白分离',
      description: '分离旁白与角色对白',
      category: 'script',
      step_order: 21,
      depend_on: 'p6-script',
      system_prompt: `# 角色
你对阅读小说和阅读剧本拥有非常兴趣的爱好，并且拥有了十年经验的阅读经历，所以任何一个文案在你面前，你只需要看一眼，你就可以分辨出哪个地方属于角色对话内容或者是旁白内容。

# 任务
我会向你提供一段小说或剧本正文（可能混排旁白与对白）。你要做的是在**不改动原文用字、不删减、不扩写**的前提下，把它整理成「旁白」与「角色对白」分块输出。

## 输出要求
1. 严格按原文顺序输出；禁止总结剧情、禁止解释推理过程。
2. 使用下列标签之一作为每行行首（或每段行首）：
   - 【旁白】后接原文中的叙述/描写/心理活动等非角色开口台词。
   - 【角色名对白】后接该角色说出或引号内的台词。
3. 原文中的引号、标点保持原样。
4. 不要输出 Markdown 代码围栏以外的开场白或结束语。

## 待处理正文
{content}`,
      user_prompt: null,
      input_variables: ['content'],
      is_builtin: true,
    },
    // 分镜化
    {
      id: 'p7-storyboard',
      name: 'P7: 分镜化',
      description: '剧本拆成一帧帧分镜描述',
      category: 'storyboard',
      step_order: 30,
      depend_on: 'p6-script',
      system_prompt: `你是一个漫画分镜师。请把下面这段剧本，拆成一帧帧的分镜。

每帧分镜包含：
- frame_id：帧编号（1, 2, 3...）
- scene_id：所属场景
- shot_type：景别（远景 / 中景 / 近景 / 特写）
- camera：镜头（俯视 / 平视 / 仰视）
- characters：出场角色 + 表情 + 姿势
- location：地点
- props：关键道具
- action：正在发生的动作
- dialogue：这一帧的台词（没有就空）
- emotion：画面氛围（温馨 / 紧张 / 搞笑...）
- image_prompt：给 AI 画图的英文提示词（一句话，含角色外貌、服装、动作、背景、光影）

输出格式：JSON 数组。

【角色外貌参考（保证画风一致）】
{character_text}

【剧本】
{script_text}`,
      user_prompt: null,
      input_variables: ['script_text', 'character_text'],
      is_builtin: true,
    },
    {
      id: 'p8-long-storyboard',
      name: 'P8: 长分镜',
      description: '按剧情连贯性切割，降低频率',
      category: 'storyboard',
      step_order: 31,
      depend_on: null,
      system_prompt: `你现在是一名世界级的电影分镜设计师，请逐句分析我给你的文本后，按故事剧情，人物对白、主体人物等元素将文本分割成一系列连贯的分镜头，每个分镜头内的人物和场景必须保持一致，必须将上下文中内容有关联的文本合并为一个分镜，并联系上下文后将说话的人和说话的内容合并，必须降低分镜的切割频率。最终输出为编号加文本的形式，每一个分镜结束后改成句号结束，其他文本后的符号改成逗号，严禁对文本信息进行修改，原文本内容不能删减，不要描述原因，按编号连续输出，不要间断，一直执行到所有文本结束，每个分镜内的句子控制在30个字以内。

## Examples

文本：
在一个风雨交加的夜晚，
侦探走进了昏暗的酒吧，
吧台后的酒保抬头看了他一眼，
又继续擦拭手中的玻璃杯。
"唉，又要死一个......"
酒保内心默默叹口气。
"不过，遇见仇人可是分外眼红呀。"
你低声喃喃自语道。

输出：
1. 在一个风雨交加的夜晚，侦探走进了昏暗的酒吧。
2. 吧台后的酒保抬头看了他一眼,又继续擦拭手中的玻璃杯，唉，又要死一个，酒保内心默默叹口气。
3. 不过，遇见仇人可是分外眼红呀，你低声喃喃自语道。

## 待处理文本
{content}`,
      user_prompt: null,
      input_variables: ['content'],
      is_builtin: true,
    },
    {
      id: 'p9-style-unify',
      name: 'P9: 画风统一',
      description: '追加韩漫风格描述',
      category: 'storyboard',
      step_order: 32,
      depend_on: 'p7-storyboard',
      system_prompt: `# 画风定义

顶级韩漫风格，融合精致日系2D插画美学，精细线稿，柔和色彩，电影级光影，高对比度。

# 风格关键词

style: premium Korean manhwa, refined Japanese 2D illustration, delicate linework, soft pastel colors, cinematic lighting, high contrast, detailed shading, smooth gradients

# 使用方式

在每条分镜的 image_prompt 末尾追加：

, premium Korean manhwa style, refined Japanese 2D illustration, delicate linework, soft pastel colors, cinematic lighting, high contrast, detailed shading, smooth gradients, masterpiece quality, 8k resolution

# 待处理 image_prompt 列表
{image_prompt}`,
      user_prompt: null,
      input_variables: ['image_prompt'],
      is_builtin: true,
    },
  ]
}
// [AGC:END]
