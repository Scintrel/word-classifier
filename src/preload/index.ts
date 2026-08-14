import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload script - exposes a safe API to the renderer process.
 *
 * contextBridge.exposeInMainWorld makes these functions available
 * in the React app via `window.api`.
 *
 * This is the ONLY way the UI can talk to the backend (main process).
 * All communication goes through typed IPC channels defined here.
 */

export interface FilePreview {
  headers: string[]
  previewRows: Record<string, string>[]
  totalRows: number
  encoding?: string
  format: string
}

export interface ColumnMapping {
  word: string
  phoneticUk?: string
  phoneticUs?: string
  definitionCn?: string
  definitionEn?: string
  partOfSpeech?: string
  exampleSentenceEn?: string
  exampleSentenceCn?: string
  difficulty?: string
}

export interface ImportResult {
  imported: number
  skipped: number
  warnings: number
  messages: string[]
  importId: number
}

export interface ElectronAPI {
  // File dialog
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>

  // App info
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>

  // Import
  parseFile: (filePath: string) => Promise<FilePreview>
  runImport: (filePath: string, mapping: ColumnMapping) => Promise<ImportResult>
  getImportHistory: () => Promise<unknown[]>

  // Word stats
  getWordStats: () => Promise<{
    totalWords: number
    totalCategories: number
    totalExamples: number
    lastImport: { file_name: string; imported_at: string } | null
  }>

  // Words
  listWords: (options?: {
    page?: number
    pageSize?: number
    search?: string
    categoryId?: number
    difficulty?: string
    frequency?: string
    partOfSpeech?: string
    sort?: 'default' | 'az' | 'za'
  }) => Promise<{
    words: unknown[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>

  getWord: (wordId: number) => Promise<unknown>
  updateWord: (wordId: number, updates: Record<string, unknown>) => Promise<boolean>
  deleteWord: (wordId: number) => Promise<boolean>
  addExample: (wordId: number, sentenceEn: string, sentenceCn?: string) => Promise<boolean>
  deleteExample: (exampleId: number) => Promise<boolean>
  setWordCategories: (wordId: number, categoryIds: number[]) => Promise<boolean>

  // Validation
  checkValidation: () => Promise<unknown>
  autoFixCount: () => Promise<number>
  autoFixBatch: (batchSize?: number) => Promise<{ fixed: number; details: string[]; done: boolean }>
  normalizePhoneticsCount: () => Promise<number>
  normalizePhoneticsBatch: (batchSize?: number) => Promise<{ fixed: number; details: string[]; done: boolean }>
  refillLevelsCount: () => Promise<number>
  refillLevelsBatch: (batchSize?: number) => Promise<{ fixed: number; details: string[]; done: boolean }>

  // Classification
  runClassification: () => Promise<{ classified: number; total: number; details: unknown[] }>
  getClassificationStats: () => Promise<unknown>

  // Export
  exportWords: (options?: { categoryId?: number; difficulty?: string; frequency?: string }) => Promise<unknown[]>

  // Categories
  getCategories: () => Promise<unknown[]>

  // AI
  testAIConnection: () => Promise<{ ok: boolean; message: string }>
  saveAIConfig: (config: Record<string, string>) => Promise<boolean>
  getAIConfig: () => Promise<Record<string, string>>
  aiCompleteWord: (word: string) => Promise<unknown>
  aiCompleteWordsBatch: (words: string[]) => Promise<unknown[]>
  aiAutoFillCount: () => Promise<number>
  aiAutoFillAll: (batchSize?: number) => Promise<{ filled: number; words: string[]; done: boolean }>
  aiClassifyWord: (word: string, definition: string) => Promise<unknown>

  // Data management
  clearWords: () => Promise<boolean>
  resetCategories: () => Promise<boolean>

  // Developer mode
  devGetOverview: () => Promise<{
    version: string
    platform: string
    dbPath: string
    dbSize: number
    words: number
    categories: number
    examples: number
    imports: number
    dictEntries: number
    logEntries: number
    ecdictEntries: number
  }>
  devLookupWord: (word: string) => Promise<{
    word: string
    userEntry: unknown | null
    dictEntry: unknown | null
    classification: unknown[]
    found: boolean
  }>
  devGetUnfixableWords: () => Promise<string[]>
  devListDictEntries: () => Promise<unknown[]>
  devSaveDictEntry: (entry: { word: string; phonetic?: string; definition?: string; pos?: string }) => Promise<{ ok: boolean; message?: string }>
  devDeleteDictEntry: (word: string) => Promise<{ ok: boolean; message?: string }>
  devListChangeLog: (page?: number, pageSize?: number) => Promise<{
    rows: unknown[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
  devUndoChange: (logId: number) => Promise<{ ok: boolean; message?: string }>
  devLogUserAction: (payload: { page?: string; action: string; detail?: string }) => Promise<boolean>
  devListUserActions: (page?: number, pageSize?: number) => Promise<{
    rows: unknown[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>

  // Settings
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<boolean>
  getAllSettings: () => Promise<Record<string, string>>
}

const api: ElectronAPI = {
  openFileDialog: (options?) => ipcRenderer.invoke('dialog:openFile', options),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // Import
  parseFile: (filePath) => ipcRenderer.invoke('import:parseFile', filePath),
  runImport: (filePath, mapping) => ipcRenderer.invoke('import:runImport', filePath, mapping),
  getImportHistory: () => ipcRenderer.invoke('import:getHistory'),

  // Words
  getWordStats: () => ipcRenderer.invoke('words:getStats'),
  listWords: (options?) => ipcRenderer.invoke('words:list', options),
  getWord: (wordId) => ipcRenderer.invoke('words:getOne', wordId),
  updateWord: (wordId, updates) => ipcRenderer.invoke('words:update', wordId, updates),
  deleteWord: (wordId) => ipcRenderer.invoke('words:delete', wordId),
  addExample: (wordId, sentenceEn, sentenceCn?) => ipcRenderer.invoke('words:addExample', wordId, sentenceEn, sentenceCn),
  deleteExample: (exampleId) => ipcRenderer.invoke('words:deleteExample', exampleId),
  setWordCategories: (wordId, categoryIds) => ipcRenderer.invoke('words:setCategories', wordId, categoryIds),

  // Validation
  checkValidation: () => ipcRenderer.invoke('validation:check'),
  autoFixCount: () => ipcRenderer.invoke('validation:autoFixCount'),
  autoFixBatch: (batchSize?) => ipcRenderer.invoke('validation:autoFixBatch', batchSize),
  normalizePhoneticsCount: () => ipcRenderer.invoke('validation:normalizePhoneticsCount'),
  normalizePhoneticsBatch: (batchSize?) => ipcRenderer.invoke('validation:normalizePhoneticsBatch', batchSize),
  refillLevelsCount: () => ipcRenderer.invoke('validation:refillLevelsCount'),
  refillLevelsBatch: (batchSize?) => ipcRenderer.invoke('validation:refillLevelsBatch', batchSize),

  // Classification
  runClassification: () => ipcRenderer.invoke('classification:run'),
  getClassificationStats: () => ipcRenderer.invoke('classification:stats'),

  // Export
  exportWords: (options?) => ipcRenderer.invoke('export:words', options),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),

  // AI
  testAIConnection: () => ipcRenderer.invoke('ai:testConnection'),
  saveAIConfig: (config) => ipcRenderer.invoke('ai:saveConfig', config),
  getAIConfig: () => ipcRenderer.invoke('ai:getConfig'),
  aiCompleteWord: (word) => ipcRenderer.invoke('ai:completeWord', word),
  aiCompleteWordsBatch: (words) => ipcRenderer.invoke('ai:completeWordsBatch', words),
  aiAutoFillCount: () => ipcRenderer.invoke('ai:autoFillCount'),
  aiAutoFillAll: (batchSize?) => ipcRenderer.invoke('ai:autoFillAll', batchSize),
  aiClassifyWord: (word, def) => ipcRenderer.invoke('ai:classifyWord', word, def),

  // Data management
  clearWords: () => ipcRenderer.invoke('data:clearWords'),
  resetCategories: () => ipcRenderer.invoke('data:resetCategories'),

  // Developer mode
  devGetOverview: () => ipcRenderer.invoke('dev:getOverview'),
  devLookupWord: (word) => ipcRenderer.invoke('dev:lookupWord', word),
  devGetUnfixableWords: () => ipcRenderer.invoke('dev:getUnfixableWords'),
  devListDictEntries: () => ipcRenderer.invoke('dev:listDictEntries'),
  devSaveDictEntry: (entry) => ipcRenderer.invoke('dev:saveDictEntry', entry),
  devDeleteDictEntry: (word) => ipcRenderer.invoke('dev:deleteDictEntry', word),
  devListChangeLog: (page?, pageSize?) => ipcRenderer.invoke('dev:listChangeLog', page, pageSize),
  devUndoChange: (logId) => ipcRenderer.invoke('dev:undoChange', logId),
  devLogUserAction: (payload) => ipcRenderer.invoke('dev:logUserAction', payload),
  devListUserActions: (page?, pageSize?) => ipcRenderer.invoke('dev:listUserActions', page, pageSize),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll')
}

contextBridge.exposeInMainWorld('api', api)
