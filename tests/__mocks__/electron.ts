/**
 * Mock electron module for unit tests running in plain Node.js.
 * Provides just enough of the Electron API for the code under test to function.
 */
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

const testUserData = join(__dirname, '..', '.test-tmp')

// Ensure test temp directory exists
if (!existsSync(testUserData)) {
  mkdirSync(testUserData, { recursive: true })
}

export const app = {
  getPath: (_name: string) => testUserData,
  whenReady: () => Promise.resolve(),
  on: () => {},
  getName: () => 'TestApp',
  getVersion: () => '1.0.0',
  quit: () => {}
}

export const BrowserWindow = class {
  constructor() {}
  on() { return this }
  loadURL() { return this }
  loadFile() { return this }
  show() { return this }
  webContents = { setWindowOpenHandler: () => {} }
  static getAllWindows() { return [] }
}

export const shell = {
  openExternal: () => {}
}

export const ipcMain = {
  handle: () => {},
  on: () => {}
}

export const dialog = {
  showOpenDialog: async () => ({ canceled: false, filePaths: ['/test/file.csv'] })
}
