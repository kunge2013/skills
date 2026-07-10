// [AGC:START] tool=Cc author=fangkun
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend imports
import { setupCors } from './middleware/cors';
import { createRateLimiter } from './middleware/rate-limit';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { registerHealthRoute } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerLLMRoutes } from './routes/llm';
import { registerModelRoutes } from './routes/models';
import { registerPromptRoutes } from './routes/prompts';
import { registerTemplateRoutes } from './routes/templates';
import { registerHistoryRoutes } from './routes/history';
import { registerFavoriteRoutes } from './routes/favorites';
import { registerPreferenceRoutes } from './routes/preferences';
import { registerDataRoutes } from './routes/data';
import { registerContextRoutes } from './routes/contexts';
import { registerTemplateTestHistoryRoutes } from './routes/template-test-history';
import { registerImageRoutes } from './routes/images';
import { registerImageModelRoutes } from './routes/image-models';
import { registerAgentRoutes } from './routes/agent';
import { SkillRegistry } from './services/agent/registry';
import { AgentService } from './services/agent/service';
import { FileStorageProvider } from './storage/file-provider';
import { ModelManager } from './services/model/manager';
import { TemplateManager, createDefaultTemplates } from './services/template/manager';
import { HistoryManager } from './services/history/manager';
import { FavoriteManager } from './services/favorite/manager';
import { PreferenceService } from './services/preference/service';
import { DataManager } from './services/data/manager';
import { ContextManager } from './services/context/manager';
import { TemplateTestHistoryManager } from './services/template-test/manager';
import { ImageService, ImageModelManager } from './services/image/service';
import { TextAdapterRegistry } from './services/llm/adapters/registry';
import { LLMService } from './services/llm/service';
import { PromptService } from './services/prompt/service';
import { createOpenAIAdapter } from './services/llm/adapters/openai-adapter';
import { createAnthropicAdapter } from './services/llm/adapters/anthropic-adapter';
import { createGeminiAdapter } from './services/llm/adapters/gemini-adapter';
import { createDeepSeekAdapter } from './services/llm/adapters/deepseek-adapter';

function getPort(): number {
  return parseInt(process.env.PORT || '3000', 10);
}

function getEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

export async function createApp(): Promise<express.Express> {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(setupCors());
  app.use(createRateLimiter());

  // Initialize storage
  const dataDir = getEnvVar('DATA_DIR') || path.join(process.cwd(), 'data');
  const storage = new FileStorageProvider(dataDir);
  const projectRoot = path.join(__dirname, '..', '..');

  // Initialize services
  const modelManager = new ModelManager(storage);
  const templateManager = new TemplateManager(storage, createDefaultTemplates());
  const historyManager = new HistoryManager(storage);
  const favoriteManager = new FavoriteManager(storage);
  const preferenceService = new PreferenceService(storage);
  const dataManager = new DataManager(storage);
  const contextManager = new ContextManager(storage);
  const templateTestHistoryManager = new TemplateTestHistoryManager(storage);
  const imageService = new ImageService(storage);
  const imageModelManager = new ImageModelManager(storage);

  // LLM adapters
  const registry = new TextAdapterRegistry();
  registry.register(createOpenAIAdapter());
  registry.register(createAnthropicAdapter());
  registry.register(createGeminiAdapter());
  registry.register(createDeepSeekAdapter());

  // LLM Service
  const llmService = new LLMService(registry, modelManager);

  // Prompt Service
  const promptService = new PromptService(llmService, templateManager, historyManager, templateTestHistoryManager);

  // Agent Service
  const skillRegistry = new SkillRegistry();
  await skillRegistry.discover(path.join(projectRoot, '.claude', 'skills'));
  const agentService = new AgentService(modelManager, registry, skillRegistry);

  // Register routes
  const router = express.Router();
  registerHealthRoute(router);
  registerAuthRoutes(router);
  registerLLMRoutes(router, llmService, modelManager, registry);
  registerModelRoutes(router, modelManager);
  registerPromptRoutes(router, promptService);
  registerTemplateRoutes(router, templateManager);
  registerHistoryRoutes(router, historyManager);
  registerFavoriteRoutes(router, favoriteManager);
  registerPreferenceRoutes(router, preferenceService);
  registerDataRoutes(router, dataManager);
  registerContextRoutes(router, contextManager);
  registerTemplateTestHistoryRoutes(router, templateTestHistoryManager);
  registerImageRoutes(router, imageService);
  registerImageModelRoutes(router, imageModelManager);
  registerAgentRoutes(router, agentService, skillRegistry);

  app.use('/api/v1', authMiddleware, router);

  // Root-level health check (for proxy from web.js)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Serve frontend static files (production mode only)
  const webDist = path.join(projectRoot, 'web', 'dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

async function main() {
  const app = await createApp();
  const port = getPort();

  app.listen(port, () => {
    console.log(`Prompt Optimizer running on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API base: http://localhost:${port}/api/v1`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
// [AGC:END]
