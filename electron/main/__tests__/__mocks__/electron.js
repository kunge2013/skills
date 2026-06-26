// electron/main/__tests__/__mocks__/electron.js
// Mock Electron module for vitest tests

const handlers = new Map()

module.exports = {
  ipcMain: {
    handle: vi.fn((channel, fn) => handlers.set(channel, fn)),
    _handlers: handlers,
    _getHandler: (channel) => handlers.get(channel),
  },
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}
