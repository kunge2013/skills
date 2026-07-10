import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPort, getEnvVar } from './config/environment';
import type { ViteDevServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend imports (relative to src/server/)
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
import { registerImageRoutes } from './routes/images';
import { registerImageModelRoutes } from './routes/image-models';
import { registerDataRoutes } from './routes/data';
import { registerContextRoutes } from './routes/contexts';
import { registerTemplateTestHistoryRoutes } from './routes/template-test-history';
import { registerAgentRoutes } from './routes/agent';
import { AgentService } from './services/agent/service';
import { SkillRegistry } from './services/agent/registry';
import { FileStorageProvider } from './storage/file-provider';
import { ModelManager } from './services/model/manager';
import { TemplateManager, createDefaultTemplates } from './services/template/manager';
import { HistoryManager } from './services/history/manager';
import { FavoriteManager } from './services/favorite/manager';
import { PreferenceService } from './services/preference/service';
import { ImageService, ImageModelManager } from './services/image/service';
import { DataManager } from './services/data/manager';
import { ContextManager } from './services/context/manager';
import { TemplateTestHistoryManager } from './services/template-test/manager';
import { TextAdapterRegistry } from './services/llm/adapters/registry';
import { LLMService } from './services/llm/service';
import { PromptService } from './services/prompt/service';
import { createOpenAIAdapter } from './services/llm/adapters/openai-adapter';
import { createAnthropicAdapter } from './services/llm/adapters/anthropic-adapter';
import { createGeminiAdapter } from './services/llm/adapters/gemini-adapter';
import { createDeepSeekAdapter } from './services/llm/adapters/deepseek-adapter';

export async function createApp(): Promise<{ app: express.Express; viteServer?: ViteDevServer }> {
  const app = express();
  let viteServer: ViteDevServer | undefined;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(setupCors());
  app.use(createRateLimiter());

  // Initialize storage
  const dataDir = getEnvVar('DATA_DIR') || path.join(process.cwd(), 'data');
  const storage = new FileStorageProvider(dataDir);

  // Initialize services
  const modelManager = new ModelManager(storage);
  const templateManager = new TemplateManager(storage, createDefaultTemplates());
  const historyManager = new HistoryManager(storage);
  const favoriteManager = new FavoriteManager(storage);
  const preferenceService = new PreferenceService(storage);
  const imageService = new ImageService(storage);
  const imageModelManager = new ImageModelManager(storage);
  const dataManager = new DataManager(storage);
  const contextManager = new ContextManager(storage);
  const templateTestHistoryManager = new TemplateTestHistoryManager(storage);

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
  const agentService = new AgentService(modelManager, registry);

  // Skill Registry
  const skillRegistry = new SkillRegistry();
  await skillRegistry.discover(path.join(__dirname, '..', '..', 'skills'));

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
  registerImageRoutes(router, imageService);
  registerImageModelRoutes(router, imageModelManager);
  registerDataRoutes(router, dataManager);
  registerContextRoutes(router, contextManager);
  registerTemplateTestHistoryRoutes(router, templateTestHistoryManager);
  registerAgentRoutes(router, agentService, skillRegistry);

  app.use('/api/v1', authMiddleware, router);

  // Serve frontend
  const projectRoot = path.join(__dirname, '..', '..');
  if (getEnvVar('NODE_ENV') === 'production') {
    const frontendDist = path.join(projectRoot, 'dist');
    if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
      app.use(express.static(frontendDist));
      app.get('/{*path}', (_req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
      });
    }
  } else {
    const { createServer } = await import('vite');
    // Vite root is 2 levels up from src/server/ → project root
    const projectRoot = path.join(__dirname, '..', '..');
    viteServer = await createServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteServer.middlewares);
    // Explicit index.html route
    app.get('/', async (_req, res) => {
      try {
        const indexPath = path.join(projectRoot, 'index.html');
        const indexHtml = await viteServer!.transformIndexHtml('/', fs.readFileSync(indexPath, 'utf-8'));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(indexHtml);
      } catch (err: any) {
        console.error('Error serving index.html:', err.message);
        res.status(500).end(err.message);
      }
    });
    // SPA fallback: return index.html for non-API, non-asset routes
    app.get('/{*path}', async (req, res) => {
      try {
        const indexPath = path.join(projectRoot, 'index.html');
        const indexHtml = await viteServer!.transformIndexHtml(req.url, fs.readFileSync(indexPath, 'utf-8'));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(indexHtml);
      } catch {
        res.status(404).end('Not found');
      }
    });
  }

  app.use(errorHandler);
  return { app, viteServer };
}
