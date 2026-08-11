/**
 * Category keyword seed data.
 *
 * Each category has a list of English keywords. When classifying a word,
 * the classifier checks:
 * 1. Does the word itself match a keyword?
 * 2. Does the word's definition contain any keywords?
 * 3. Does the word's part of speech match the category's typical POS?
 *
 * Category IDs match the seeded categories from 002_seed_categories.sql.
 */

export interface CategoryKeywords {
  categoryId: number
  keywords: string[]
  /** Sub-category keywords (keyed by sub-category ID) */
  subCategories?: { id: number; keywords: string[] }[]
}

export const CATEGORY_KEYWORDS: CategoryKeywords[] = [
  // ==========================================
  // 1. Daily Life (日常生活) — ID: 1
  // ==========================================
  {
    categoryId: 1,
    keywords: [
      'life', 'daily', 'routine', 'home', 'house', 'family', 'live', 'living',
      'wake', 'sleep', 'morning', 'evening', 'breakfast', 'lunch', 'dinner',
      'room', 'kitchen', 'bathroom', 'bedroom', 'garden', 'yard', 'door',
      'window', 'floor', 'clean', 'wash', 'cook', 'shop', 'buy', 'wear'
    ],
    subCategories: [
      // 12. Food & Drinks (饮食)
      {
        id: 12,
        keywords: [
          'food', 'drink', 'eat', 'cook', 'meal', 'breakfast', 'lunch', 'dinner',
          'rice', 'bread', 'meat', 'fish', 'chicken', 'beef', 'pork', 'vegetable',
          'fruit', 'apple', 'banana', 'orange', 'grape', 'milk', 'water', 'juice',
          'tea', 'coffee', 'wine', 'beer', 'sugar', 'salt', 'sweet', 'sour', 'spicy',
          'taste', 'flavor', 'delicious', 'hungry', 'thirsty', 'restaurant', 'menu',
          'chef', 'bake', 'boil', 'fry', 'roast', 'grill', 'recipe', 'ingredient',
          'snack', 'dessert', 'cake', 'soup', 'salad', 'sauce', 'cheese', 'butter',
          'egg', 'noodle', 'pasta', 'pizza', 'burger', 'sandwich', 'chocolate',
          'cookie', 'candy', 'pie', 'cream', 'oil', 'flour', 'wheat', 'corn', 'bean',
          'potato', 'tomato', 'onion', 'garlic', 'pepper', 'mushroom'
        ]
      },
      // 13. Clothing (服装)
      {
        id: 13,
        keywords: [
          'clothes', 'clothing', 'wear', 'dress', 'shirt', 'pants', 'jeans', 'jacket',
          'coat', 'sweater', 'skirt', 'suit', 'tie', 'shoe', 'boot', 'sock', 'hat',
          'cap', 'glove', 'scarf', 'belt', 'pocket', 'button', 'zip', 'fashion',
          'style', 'cotton', 'silk', 'wool', 'leather', 'uniform', 'casual', 'formal',
          'size', 'fit', 'tight', 'loose', 'wear', 'put on', 'take off', 'change'
        ]
      },
      // 14. Home & Living (家居生活)
      {
        id: 14,
        keywords: [
          'home', 'house', 'apartment', 'room', 'kitchen', 'bathroom', 'bedroom',
          'living room', 'door', 'window', 'floor', 'wall', 'ceiling', 'roof',
          'furniture', 'table', 'chair', 'bed', 'sofa', 'desk', 'shelf', 'cabinet',
          'drawer', 'lamp', 'light', 'curtain', 'carpet', 'mirror', 'clock',
          'key', 'lock', 'clean', 'wash', 'tidy', 'decoration', 'painting', 'plant'
        ]
      },
      // 15. Shopping (购物)
      {
        id: 15,
        keywords: [
          'shop', 'shopping', 'store', 'market', 'mall', 'buy', 'sell', 'price',
          'cost', 'cheap', 'expensive', 'discount', 'sale', 'bargain', 'receipt',
          'cash', 'credit', 'card', 'pay', 'payment', 'money', 'dollar', 'bill',
          'customer', 'brand', 'product', 'quality', 'warranty', 'return', 'refund',
          'online', 'order', 'delivery', 'package'
        ]
      }
    ]
  },

  // ==========================================
  // 2. Education (学习教育) — ID: 2
  // ==========================================
  {
    categoryId: 2,
    keywords: [
      'school', 'education', 'learn', 'study', 'teach', 'student', 'teacher',
      'class', 'lesson', 'course', 'grade', 'exam', 'test', 'quiz', 'score',
      'homework', 'textbook', 'notebook', 'pencil', 'pen', 'paper', 'read',
      'write', 'library', 'knowledge', 'subject', 'major', 'graduate', 'degree'
    ],
    subCategories: [
      // 16. School (学校)
      {
        id: 16,
        keywords: [
          'school', 'campus', 'classroom', 'playground', 'principal', 'professor',
          'lecture', 'semester', 'term', 'vacation', 'holiday', 'summer', 'winter',
          'dormitory', 'cafeteria', 'uniform', 'textbook', 'backpack', 'locker',
          'schedule', 'timetable', 'register', 'enroll', 'attend', 'absent', 'tardy'
        ]
      },
      // 17. Mathematics (数学)
      {
        id: 17,
        keywords: [
          'math', 'mathematics', 'number', 'add', 'subtract', 'multiply', 'divide',
          'plus', 'minus', 'equal', 'sum', 'total', 'average', 'percent', 'fraction',
          'decimal', 'ratio', 'angle', 'area', 'volume', 'length', 'width', 'height',
          'circle', 'square', 'triangle', 'rectangle', 'radius', 'diameter',
          'formula', 'equation', 'algebra', 'geometry', 'calculus', 'statistics',
          'graph', 'chart', 'axis', 'coordinate', 'probability', 'logic', 'proof'
        ]
      },
      // 18. Science (科学)
      {
        id: 18,
        keywords: [
          'science', 'physics', 'chemistry', 'biology', 'experiment', 'laboratory',
          'scientist', 'theory', 'hypothesis', 'research', 'discover', 'observe',
          'atom', 'molecule', 'element', 'compound', 'reaction', 'energy', 'force',
          'gravity', 'mass', 'speed', 'temperature', 'pressure', 'electric', 'magnetic',
          'cell', 'organism', 'species', 'evolution', 'gene', 'DNA', 'protein',
          'chemical', 'acid', 'base', 'oxygen', 'hydrogen', 'carbon', 'nitrogen',
          'planet', 'star', 'galaxy', 'universe', 'earth', 'space', 'moon', 'sun'
        ]
      },
      // 19. Language (语言)
      {
        id: 19,
        keywords: [
          'language', 'english', 'chinese', 'word', 'vocabulary', 'grammar',
          'sentence', 'paragraph', 'essay', 'article', 'letter', 'spelling',
          'pronunciation', 'phonetic', 'syllable', 'vowel', 'consonant', 'accent',
          'translate', 'translation', 'meaning', 'definition', 'synonym', 'antonym',
          'phrase', 'idiom', 'metaphor', 'poem', 'poetry', 'literature', 'novel',
          'dictionary', 'speak', 'speech', 'listen', 'conversation', 'dialogue',
          'noun', 'verb', 'adjective', 'adverb', 'preposition', 'tense', 'plural'
        ]
      }
    ]
  },

  // ==========================================
  // 3. Work (工作职场) — ID: 3
  // ==========================================
  {
    categoryId: 3,
    keywords: [
      'work', 'job', 'career', 'office', 'company', 'business', 'manager',
      'employee', 'boss', 'colleague', 'meeting', 'deadline', 'project', 'task',
      'salary', 'wage', 'promotion', 'hire', 'fire', 'resign', 'interview',
      'resume', 'profession', 'industry', 'trade', 'skill', 'training'
    ],
    subCategories: [
      // 20. Business (商业)
      {
        id: 20,
        keywords: [
          'business', 'company', 'corporation', 'enterprise', 'startup', 'office',
          'manager', 'CEO', 'director', 'executive', 'staff', 'team', 'department',
          'marketing', 'sales', 'advertising', 'brand', 'customer', 'client',
          'contract', 'deal', 'negotiate', 'partner', 'competitor', 'strategy',
          'goal', 'revenue', 'profit', 'loss', 'budget', 'report', 'presentation',
          'proposal', 'agenda', 'minutes', 'memo', 'email', 'schedule', 'appointment'
        ]
      },
      // 21. Finance (金融)
      {
        id: 21,
        keywords: [
          'money', 'bank', 'finance', 'financial', 'account', 'saving', 'checking',
          'deposit', 'withdraw', 'transfer', 'loan', 'debt', 'credit', 'interest',
          'rate', 'mortgage', 'invest', 'investment', 'stock', 'share', 'bond',
          'fund', 'market', 'trading', 'dividend', 'portfolio', 'asset', 'liability',
          'tax', 'income', 'expense', 'budget', 'audit', 'accounting', 'invoice',
          'currency', 'dollar', 'euro', 'yen', 'exchange', 'inflation', 'deflation'
        ]
      },
      // 22. Law (法律)
      {
        id: 22,
        keywords: [
          'law', 'legal', 'court', 'judge', 'jury', 'lawyer', 'attorney', 'trial',
          'case', 'evidence', 'witness', 'defendant', 'plaintiff', 'guilty',
          'innocent', 'crime', 'criminal', 'prison', 'jail', 'sentence', 'punishment',
          'fine', 'appeal', 'verdict', 'right', 'justice', 'rights', 'freedom',
          'constitution', 'statute', 'regulation', 'license', 'permit', 'contract',
          'agreement', 'violate', 'illegal', 'theft', 'fraud', 'murder', 'assault'
        ]
      }
    ]
  },

  // ==========================================
  // 4. Nature (自然世界) — ID: 4
  // ==========================================
  {
    categoryId: 4,
    keywords: [
      'nature', 'natural', 'world', 'earth', 'environment', 'outdoor', 'wild',
      'forest', 'mountain', 'river', 'ocean', 'sea', 'lake', 'sky', 'sun',
      'moon', 'star', 'tree', 'flower', 'grass', 'field', 'desert', 'island'
    ],
    subCategories: [
      // 23. Animals (动物)
      {
        id: 23,
        keywords: [
          'animal', 'wildlife', 'mammal', 'bird', 'fish', 'reptile', 'insect',
          'dog', 'cat', 'horse', 'cow', 'sheep', 'pig', 'chicken', 'duck',
          'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'rabbit', 'mouse',
          'elephant', 'monkey', 'snake', 'frog', 'turtle', 'whale', 'dolphin',
          'shark', 'eagle', 'owl', 'parrot', 'penguin', 'butterfly', 'bee',
          'ant', 'spider', 'zoo', 'pet', 'hunt', 'feed', 'breed', 'wing', 'tail',
          'paw', 'claw', 'feather', 'fur', 'scale', 'nest', 'cage', 'wild', 'tame'
        ]
      },
      // 24. Plants (植物)
      {
        id: 24,
        keywords: [
          'plant', 'tree', 'flower', 'grass', 'leaf', 'root', 'stem', 'seed',
          'fruit', 'vegetable', 'crop', 'garden', 'forest', 'wood', 'bush',
          'rose', 'lily', 'daisy', 'tulip', 'orchid', 'bamboo', 'pine', 'oak',
          'maple', 'palm', 'cactus', 'vine', 'herb', 'weed', 'bloom', 'blossom',
          'grow', 'plant', 'water', 'soil', 'fertilizer', 'harvest', 'crop',
          'wheat', 'rice', 'corn', 'cotton', 'coffee', 'tea', 'tobacco'
        ]
      },
      // 25. Weather (天气)
      {
        id: 25,
        keywords: [
          'weather', 'climate', 'temperature', 'hot', 'cold', 'warm', 'cool',
          'rain', 'snow', 'wind', 'cloud', 'storm', 'thunder', 'lightning',
          'hurricane', 'typhoon', 'tornado', 'flood', 'drought', 'fog', 'hail',
          'ice', 'frost', 'humidity', 'forecast', 'sunny', 'cloudy', 'rainy',
          'windy', 'stormy', 'freeze', 'melt', 'blow', 'shine', 'degree',
          'celsius', 'fahrenheit', 'season', 'spring', 'summer', 'autumn', 'winter'
        ]
      },
      // 26. Geography (地理)
      {
        id: 26,
        keywords: [
          'geography', 'map', 'country', 'city', 'continent', 'ocean', 'sea',
          'mountain', 'river', 'lake', 'desert', 'forest', 'island', 'coast',
          'valley', 'hill', 'volcano', 'earthquake', 'climate', 'population',
          'border', 'capital', 'north', 'south', 'east', 'west', 'latitude',
          'longitude', 'equator', 'pole', 'arctic', 'antarctic', 'tropical',
          'temperate', 'region', 'territory', 'land', 'glacier', 'canyon', 'cave'
        ]
      }
    ]
  },

  // ==========================================
  // 5. Emotions (情感心理) — ID: 5
  // ==========================================
  {
    categoryId: 5,
    keywords: [
      'feel', 'feeling', 'emotion', 'emotional', 'mind', 'mental', 'mood',
      'happy', 'sad', 'angry', 'afraid', 'love', 'hate', 'fear', 'joy',
      'anger', 'surprise', 'disgust', 'trust', 'hope', 'wish', 'dream',
      'anxiety', 'stress', 'depression', 'excitement', 'boredom', 'lonely',
      'proud', 'shame', 'guilt', 'jealous', 'envy', 'grateful', 'sorry',
      'regret', 'disappoint', 'satisfy', 'frustrate', 'confuse', 'relax',
      'calm', 'nervous', 'worry', 'doubt', 'confident', 'brave', 'coward',
      'kind', 'cruel', 'generous', 'selfish', 'honest', 'loyal', 'patient',
      'personality', 'character', 'behavior', 'attitude', 'temper', 'patience',
      'smile', 'cry', 'laugh', 'sigh', 'shout', 'whisper', 'comfort', 'hurt'
    ]
  },

  // ==========================================
  // 6. Health (健康医疗) — ID: 6
  // ==========================================
  {
    categoryId: 6,
    keywords: [
      'health', 'healthy', 'body', 'medical', 'medicine', 'doctor', 'nurse',
      'hospital', 'clinic', 'patient', 'sick', 'ill', 'disease', 'pain',
      'hurt', 'injury', 'wound', 'blood', 'bone', 'skin', 'muscle', 'heart',
      'brain', 'lung', 'liver', 'kidney', 'stomach', 'exercise', 'diet',
      'nutrition', 'vitamin', 'mineral', 'protein', 'calorie', 'weight',
      'surgery', 'operation', 'treatment', 'therapy', 'diagnosis', 'symptom',
      'fever', 'cough', 'cold', 'flu', 'headache', 'cancer', 'infection',
      'virus', 'bacteria', 'drug', 'pill', 'tablet', 'injection', 'vaccine',
      'pharmacy', 'prescription', 'dental', 'dentist', 'tooth', 'eye', 'ear'
    ]
  },

  // ==========================================
  // 7. Arts (文化艺术) — ID: 7
  // ==========================================
  {
    categoryId: 7,
    keywords: [
      'art', 'artist', 'culture', 'cultural', 'music', 'musical', 'paint',
      'painting', 'draw', 'drawing', 'color', 'design', 'sculpture', 'statue',
      'gallery', 'museum', 'exhibition', 'concert', 'theater', 'cinema', 'film',
      'movie', 'drama', 'comedy', 'tragedy', 'actor', 'actress', 'director',
      'stage', 'performance', 'audience', 'applause', 'dance', 'ballet', 'opera',
      'song', 'sing', 'singer', 'band', 'orchestra', 'instrument', 'piano',
      'guitar', 'violin', 'drum', 'flute', 'jazz', 'rock', 'classical', 'pop',
      'melody', 'rhythm', 'beat', 'tune', 'lyric', 'compose', 'photography',
      'photo', 'camera', 'lens', 'image', 'portrait', 'landscape', 'abstract',
      'fashion', 'architecture', 'architect', 'literature', 'poetry', 'novel'
    ]
  },

  // ==========================================
  // 8. Technology (科技数码) — ID: 8
  // ==========================================
  {
    categoryId: 8,
    keywords: [
      'technology', 'tech', 'computer', 'digital', 'electronic', 'device',
      'software', 'hardware', 'program', 'code', 'data', 'network', 'internet',
      'web', 'website', 'app', 'application', 'mobile', 'phone', 'smartphone',
      'screen', 'display', 'keyboard', 'mouse', 'printer', 'camera', 'sensor',
      'chip', 'processor', 'memory', 'storage', 'battery', 'charge', 'cable',
      'wireless', 'wifi', 'bluetooth', 'signal', 'connect', 'server', 'cloud',
      'database', 'algorithm', 'robot', 'artificial', 'intelligence', 'machine',
      'learning', 'automation', 'virtual', 'reality', 'cyber', 'security',
      'encrypt', 'password', 'login', 'logout', 'download', 'upload', 'stream',
      'search', 'engine', 'browser', 'social', 'media', 'email', 'message',
      'notification', 'update', 'upgrade', 'install', 'setup', 'configure',
      'debug', 'error', 'bug', 'crash', 'reboot', 'restart', 'shutdown'
    ]
  },

  // ==========================================
  // 9. Travel (旅行交通) — ID: 9
  // ==========================================
  {
    categoryId: 9,
    keywords: [
      'travel', 'trip', 'journey', 'tour', 'tourism', 'tourist', 'visitor',
      'vacation', 'holiday', 'hotel', 'motel', 'hostel', 'resort', 'airport',
      'flight', 'airplane', 'plane', 'train', 'bus', 'taxi', 'car', 'bicycle',
      'bike', 'ship', 'boat', 'ferry', 'subway', 'metro', 'station', 'terminal',
      'ticket', 'passport', 'visa', 'boarding', 'departure', 'arrival', 'delay',
      'cancel', 'reservation', 'booking', 'check in', 'check out', 'luggage',
      'baggage', 'suitcase', 'backpack', 'map', 'guide', 'route', 'direction',
      'destination', 'sightseeing', 'landmark', 'monument', 'beach', 'park',
      'mountain', 'lake', 'adventure', 'explore', 'wander', 'wanderlust',
      'road', 'street', 'highway', 'bridge', 'traffic', 'drive', 'ride', 'walk',
      'distance', 'mile', 'kilometer', 'speed', 'fast', 'slow', 'near', 'far'
    ]
  },

  // ==========================================
  // 10. Society (社会人文) — ID: 10
  // ==========================================
  {
    categoryId: 10,
    keywords: [
      'society', 'social', 'community', 'people', 'population', 'culture',
      'tradition', 'custom', 'religion', 'belief', 'politics', 'political',
      'government', 'president', 'leader', 'election', 'vote', 'democracy',
      'republic', 'monarchy', 'dictator', 'policy', 'law', 'right', 'freedom',
      'equality', 'justice', 'war', 'peace', 'military', 'army', 'navy', 'soldier',
      'citizen', 'immigrant', 'refugee', 'foreign', 'domestic', 'national',
      'international', 'global', 'local', 'urban', 'rural', 'suburb', 'village',
      'poverty', 'wealth', 'class', 'status', 'race', 'gender', 'age', 'generation',
      'family', 'marriage', 'wedding', 'divorce', 'child', 'parent', 'relative',
      'friend', 'neighbor', 'network', 'communication', 'media', 'news', 'press',
      'journalist', 'report', 'interview', 'speech', 'debate', 'protest', 'rally'
    ]
  }
]
