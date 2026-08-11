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

  dict.push({
    word: word,
    phonetic: phonetic,
    definition: cleanDef,
    pos: posSimple || undefined
  });
}

const outFile = 'resources/ecdict-dict.json';
fs.writeFileSync(outFile, JSON.stringify(dict));
console.log(`Written ${dict.length} entries to ${outFile} (skipped ${skipped})`);
console.log(`File size: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB`);
