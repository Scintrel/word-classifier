/**
 * Category keyword seed data — used by the classifier for keyword matching.
 * Format: { categoryId, keywords[], cnKeywords[], subCategories? }
 * keywords: 英文关键词（匹配单词本身和英文释义）
 * cnKeywords: 中文关键词（匹配中文释义——词典补全后的释义是中文，英文关键词永远匹配不上）
 * Sub-categories defined with their own categoryId and parent relation already seeded in DB.
 */

export interface CategoryKeywords {
  categoryId: number
  keywords: string[]
  cnKeywords: string[]
  subCategories?: { id: number; keywords: string[]; cnKeywords: string[] }[]
}

const K = (
  id: number,
  kw: string[],
  cn: string[],
  sub?: { id: number; keywords: string[]; cnKeywords: string[] }[]
): CategoryKeywords => ({ categoryId: id, keywords: kw, cnKeywords: cn, subCategories: sub })

export const CATEGORY_KEYWORDS: CategoryKeywords[] = [
  // 1. Daily Life & sub-categories
  K(1, ['life','daily','routine','home','house','family','live','wake','sleep','morning','evening','breakfast','lunch','dinner','room','kitchen','bathroom','bedroom','garden','door','window','floor','clean','wash','cook','shop','buy','wear'],
    ['生活','日常','家庭','房子','房间','居住','睡觉','起床','早晨','晚上','早餐','午餐','晚餐','打扫','清洗','做饭','购物','穿着','家务','起居','作息'],[
    { id:12, keywords:['food','drink','eat','cook','meal','rice','bread','meat','fish','chicken','beef','pork','vegetable','fruit','apple','banana','orange','milk','water','juice','tea','coffee','wine','beer','sugar','salt','sweet','sour','spicy','taste','flavor','delicious','hungry','thirsty','restaurant','menu','chef','bake','boil','fry','roast','grill','recipe','ingredient','snack','dessert','cake','soup','salad','sauce','cheese','butter','egg','noodle','pasta','pizza','sandwich','chocolate','cookie','potato','tomato','onion','garlic','pepper'],
      cnKeywords:['食物','饮料','吃','烹饪','餐','米饭','面包','肉','鱼','鸡','牛','猪','蔬菜','水果','苹果','香蕉','橙','牛奶','水','果汁','茶','咖啡','酒','啤酒','糖','盐','甜','酸','辣','味道','风味','美味','饿','渴','餐厅','菜单','厨师','烘焙','煮','炸','烤','食谱','配料','零食','甜点','蛋糕','汤','沙拉','酱','奶酪','黄油','鸡蛋','面条','披萨','三明治','巧克力','饼干','土豆','番茄','洋葱','大蒜','胡椒','吃的东西','食品'] },
    { id:13, keywords:['clothes','clothing','wear','dress','shirt','pants','jeans','jacket','coat','sweater','skirt','suit','tie','shoe','boot','sock','hat','cap','glove','scarf','belt','pocket','button','fashion','style','cotton','silk','wool','leather','uniform','casual','formal','size','fit','tight','loose'],
      cnKeywords:['衣服','穿着','连衣裙','衬衫','裤子','牛仔裤','夹克','外套','毛衣','裙子','西装','领带','鞋','靴子','袜子','帽子','手套','围巾','腰带','口袋','纽扣','时尚','风格','棉','丝绸','羊毛','皮革','制服','休闲','正式','尺寸','合身','紧','松','服装'] },
    { id:14, keywords:['home','house','apartment','room','kitchen','bathroom','bedroom','door','window','floor','wall','ceiling','roof','furniture','table','chair','bed','sofa','desk','shelf','cabinet','drawer','lamp','light','curtain','carpet','mirror','clock','key','lock','clean','wash','tidy','decoration','painting','plant'],
      cnKeywords:['房子','公寓','房间','厨房','浴室','卧室','门','窗','地板','墙','天花板','屋顶','家具','桌子','椅子','床','沙发','书桌','架子','柜子','抽屉','灯','窗帘','地毯','镜子','钟','钥匙','锁','打扫','整理','装饰','住房','居住'] },
    { id:15, keywords:['shop','shopping','store','market','mall','buy','sell','price','cost','cheap','expensive','discount','sale','bargain','receipt','cash','credit','card','pay','payment','money','dollar','bill','customer','brand','product','quality','warranty','refund','online','order','delivery','package'],
      cnKeywords:['购物','商店','市场','商场','买','卖','价格','成本','便宜','贵','折扣','销售','便宜货','收据','现金','信用卡','支付','钱','美元','账单','顾客','品牌','产品','质量','保修','退款','订单','快递','包裹'] },
  ]),
  // 2. Education & sub-categories
  K(2, ['school','education','learn','study','teach','student','teacher','class','lesson','course','grade','exam','test','quiz','score','homework','textbook','notebook','pencil','pen','paper','read','write','library','knowledge','subject','major','graduate','degree'],
    ['学校','教育','学习','教学','学生','老师','班级','课程','考试','分数','作业','课本','笔记','铅笔','钢笔','阅读','写作','图书馆','知识','学科','专业','毕业','学位','大学','学院','教育','求学'],[
    { id:16, keywords:['school','campus','classroom','playground','principal','professor','lecture','semester','term','vacation','holiday','dormitory','cafeteria','uniform','textbook','backpack','locker','schedule','timetable','register','enroll','attend','absent'],
      cnKeywords:['校园','教室','操场','校长','教授','讲座','学期','假期','宿舍','食堂','校服','背包','储物柜','课程表','注册','报名','参加','缺席','上课'] },
    { id:17, keywords:['math','mathematics','number','add','subtract','multiply','divide','plus','minus','equal','sum','total','average','percent','fraction','decimal','ratio','angle','area','volume','length','width','height','circle','square','triangle','rectangle','radius','diameter','formula','equation','algebra','geometry','calculus','statistics','graph','chart'],
      cnKeywords:['数学','数字','加','减','乘','除','和','总和','平均','百分比','分数','小数','比例','角度','面积','体积','长度','宽度','高度','圆','方','三角','长方形','半径','直径','公式','方程','代数','几何','微积分','统计','图表','计算'] },
    { id:18, keywords:['science','physics','chemistry','biology','experiment','laboratory','scientist','theory','hypothesis','research','discover','observe','atom','molecule','element','compound','reaction','energy','force','gravity','mass','speed','temperature','pressure','electric','magnetic','cell','organism','species','evolution','gene','DNA','protein','oxygen','hydrogen','carbon'],
      cnKeywords:['科学','物理','化学','生物','实验','实验室','科学家','理论','假说','研究','发现','观察','原子','分子','元素','化合物','反应','能量','力','重力','质量','速度','温度','压力','电','磁','细胞','生物体','物种','进化','基因','蛋白质','氧','氢','碳','科研'] },
    { id:19, keywords:['language','english','chinese','word','vocabulary','grammar','sentence','paragraph','essay','spelling','pronunciation','phonetic','vowel','consonant','accent','translate','translation','meaning','definition','synonym','antonym','phrase','idiom','poem','poetry','literature','novel','dictionary','speak','listen','conversation','noun','verb','adjective','adverb'],
      cnKeywords:['语言','英语','中文','单词','词汇','语法','句子','段落','作文','拼写','发音','语音','元音','辅音','口音','翻译','意思','定义','同义词','反义词','短语','习语','诗','诗歌','文学','小说','字典','说话','听','对话','名词','动词','形容词','副词'] },
  ]),
  // 3. Work & sub-categories
  K(3, ['work','job','career','office','company','business','manager','employee','boss','colleague','meeting','deadline','project','task','salary','wage','promotion','hire','fire','resign','interview','resume','profession','industry','skill','training'],
    ['工作','职业','办公室','公司','商业','经理','雇员','老板','同事','会议','期限','项目','任务','薪水','工资','晋升','雇佣','解雇','辞职','面试','简历','行业','技能','培训','职场'],[
    { id:20, keywords:['business','company','corporation','enterprise','office','manager','CEO','director','executive','staff','team','department','marketing','sales','advertising','brand','customer','client','contract','deal','negotiate','partner','competitor','strategy','goal','revenue','profit','loss','budget','report','presentation','proposal','email','schedule','appointment'],
      cnKeywords:['商业','公司','企业','办公室','经理','总裁','董事','高管','员工','团队','部门','营销','销售','广告','品牌','顾客','客户','合同','交易','谈判','合伙人','竞争对手','策略','目标','收入','利润','亏损','预算','报告','演示','提案','电子邮件','日程','预约','商务'] },
    { id:21, keywords:['money','bank','finance','financial','account','saving','deposit','withdraw','transfer','loan','debt','credit','interest','rate','mortgage','invest','investment','stock','share','bond','fund','market','trading','asset','tax','income','expense','budget','accounting','invoice','currency','dollar','euro','yen','exchange','inflation'],
      cnKeywords:['钱','银行','金融','账户','储蓄','存款','取款','转账','贷款','债务','信贷','利息','利率','抵押','投资','股票','股份','债券','基金','市场','交易','资产','税','收入','支出','预算','会计','发票','货币','美元','欧元','日元','兑换','通货膨胀','理财'] },
    { id:22, keywords:['law','legal','court','judge','jury','lawyer','attorney','trial','case','evidence','witness','defendant','guilty','innocent','crime','criminal','prison','jail','sentence','punishment','fine','appeal','verdict','right','justice','freedom','constitution','regulation','license','permit','contract','agreement','illegal','theft','fraud'],
      cnKeywords:['法律','法庭','法院','法官','陪审团','律师','审判','案件','证据','证人','被告','有罪','无罪','犯罪','罪犯','监狱','判决','惩罚','罚款','上诉','裁决','权利','正义','自由','宪法','法规','执照','许可','合同','协议','非法','盗窃','欺诈','司法'] },
  ]),
  // 4. Nature & sub-categories
  K(4, ['nature','natural','world','earth','environment','outdoor','wild','forest','mountain','river','ocean','sea','lake','sky','sun','moon','star','tree','flower','grass','field','desert','island'],
    ['自然','环境','地球','世界','野生','森林','山','河流','海洋','湖','天空','太阳','月亮','星星','树','花','草','田野','沙漠','岛','户外'],[
    { id:23, keywords:['animal','wildlife','mammal','bird','fish','reptile','insect','dog','cat','horse','cow','sheep','pig','chicken','duck','lion','tiger','bear','wolf','fox','deer','rabbit','mouse','elephant','monkey','snake','frog','turtle','whale','dolphin','shark','eagle','owl','parrot','penguin','butterfly','bee','ant','spider','zoo','pet','wing','tail','feather','fur'],
      cnKeywords:['动物','野生动物','哺乳动物','鸟','鱼','爬行动物','昆虫','狗','猫','马','牛','羊','猪','鸡','鸭','狮子','老虎','熊','狼','狐狸','鹿','兔子','老鼠','大象','猴子','蛇','青蛙','乌龟','鲸','海豚','鲨鱼','鹰','猫头鹰','鹦鹉','企鹅','蝴蝶','蜜蜂','蚂蚁','蜘蛛','动物园','宠物','翅膀','尾巴','羽毛','皮毛'] },
    { id:24, keywords:['plant','tree','flower','grass','leaf','root','stem','seed','fruit','vegetable','crop','garden','forest','wood','rose','lily','daisy','tulip','bamboo','pine','oak','maple','palm','cactus','vine','herb','weed','bloom','grow','soil','fertilizer','harvest','wheat','rice','corn','cotton','coffee','tea'],
      cnKeywords:['植物','树','花','草','叶','根','茎','种子','水果','蔬菜','庄稼','花园','森林','木头','玫瑰','百合','雏菊','郁金香','竹子','松','橡','枫','棕榈','仙人掌','藤','草药','杂草','开花','生长','土壤','肥料','收获','小麦','稻','玉米','棉花'] },
    { id:25, keywords:['weather','climate','temperature','hot','cold','warm','cool','rain','snow','wind','cloud','storm','thunder','lightning','hurricane','typhoon','tornado','flood','drought','fog','hail','ice','frost','humidity','forecast','sunny','cloudy','rainy','windy','season','spring','summer','autumn','winter'],
      cnKeywords:['天气','气候','温度','热','冷','温暖','凉爽','雨','雪','风','云','暴风雨','雷','闪电','飓风','台风','龙卷风','洪水','干旱','雾','冰雹','冰','霜','湿度','预报','晴','多云','有雨','有风','季节','春','夏','秋','冬','气象'] },
    { id:26, keywords:['geography','map','country','city','continent','ocean','sea','mountain','river','lake','desert','forest','island','coast','valley','hill','volcano','earthquake','population','border','capital','north','south','east','west','latitude','longitude','equator','tropical','region','territory'],
      cnKeywords:['地理','地图','国家','城市','大陆','海洋','山','河','湖','沙漠','森林','岛','海岸','山谷','山丘','火山','地震','人口','边界','首都','北','南','东','西','纬度','经度','赤道','热带','地区','领土','地名'] },
  ]),
  // 5. Emotions
  K(5, ['feel','feeling','emotion','emotional','mind','mental','mood','happy','sad','angry','afraid','love','hate','fear','joy','anger','surprise','hope','wish','dream','anxiety','stress','excitement','lonely','proud','shame','guilt','jealous','grateful','sorry','regret','disappoint','satisfy','frustrate','confuse','relax','calm','nervous','worry','confident','brave','kind','cruel','generous','selfish','honest','patient','smile','cry','laugh'],
    ['感觉','情感','情绪','心理','心情','快乐','悲伤','愤怒','害怕','爱','恨','恐惧','喜悦','惊讶','希望','愿望','梦想','焦虑','压力','兴奋','孤独','骄傲','羞愧','内疚','嫉妒','感激','抱歉','后悔','失望','满足','沮丧','困惑','放松','平静','紧张','担心','自信','勇敢','善良','残忍','慷慨','自私','诚实','耐心','微笑','哭','笑','感受','心态']),
  // 6. Health
  K(6, ['health','healthy','body','medical','medicine','doctor','nurse','hospital','clinic','patient','sick','ill','disease','pain','hurt','injury','wound','blood','bone','skin','muscle','heart','brain','lung','liver','kidney','stomach','exercise','diet','nutrition','vitamin','protein','surgery','operation','treatment','therapy','diagnosis','symptom','fever','cough','cold','flu','headache','cancer','infection','virus','bacteria','drug','pill','injection','vaccine','pharmacy','dental','tooth'],
    ['健康','身体','医学','药','医生','护士','医院','诊所','病人','疾病','疼痛','伤害','伤口','血液','骨','皮肤','肌肉','心脏','大脑','肺','肝','肾','胃','锻炼','饮食','营养','维生素','蛋白质','手术','治疗','疗法','诊断','症状','发烧','咳嗽','感冒','流感','头痛','癌症','感染','病毒','细菌','药物','药丸','注射','疫苗','药店','牙','医疗','养生']),
  // 7. Arts
  K(7, ['art','artist','culture','cultural','music','paint','painting','draw','color','design','sculpture','gallery','museum','exhibition','concert','theater','cinema','film','movie','drama','comedy','actor','actress','director','stage','performance','audience','dance','ballet','opera','song','singer','band','orchestra','instrument','piano','guitar','violin','drum','flute','jazz','rock','classical','pop','melody','rhythm','beat','photography','photo','camera','fashion','architecture','literature','poetry','novel'],
    ['艺术','文化','音乐','绘画','画','颜色','设计','雕塑','画廊','博物馆','展览','音乐会','剧院','电影','戏剧','喜剧','演员','导演','舞台','表演','观众','舞蹈','芭蕾','歌剧','歌曲','歌手','乐队','管弦乐队','乐器','钢琴','吉他','小提琴','鼓','笛','爵士','摇滚','古典','流行','旋律','节奏','摄影','照片','相机','时尚','建筑','文学','诗歌','小说','文艺']),
  // 8. Technology
  K(8, ['technology','tech','computer','digital','electronic','device','software','hardware','program','code','data','network','internet','web','website','app','application','mobile','phone','smartphone','screen','display','keyboard','mouse','printer','camera','sensor','chip','processor','memory','storage','battery','charge','cable','wireless','wifi','bluetooth','server','cloud','database','algorithm','robot','artificial','intelligence','machine','learning','virtual','reality','cyber','security','password','login','download','upload','search','email','message','update','install','debug','error','bug','crash'],
    ['科技','计算机','数字','电子','设备','软件','硬件','程序','代码','数据','网络','互联网','网站','应用','移动','电话','手机','屏幕','显示','键盘','鼠标','打印机','相机','传感器','芯片','处理器','内存','存储','电池','充电','电缆','无线','服务器','云','数据库','算法','机器人','人工','智能','机器学习','虚拟','现实','网络安全','密码','登录','下载','上传','搜索','电子邮件','消息','更新','安装','调试','错误','崩溃','数码','技术']),
  // 9. Travel
  K(9, ['travel','trip','journey','tour','tourism','tourist','vacation','holiday','hotel','motel','hostel','resort','airport','flight','airplane','plane','train','bus','taxi','car','bicycle','bike','ship','boat','ferry','subway','metro','station','terminal','ticket','passport','visa','departure','arrival','delay','cancel','reservation','booking','luggage','baggage','suitcase','backpack','map','guide','route','direction','destination','sightseeing','landmark','monument','beach','park','adventure','explore','road','street','highway','bridge','traffic','drive','ride','walk','distance','mile','kilometer'],
    ['旅行','旅程','旅游','游客','假期','旅馆','酒店','度假','机场','航班','飞机','火车','公交','出租车','汽车','自行车','船','渡轮','地铁','车站','航站楼','票','护照','签证','出发','到达','延误','取消','预订','行李','背包','地图','导游','路线','方向','目的地','观光','地标','纪念碑','海滩','公园','冒险','探索','道路','街道','高速','桥','交通','驾驶','骑行','步行','距离','英里','公里','出游','出行']),
  // 10. Society
  K(10, ['society','social','community','people','population','culture','tradition','custom','religion','belief','politics','political','government','president','leader','election','vote','democracy','policy','law','right','freedom','equality','justice','war','peace','military','army','navy','soldier','citizen','immigrant','foreign','national','international','global','local','urban','rural','village','poverty','wealth','class','race','gender','family','marriage','wedding','child','parent','relative','friend','neighbor','communication','media','news','journalist','report','speech','debate','protest'],
    ['社会','社区','人民','人口','文化','传统','习俗','宗教','信仰','政治','政府','总统','领袖','选举','投票','民主','政策','法律','权利','自由','平等','正义','战争','和平','军事','军队','海军','士兵','公民','移民','外国','国家','国际','全球','本地','城市','乡村','村庄','贫困','财富','阶级','种族','性别','家庭','婚姻','婚礼','孩子','父母','亲戚','朋友','邻居','交流','媒体','新闻','记者','报道','演讲','辩论','抗议','人文'])
]
