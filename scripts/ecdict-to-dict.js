// Convert ECDICT CSV to dictionary JSON format
const fs = require('fs');
const { parse } = require('papaparse');

console.log('Reading ecdict.csv...');
const text = fs.readFileSync('resources/ecdict.csv', 'utf-8');

console.log('Parsing CSV...');
const result = parse(text, {
  header: true,
  skipEmptyLines: true,
  transform: (v) => v?.trim() || '',
  transformHeader: (h) => h.trim()
});

console.log(`Parsed ${result.data.length} rows`);

// Convert to dict format
const dict = [];
let skipped = 0;

for (const row of result.data) {
  const word = (row.word || '').trim();
  const phonetic = (row.phonetic || '').trim();
  const translation = (row.translation || '').trim();
  const pos = (row.pos || '').trim();
  // 考试标签（zk/gk/cet4/cet6/ky/toefl/ielts/gre）与 COCA 词频排名
  const tag = (row.tag || '').trim();
  const frqNum = parseInt((row.frq || '').trim(), 10);
  const frq = Number.isFinite(frqNum) && frqNum > 0 ? frqNum : null; // frq=0 表示无排名 → 存 null

  // Skip entries that don't have useful data
  if (!word || word.length < 2) { skipped++; continue; }
  if (!translation && !pos) { skipped++; continue; }

  // Clean up the translation: take first line, replace \n with ；
  const cleanDef = translation
    .replace(/\\n/g, '；')
    .replace(/\n/g, '；')
    .replace(/；\s*；/g, '；')
    .substring(0, 200); // Limit definition length

  // Map POS to simpler form
  const posSimple = pos.toLowerCase().split('.')[0] || '';

  // 音标规范化：ECDICT 使用西里尔字符 ә/є，转成标准 IPA ə/ɛ；
  // 无 // 包裹且看起来像音标的（不含中文/数字）补上 //
  const cleanPhonetic = phonetic.replace(/ә/g, 'ə').replace(/є/g, 'ɛ');
  let finalPhonetic = cleanPhonetic;
  if (finalPhonetic && !/^\/.*\/$/.test(finalPhonetic) && !/[一-鿿]/.test(finalPhonetic) && !/\d/.test(finalPhonetic)) {
    finalPhonetic = `/${finalPhonetic}/`;
  }

  const entry = {
    word: word,
    phonetic: finalPhonetic,
    definition: cleanDef,
    pos: posSimple || undefined
  };
  if (tag) entry.tag = tag;       // 空格连接原样保留，运行时再拆分
  if (frq !== null) entry.frq = frq;
  dict.push(entry);
}

const outFile = 'resources/ecdict-dict.json';
fs.writeFileSync(outFile, JSON.stringify(dict));
console.log(`Written ${dict.length} entries to ${outFile} (skipped ${skipped})`);
console.log(`File size: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB`);
