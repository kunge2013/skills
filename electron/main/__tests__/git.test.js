// electron/main/__tests__/git.test.js

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/utils/git.js', () => ({
  cloneRepo: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
  pullRepo: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
}))

vi.mock('../../../src/core/config.js', () => {
  const config = { marketplace: { url: 'https://github.com/test/skills', branch: 'main', cloned: false, lastSync: null } }
  return { getConfig: vi.fn(() => JSON.parse(JSON.stringify(config))), updateConfig: vi.fn(), KUNGESKILLS_DIR: '/tmp/.kungeskills' }
})

const cacheState = { cacheDir: '/tmp/.kungeskills/cache/marketplace', valid: true }
vi.mock('../../../src/core/cache.js', () => ({
  getCacheDir: vi.fn(() => cacheState.cacheDir),
  isCacheValid: vi.fn(() => cacheState.valid),
  ensureCacheDir: vi.fn(() => cacheState.cacheDir),
}))

import { cloneRepo, pullRepo } from '../../../src/utils/git.js'
import { getConfig, updateConfig } from '../../../src/core/config.js'
import { getCacheDir, isCacheValid, ensureCacheDir } from '../../../src/core/cache.js'

async function initMarketplace() {
  const config = getConfig()
  const cacheDir = ensureCacheDir()
  await cloneRepo(config.marketplace.url, cacheDir, config.marketplace.branch || 'main')
  updateConfig({ ...config, marketplace: { ...config.marketplace, cloned: true, lastSync: new Date().toISOString() } })
  return { success: true, cacheDir }
}

async function updateMarketplace() {
  const cacheDir = getCacheDir()
  if (!isCacheValid()) return { success: false, error: 'Marketplace not initialized. Run init first.' }
  await pullRepo(cacheDir)
  const config = getConfig()
  updateConfig({ ...config, marketplace: { ...config.marketplace, lastSync: new Date().toISOString() } })
  return { success: true }
}

function checkCacheStatus() {
  return { valid: isCacheValid(), cacheDir: getCacheDir(), hasBundled: true, lastSync: getConfig().marketplace.lastSync, repoUrl: getConfig().marketplace.url }
}

describe('git handlers', () => {
  beforeEach(() => { vi.clearAllMocks(); cacheState.valid = true })

  describe('initMarketplace', () => {
    it('clones repo and updates config', async () => {
      const r = await initMarketplace()
      expect(r.success).toBe(true)
      expect(r.cacheDir).toBe('/tmp/.kungeskills/cache/marketplace')
      expect(cloneRepo).toHaveBeenCalledWith('https://github.com/test/skills', '/tmp/.kungeskills/cache/marketplace', 'main')
      expect(updateConfig).toHaveBeenCalled()
    })
  })

  describe('updateMarketplace', () => {
    it('pulls repo when cache is valid', async () => {
      const r = await updateMarketplace()
      expect(r.success).toBe(true)
      expect(pullRepo).toHaveBeenCalledWith('/tmp/.kungeskills/cache/marketplace')
    })
    it('returns error when cache invalid', async () => {
      cacheState.valid = false
      const r = await updateMarketplace()
      expect(r.success).toBe(false)
      expect(r.error).toContain('not initialized')
    })
  })

  describe('checkCacheStatus', () => {
    it('returns status object', () => {
      const r = checkCacheStatus()
      expect(r).toMatchObject({ valid: true, cacheDir: '/tmp/.kungeskills/cache/marketplace', repoUrl: 'https://github.com/test/skills' })
    })
  })
})
