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
