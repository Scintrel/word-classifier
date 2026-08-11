-- 单词分类app - Initial Database Schema
-- 001_initial.sql

-- ============================================
-- Words table: stores all vocabulary entries
-- ============================================
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

-- ============================================
-- Examples table: example sentences for words
-- ============================================
CREATE TABLE IF NOT EXISTS examples (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id         INTEGER NOT NULL,
    sentence_en     TEXT NOT NULL,
    sentence_cn     TEXT,
    source          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- ============================================
-- Categories table: semantic categories (can be nested)
-- ============================================
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

-- ============================================
-- Word-Categories: many-to-many relationship
-- ============================================
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

-- ============================================
-- Word Relations: synonyms, antonyms, etc.
-- ============================================
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

-- ============================================
-- Import History: track all file imports
-- ============================================
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

-- ============================================
-- Validation Log: audit trail for data issues
-- ============================================
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

-- ============================================
-- Settings: key-value app preferences
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Performance Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_words_language ON words(language);
CREATE INDEX IF NOT EXISTS idx_words_difficulty ON words(difficulty);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_examples_word_id ON examples(word_id);
CREATE INDEX IF NOT EXISTS idx_word_categories_word ON word_categories(word_id);
CREATE INDEX IF NOT EXISTS idx_word_categories_category ON word_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
