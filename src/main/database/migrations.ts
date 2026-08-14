import { type Database as SqlJsDatabase } from 'sql.js'

/**
 * All migration SQL is embedded directly in the code.
 * This avoids issues with SQL files not being copied to the build output.
 */

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_initial.sql',
    sql: `
CREATE TABLE IF NOT EXISTS words (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word            TEXT NOT NULL,
    language        TEXT DEFAULT 'en',
    phonetic_uk     TEXT,
    phonetic_us     TEXT,
    part_of_speech  TEXT,
    definition_cn   TEXT,
    definition_en   TEXT,
    difficulty      TEXT DEFAULT 'unknown',
    frequency       REAL,
    source_file     TEXT,
    source_row      INTEGER,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(word, language)
);

CREATE TABLE IF NOT EXISTS examples (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         INTEGER NOT NULL,
    sentence_en     TEXT NOT NULL,
    sentence_cn     TEXT,
    source          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    name_cn         TEXT,
    parent_id       INTEGER,
    description     TEXT,
    color           TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS word_categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         INTEGER NOT NULL,
    category_id     INTEGER NOT NULL,
    confidence      REAL DEFAULT 1.0,
    is_manual       INTEGER DEFAULT 0,
    assigned_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(word_id, category_id)
);

CREATE TABLE IF NOT EXISTS word_relations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         INTEGER NOT NULL,
    related_word_id INTEGER NOT NULL,
    relation_type   TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (related_word_id) REFERENCES words(id) ON DELETE CASCADE,
    UNIQUE(word_id, related_word_id, relation_type)
);

CREATE TABLE IF NOT EXISTS import_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name       TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_format     TEXT NOT NULL,
    rows_total      INTEGER,
    rows_imported   INTEGER,
    rows_skipped    INTEGER DEFAULT 0,
    errors          TEXT,
    imported_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS validation_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         INTEGER,
    import_id       INTEGER,
    field           TEXT NOT NULL,
    issue_type      TEXT NOT NULL,
    original_value  TEXT,
    fixed_value     TEXT,
    fixed_by        TEXT DEFAULT 'auto',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE SET NULL,
    FOREIGN KEY (import_id) REFERENCES import_history(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_words_language ON words(language);
CREATE INDEX IF NOT EXISTS idx_words_difficulty ON words(difficulty);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_examples_word_id ON examples(word_id);
CREATE INDEX IF NOT EXISTS idx_word_categories_word ON word_categories(word_id);
CREATE INDEX IF NOT EXISTS idx_word_categories_category ON word_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
`
  },
  {
    name: '002_seed_categories.sql',
    sql: `
INSERT OR IGNORE INTO categories (id, name, name_cn, description, color, sort_order) VALUES
(1,  'Daily Life',   '日常生活', 'Daily life and routines',           '#3b82f6', 1),
(2,  'Education',    '学习教育', 'School, study, and academics',      '#10b981', 2),
(3,  'Work',         '工作职场', 'Career, business, and profession',  '#f59e0b', 3),
(4,  'Nature',       '自然世界', 'Nature, animals, and environment',  '#22c55e', 4),
(5,  'Emotions',     '情感心理', 'Feelings, emotions, and psychology','#ef4444', 5),
(6,  'Health',       '健康医疗', 'Health, medicine, and body',        '#ec4899', 6),
(7,  'Arts',         '文化艺术', 'Art, music, literature, and culture','#8b5cf6', 7),
(8,  'Technology',   '科技数码', 'Technology, computers, and digital', '#6366f1', 8),
(9,  'Travel',       '旅行交通', 'Travel, transportation, and places','#14b8a6', 9),
(10, 'Society',      '社会人文', 'Society, politics, and people',     '#f97316', 10),
(11, 'Uncategorized','未分类',   'Words not yet classified',          '#6b7280', 99);

INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(12, 'Food & Drinks',   '饮食',   1, 'Food, drinks, and cooking',       '#3b82f6', 1),
(13, 'Clothing',        '服装',   1, 'Clothing, fashion, and accessories','#3b82f6', 2),
(14, 'Home & Living',   '家居生活',1, 'Home, furniture, and housework',   '#3b82f6', 3),
(15, 'Shopping',        '购物',   1, 'Shopping and consumer goods',       '#3b82f6', 4),
(16, 'School',          '学校',   2, 'School life and campus',           '#10b981', 1),
(17, 'Mathematics',     '数学',   2, 'Mathematics and numbers',          '#10b981', 2),
(18, 'Science',         '科学',   2, 'Natural sciences',                  '#10b981', 3),
(19, 'Language',        '语言',   2, 'Language learning and linguistics', '#10b981', 4),
(20, 'Business',        '商业',   3, 'Business and commerce',            '#f59e0b', 1),
(21, 'Finance',         '金融',   3, 'Finance, money, and banking',      '#f59e0b', 2),
(22, 'Law',             '法律',   3, 'Law and legal terms',              '#f59e0b', 3),
(23, 'Animals',         '动物',   4, 'Animals and wildlife',             '#22c55e', 1),
(24, 'Plants',          '植物',   4, 'Plants, flowers, and trees',       '#22c55e', 2),
(25, 'Weather',         '天气',   4, 'Weather and climate',              '#22c55e', 3),
(26, 'Geography',       '地理',   4, 'Geography and landforms',          '#22c55e', 4),
-- Sub-categories under Emotions (parent_id = 5)
(27, 'Positive Feelings', '积极情绪', 5, 'Joy, love, excitement, gratitude', '#ef4444', 1),
(28, 'Negative Feelings', '消极情绪', 5, 'Sadness, anger, fear, anxiety',    '#ef4444', 2),
(29, 'Personality',       '性格特征', 5, 'Character traits and personality', '#ef4444', 3),
(30, 'Mental States',     '心理状态', 5, 'Mind, thought, memory, cognition', '#ef4444', 4),
-- Sub-categories under Health (parent_id = 6)
(31, 'Body Parts',        '人体部位', 6, 'Anatomy: organs, limbs, systems',  '#ec4899', 1),
(32, 'Illness & Symptoms','疾病症状', 6, 'Diseases, symptoms, conditions',   '#ec4899', 2),
(33, 'Medical Treatment', '医疗治疗', 6, 'Treatment, medicine, hospital',    '#ec4899', 3),
(34, 'Fitness & Diet',    '健身饮食', 6, 'Exercise, nutrition, wellness',    '#ec4899', 4),
-- Sub-categories under Arts (parent_id = 7)
(35, 'Music',             '音乐',     7, 'Music, instruments, singing',      '#8b5cf6', 1),
(36, 'Painting & Visual', '绘画视觉', 7, 'Painting, drawing, photography',   '#8b5cf6', 2),
(37, 'Literature',        '文学',     7, 'Novels, poetry, writing, reading',  '#8b5cf6', 3),
(38, 'Film & Theater',    '影视戏剧', 7, 'Movies, drama, performance',       '#8b5cf6', 4),
-- Sub-categories under Technology (parent_id = 8)
(39, 'Computer Hardware', '电脑硬件', 8, 'CPU, memory, storage, devices',     '#6366f1', 1),
(40, 'Software & Apps',   '软件应用', 8, 'Programs, apps, operating systems', '#6366f1', 2),
(41, 'Internet & Web',    '互联网',   8, 'Web, network, online services',     '#6366f1', 3),
(42, 'Programming',       '编程开发', 8, 'Code, algorithms, development',     '#6366f1', 4),
(43, 'Electronics',       '电子设备', 8, 'Gadgets, phones, digital devices',  '#6366f1', 5),
-- Sub-categories under Travel (parent_id = 9)
(44, 'Transportation',    '交通方式', 9, 'Vehicles, transit, driving, flying','#14b8a6', 1),
(45, 'Accommodation',     '住宿餐饮', 9, 'Hotels, restaurants, lodging',      '#14b8a6', 2),
(46, 'Sightseeing',       '观光景点', 9, 'Attractions, landmarks, scenery',   '#14b8a6', 3),
(47, 'Directions',        '方向位置', 9, 'Navigation, maps, locations',       '#14b8a6', 4),
-- Sub-categories under Society (parent_id = 10)
(48, 'Politics',          '政治',    10, 'Government, policy, elections',     '#f97316', 1),
(49, 'Economics',         '经济',    10, 'Trade, markets, development',       '#f97316', 2),
(50, 'Culture & Customs', '文化习俗',10, 'Traditions, customs, religion',     '#f97316', 3),
(51, 'Social Issues',     '社会问题',10, 'Poverty, crime, environment, rights','#f97316', 4);

INSERT OR IGNORE INTO settings (key, value) VALUES
('theme', 'system'),
('language', 'zh'),
('default_export_format', 'csv'),
('auto_classify_on_import', 'true'),
('strict_validation', 'false');
`
  },
  {
    // 抽象词分类：为不属于任何主题的词（able、accept、about 等）提供按词义/用途设计的分类
    name: '002_abstract_categories.sql',
    sql: `
INSERT OR IGNORE INTO categories (id, name, name_cn, description, color, sort_order) VALUES
(52, 'Basic Actions',      '动作行为', 'Abstract verbs: doing, changing, achieving', '#0ea5e9', 11),
(53, 'States & Qualities', '状态描述', 'Adjectives describing states and qualities', '#a855f7', 12),
(54, 'Degree & Manner',    '程度方式', 'Adverbs of degree, frequency, and manner',   '#f472b6', 13),
(55, 'Logic & Connection', '逻辑连接', 'Prepositions and conjunctions',              '#94a3b8', 14),
(56, 'Thinking & Cognition','认知思考', 'Verbs of thinking, believing, understanding','#facc15', 15),
(57, 'Abstract Concepts',  '抽象概念', 'Abstract nouns: qualities, time, quantity',  '#64748b', 16);

INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(58, 'Begin & End',        '开始结束', 52, 'Start, stop, finish, continue',        '#0ea5e9', 1),
(59, 'Give & Receive',     '获得给予', 52, 'Accept, receive, obtain, provide',     '#0ea5e9', 2),
(60, 'Change & Adjust',    '改变调整', 52, 'Change, adjust, adapt, modify',        '#0ea5e9', 3),
(61, 'Achieve & Complete', '完成达到', 52, 'Achieve, accomplish, complete',        '#0ea5e9', 4),
(62, 'Good & Bad',         '好坏优劣', 53, 'Good, bad, excellent, terrible',       '#a855f7', 1),
(63, 'Size & Degree',      '大小程度', 53, 'Big, small, huge, deep, wide',         '#a855f7', 2),
(64, 'Easy & Hard',        '难易简繁', 53, 'Easy, hard, simple, complex',          '#a855f7', 3),
(65, 'New & Old',          '新旧久暂', 53, 'New, old, ancient, modern, permanent', '#a855f7', 4),
(66, 'Frequency',          '频率',     54, 'Always, often, sometimes, rarely',     '#f472b6', 1),
(67, 'Degree',             '程度',     54, 'Very, quite, extremely, almost',       '#f472b6', 2),
(68, 'Manner',             '方式',     54, 'Quickly, slowly, carefully, suddenly', '#f472b6', 3),
(69, 'Time & Order',       '时间顺序', 54, 'First, then, finally, eventually',     '#f472b6', 4),
(70, 'Contrast',           '转折让步', 55, 'But, however, although, despite',      '#94a3b8', 1),
(71, 'Cause & Effect',     '因果',     55, 'Because, therefore, thus, hence',      '#94a3b8', 2),
(72, 'Addition',           '并列递进', 55, 'And, also, moreover, besides',         '#94a3b8', 3),
(73, 'Space & Time',       '时空方位', 55, 'Above, below, before, after, through', '#94a3b8', 4),
(74, 'Knowledge & Memory', '知识记忆', 56, 'Know, remember, recall, forget',      '#facc15', 1),
(75, 'Thinking & Judging', '思考判断', 56, 'Think, consider, judge, conclude',     '#facc15', 2),
(76, 'Belief & Doubt',     '相信怀疑', 56, 'Believe, trust, doubt, suspect',       '#facc15', 3),
(77, 'Understanding',      '理解领悟', 56, 'Understand, realize, recognize, grasp','#facc15', 4),
(78, 'Qualities & Traits', '品质特征', 57, 'Quality, feature, character, property','#64748b', 1),
(79, 'Time & Space',       '时间空间', 57, 'Time, moment, period, space, position','#64748b', 2),
(80, 'Quantity & Units',   '数量单位', 57, 'Number, amount, total, unit, part',    '#64748b', 3),
(81, 'Relations & Structure','关系结构',57, 'Relation, connection, structure, system','#64748b', 4);
`
  },
  {
    // 17 个根分类换成 17 种高区分度颜色（旧色板里蓝/靛/天蓝、绿/青、粉/玫红、灰/石板灰几乎一样）
    // 子类跟随父类颜色，视觉上自然分组
    name: '003_category_colors.sql',
    sql: `
UPDATE categories SET color = '#3b82f6' WHERE id = 1  OR parent_id = 1;
UPDATE categories SET color = '#10b981' WHERE id = 2  OR parent_id = 2;
UPDATE categories SET color = '#f59e0b' WHERE id = 3  OR parent_id = 3;
UPDATE categories SET color = '#22c55e' WHERE id = 4  OR parent_id = 4;
UPDATE categories SET color = '#ef4444' WHERE id = 5  OR parent_id = 5;
UPDATE categories SET color = '#ec4899' WHERE id = 6  OR parent_id = 6;
UPDATE categories SET color = '#8b5cf6' WHERE id = 7  OR parent_id = 7;
UPDATE categories SET color = '#6366f1' WHERE id = 8  OR parent_id = 8;
UPDATE categories SET color = '#06b6d4' WHERE id = 9  OR parent_id = 9;
UPDATE categories SET color = '#f97316' WHERE id = 10 OR parent_id = 10;
UPDATE categories SET color = '#9ca3af' WHERE id = 11 OR parent_id = 11;
UPDATE categories SET color = '#0ea5e9' WHERE id = 52 OR parent_id = 52;
UPDATE categories SET color = '#d946ef' WHERE id = 53 OR parent_id = 53;
UPDATE categories SET color = '#f43f5e' WHERE id = 54 OR parent_id = 54;
UPDATE categories SET color = '#14b8a6' WHERE id = 55 OR parent_id = 55;
UPDATE categories SET color = '#eab308' WHERE id = 56 OR parent_id = 56;
UPDATE categories SET color = '#84cc16' WHERE id = 57 OR parent_id = 57;`
  },
  {
    // 开发者模式：用户小词典（优先级高于内置 ECDICT）+ 修改日志（一切改动可追溯、可撤销）
    name: '004_dev_mode.sql',
    sql: `
CREATE TABLE IF NOT EXISTS dict_entries (
    word            TEXT PRIMARY KEY,
    phonetic        TEXT,
    definition      TEXT,
    pos             TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_key      TEXT NOT NULL,
    action          TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_log_created ON change_log(created_at);`
  },
  {
    // 操作记录：自动记录用户的关键操作（页面切换/检查/补全/导入/分类/编辑等），
    // 出问题时 Claude 可直接读这张表还原用户的操作过程
    name: '005_user_action_log.sql',
    sql: `
CREATE TABLE IF NOT EXISTS user_action_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    page            TEXT,
    action          TEXT NOT NULL,
    detail          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_action_created ON user_action_log(created_at);`
  }
]

/**
 * Create the migrations tracking table if it doesn't exist.
 */
function ensureMigrationTable(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      run_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

/**
 * Query helper for sql.js
 */
function queryAll(db: SqlJsDatabase, sql: string): Record<string, unknown>[] {
  const result = db.exec(sql)
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

/**
 * Run all pending migrations. SQL is embedded directly in the code,
 * so no external files are needed at runtime.
 */
export function runMigrations(db: SqlJsDatabase): void {
  ensureMigrationTable(db)

  const ran = new Set(
    queryAll(db, 'SELECT name FROM _migrations').map((r) => r.name as string)
  )

  let newMigrations = 0
  for (const migration of MIGRATIONS) {
    if (ran.has(migration.name)) continue
    console.log(`Running migration: ${migration.name}`)
    db.run(migration.sql)
    db.run('INSERT INTO _migrations (name) VALUES (?)', [migration.name])
    newMigrations++
  }

  console.log(
    `Migrations complete. ${MIGRATIONS.length} total, ${newMigrations} new.`
  )
}
