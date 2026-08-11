/**
 * Category keyword seed data — used by the classifier for keyword matching.
 * Format: { categoryId, keywords[] }
 * Sub-categories defined with their own categoryId and parent relation already seeded in DB.
 */

export interface CategoryKeywords {
  categoryId: number
  keywords: string[]
  subCategories?: { id: number; keywords: string[] }[]
}

const K = (id: number, kw: string[], sub?: { id: number; keywords: string[] }[]): CategoryKeywords =>
  ({ categoryId: id, keywords: kw, subCategories: sub })

export const CATEGORY_KEYWORDS: CategoryKeywords[] = [
  // 1. Daily Life & sub-categories
  K(1, ['life','daily','routine','home','house','family','live','wake','sleep','morning','evening','breakfast','lunch','dinner','room','kitchen','bathroom','bedroom','garden','door','window','floor','clean','wash','cook','shop','buy','wear'],[
    { id:12, keywords:['food','drink','eat','cook','meal','rice','bread','meat','fish','chicken','beef','pork','vegetable','fruit','apple','banana','orange','milk','water','juice','tea','coffee','wine','beer','sugar','salt','sweet','sour','spicy','taste','flavor','delicious','hungry','thirsty','restaurant','menu','chef','bake','boil','fry','roast','grill','recipe','ingredient','snack','dessert','cake','soup','salad','sauce','cheese','butter','egg','noodle','pasta','pizza','sandwich','chocolate','cookie','potato','tomato','onion','garlic','pepper']},
    { id:13, keywords:['clothes','clothing','wear','dress','shirt','pants','jeans','jacket','coat','sweater','skirt','suit','tie','shoe','boot','sock','hat','cap','glove','scarf','belt','pocket','button','fashion','style','cotton','silk','wool','leather','uniform','casual','formal','size','fit','tight','loose']},
    { id:14, keywords:['home','house','apartment','room','kitchen','bathroom','bedroom','door','window','floor','wall','ceiling','roof','furniture','table','chair','bed','sofa','desk','shelf','cabinet','drawer','lamp','light','curtain','carpet','mirror','clock','key','lock','clean','wash','tidy','decoration','painting','plant']},
    { id:15, keywords:['shop','shopping','store','market','mall','buy','sell','price','cost','cheap','expensive','discount','sale','bargain','receipt','cash','credit','card','pay','payment','money','dollar','bill','customer','brand','product','quality','warranty','refund','online','order','delivery','package']},
  ]),
  // 2. Education & sub-categories
  K(2, ['school','education','learn','study','teach','student','teacher','class','lesson','course','grade','exam','test','quiz','score','homework','textbook','notebook','pencil','pen','paper','read','write','library','knowledge','subject','major','graduate','degree'],[
    { id:16, keywords:['school','campus','classroom','playground','principal','professor','lecture','semester','term','vacation','holiday','dormitory','cafeteria','uniform','textbook','backpack','locker','schedule','timetable','register','enroll','attend','absent']},
    { id:17, keywords:['math','mathematics','number','add','subtract','multiply','divide','plus','minus','equal','sum','total','average','percent','fraction','decimal','ratio','angle','area','volume','length','width','height','circle','square','triangle','rectangle','radius','diameter','formula','equation','algebra','geometry','calculus','statistics','graph','chart']},
    { id:18, keywords:['science','physics','chemistry','biology','experiment','laboratory','scientist','theory','hypothesis','research','discover','observe','atom','molecule','element','compound','reaction','energy','force','gravity','mass','speed','temperature','pressure','electric','magnetic','cell','organism','species','evolution','gene','DNA','protein','oxygen','hydrogen','carbon']},
    { id:19, keywords:['language','english','chinese','word','vocabulary','grammar','sentence','paragraph','essay','spelling','pronunciation','phonetic','vowel','consonant','accent','translate','translation','meaning','definition','synonym','antonym','phrase','idiom','poem','poetry','literature','novel','dictionary','speak','listen','conversation','noun','verb','adjective','adverb']},
  ]),
  // 3. Work & sub-categories
  K(3, ['work','job','career','office','company','business','manager','employee','boss','colleague','meeting','deadline','project','task','salary','wage','promotion','hire','fire','resign','interview','resume','profession','industry','skill','training'],[
    { id:20, keywords:['business','company','corporation','enterprise','office','manager','CEO','director','executive','staff','team','department','marketing','sales','advertising','brand','customer','client','contract','deal','negotiate','partner','competitor','strategy','goal','revenue','profit','loss','budget','report','presentation','proposal','email','schedule','appointment']},
    { id:21, keywords:['money','bank','finance','financial','account','saving','deposit','withdraw','transfer','loan','debt','credit','interest','rate','mortgage','invest','investment','stock','share','bond','fund','market','trading','asset','tax','income','expense','budget','accounting','invoice','currency','dollar','euro','yen','exchange','inflation']},
    { id:22, keywords:['law','legal','court','judge','jury','lawyer','attorney','trial','case','evidence','witness','defendant','guilty','innocent','crime','criminal','prison','jail','sentence','punishment','fine','appeal','verdict','right','justice','freedom','constitution','regulation','license','permit','contract','agreement','illegal','theft','fraud']},
  ]),
  // 4. Nature & sub-categories
  K(4, ['nature','natural','world','earth','environment','outdoor','wild','forest','mountain','river','ocean','sea','lake','sky','sun','moon','star','tree','flower','grass','field','desert','island'],[
    { id:23, keywords:['animal','wildlife','mammal','bird','fish','reptile','insect','dog','cat','horse','cow','sheep','pig','chicken','duck','lion','tiger','bear','wolf','fox','deer','rabbit','mouse','elephant','monkey','snake','frog','turtle','whale','dolphin','shark','eagle','owl','parrot','penguin','butterfly','bee','ant','spider','zoo','pet','wing','tail','feather','fur']},
    { id:24, keywords:['plant','tree','flower','grass','leaf','root','stem','seed','fruit','vegetable','crop','garden','forest','wood','rose','lily','daisy','tulip','bamboo','pine','oak','maple','palm','cactus','vine','herb','weed','bloom','grow','soil','fertilizer','harvest','wheat','rice','corn','cotton','coffee','tea']},
    { id:25, keywords:['weather','climate','temperature','hot','cold','warm','cool','rain','snow','wind','cloud','storm','thunder','lightning','hurricane','typhoon','tornado','flood','drought','fog','hail','ice','frost','humidity','forecast','sunny','cloudy','rainy','windy','season','spring','summer','autumn','winter']},
    { id:26, keywords:['geography','map','country','city','continent','ocean','sea','mountain','river','lake','desert','forest','island','coast','valley','hill','volcano','earthquake','population','border','capital','north','south','east','west','latitude','longitude','equator','tropical','region','territory']},
  ]),
  // 5. Emotions
  K(5, ['feel','feeling','emotion','emotional','mind','mental','mood','happy','sad','angry','afraid','love','hate','fear','joy','anger','surprise','hope','wish','dream','anxiety','stress','excitement','lonely','proud','shame','guilt','jealous','grateful','sorry','regret','disappoint','satisfy','frustrate','confuse','relax','calm','nervous','worry','confident','brave','kind','cruel','generous','selfish','honest','patient','smile','cry','laugh']),
  // 6. Health
  K(6, ['health','healthy','body','medical','medicine','doctor','nurse','hospital','clinic','patient','sick','ill','disease','pain','hurt','injury','wound','blood','bone','skin','muscle','heart','brain','lung','liver','kidney','stomach','exercise','diet','nutrition','vitamin','protein','surgery','operation','treatment','therapy','diagnosis','symptom','fever','cough','cold','flu','headache','cancer','infection','virus','bacteria','drug','pill','injection','vaccine','pharmacy','dental','tooth']),
  // 7. Arts
  K(7, ['art','artist','culture','cultural','music','paint','painting','draw','color','design','sculpture','gallery','museum','exhibition','concert','theater','cinema','film','movie','drama','comedy','actor','actress','director','stage','performance','audience','dance','ballet','opera','song','singer','band','orchestra','instrument','piano','guitar','violin','drum','flute','jazz','rock','classical','pop','melody','rhythm','beat','photography','photo','camera','fashion','architecture','literature','poetry','novel']),
  // 8. Technology
  K(8, ['technology','tech','computer','digital','electronic','device','software','hardware','program','code','data','network','internet','web','website','app','application','mobile','phone','smartphone','screen','display','keyboard','mouse','printer','camera','sensor','chip','processor','memory','storage','battery','charge','cable','wireless','wifi','bluetooth','server','cloud','database','algorithm','robot','artificial','intelligence','machine','learning','virtual','reality','cyber','security','password','login','download','upload','search','email','message','update','install','debug','error','bug','crash']),
  // 9. Travel
  K(9, ['travel','trip','journey','tour','tourism','tourist','vacation','holiday','hotel','motel','hostel','resort','airport','flight','airplane','plane','train','bus','taxi','car','bicycle','bike','ship','boat','ferry','subway','metro','station','terminal','ticket','passport','visa','departure','arrival','delay','cancel','reservation','booking','luggage','baggage','suitcase','backpack','map','guide','route','direction','destination','sightseeing','landmark','monument','beach','park','adventure','explore','road','street','highway','bridge','traffic','drive','ride','walk','distance','mile','kilometer']),
  // 10. Society
  K(10, ['society','social','community','people','population','culture','tradition','custom','religion','belief','politics','political','government','president','leader','election','vote','democracy','policy','law','right','freedom','equality','justice','war','peace','military','army','navy','soldier','citizen','immigrant','foreign','national','international','global','local','urban','rural','village','poverty','wealth','class','race','gender','family','marriage','wedding','child','parent','relative','friend','neighbor','communication','media','news','journalist','report','speech','debate','protest']),
]
