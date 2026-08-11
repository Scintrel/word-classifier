-- 002_seed_categories.sql
-- Seed data: pre-built semantic categories for word classification

-- Root-level categories
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

-- Sub-categories under Daily Life (parent_id = 1)
INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(12, 'Food & Drinks',   '饮食',   1, 'Food, drinks, and cooking',       '#3b82f6', 1),
(13, 'Clothing',        '服装',   1, 'Clothing, fashion, and accessories','#3b82f6', 2),
(14, 'Home & Living',   '家居生活',1, 'Home, furniture, and housework',   '#3b82f6', 3),
(15, 'Shopping',        '购物',   1, 'Shopping and consumer goods',       '#3b82f6', 4);

-- Sub-categories under Education (parent_id = 2)
INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(16, 'School',          '学校',   2, 'School life and campus',           '#10b981', 1),
(17, 'Mathematics',     '数学',   2, 'Mathematics and numbers',          '#10b981', 2),
(18, 'Science',         '科学',   2, 'Natural sciences',                  '#10b981', 3),
(19, 'Language',        '语言',   2, 'Language learning and linguistics', '#10b981', 4);

-- Sub-categories under Work (parent_id = 3)
INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(20, 'Business',        '商业',   3, 'Business and commerce',            '#f59e0b', 1),
(21, 'Finance',         '金融',   3, 'Finance, money, and banking',      '#f59e0b', 2),
(22, 'Law',             '法律',   3, 'Law and legal terms',              '#f59e0b', 3);

-- Sub-categories under Nature (parent_id = 4)
INSERT OR IGNORE INTO categories (id, name, name_cn, parent_id, description, color, sort_order) VALUES
(23, 'Animals',         '动物',   4, 'Animals and wildlife',             '#22c55e', 1),
(24, 'Plants',          '植物',   4, 'Plants, flowers, and trees',       '#22c55e', 2),
(25, 'Weather',         '天气',   4, 'Weather and climate',              '#22c55e', 3),
(26, 'Geography',       '地理',   4, 'Geography and landforms',          '#22c55e', 4);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('theme', 'system'),
('language', 'zh'),
('default_export_format', 'csv'),
('auto_classify_on_import', 'true'),
('strict_validation', 'false');
