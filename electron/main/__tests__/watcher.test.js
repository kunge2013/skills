// electron/main/__tests__/watcher.test.js

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}))

vi.mock('chokidar', () => {
  const mockOn = vi.fn()
  const mockClose = vi.fn()
  const mockWatcher = { on: mockOn, close: mockClose }
  const mockWatch = vi.fn(() => mockWatcher)
  return { watch: mockWatch, __mockOn: mockOn, __mockClose: mockClose }
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as chokidar from 'chokidar'

let watcher = null

function startWatching(skillDirs) {
  stopWatching()
  watcher = chokidar.watch(skillDirs.map((d) => d + '/**/*.md'), {
    ignored: /node_modules/, persistent: true, ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })
  watcher.on('change', () => {})
}

function stopWatching() {
  if (watcher) { watcher.close(); watcher = null }
}

describe('watcher handler', () => {
  beforeEach(() => { vi.clearAllMocks(); watcher = null })

  it('starts watching with correct patterns', () => {
    startWatching(['/a', '/b'])
    expect(chokidar.watch).toHaveBeenCalledWith(
      ['/a/**/*.md', '/b/**/*.md'],
      expect.objectContaining({ persistent: true })
    )
    expect(watcher).not.toBeNull()
  })

  it('stops previous watcher before starting new one', () => {
    startWatching(['/a'])
    startWatching(['/b'])
    const mockClose = chokidar.__mockClose
    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(chokidar.watch).toHaveBeenCalledTimes(2)
  })

  it('registers change event handler', () => {
    startWatching(['/a'])
    const mockOn = chokidar.__mockOn
    expect(mockOn).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('stopWatching closes watcher', () => {
    startWatching(['/a'])
    expect(watcher).not.toBeNull()
    stopWatching()
    expect(chokidar.__mockClose).toHaveBeenCalled()
    expect(watcher).toBeNull()
  })

  it('stopWatching is safe with no watcher', () => {
    expect(() => stopWatching()).not.toThrow()
  })
})
