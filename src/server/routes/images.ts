// [AGC:FILE] tool=Cc author=fangkun date=2026-09-15
import { Router } from 'express';
import { ImageService, GeneratedImage, ImageModelManager, ImageModelConfig, saveImageToDisk, isImageData } from '../services/image/service';
import { LLMCallLogger } from '../services/llm-call/logger';
import { v4 as uuidv4 } from 'uuid';

// [AGC:START] tool=Cc author=fangkun
interface NanoBananaResponse {
  images?: Array<string | { url?: string; b64?: string; base64?: string; data?: string }>;
  data?: Array<{ url?: string; b64?: string; base64?: string; data?: string }>;
  results?: Array<{ url?: string; b64?: string; base64?: string; data?: string }>;
  url?: string;
  b64?: string;
  base64?: string;
  [key: string]: unknown;
}

function extractImageData(resp: NanoBananaResponse): string[] {
  const items: string[] = [];
  const candidates = resp.images || resp.data || resp.results || [];
  for (const item of candidates) {
    if (typeof item === 'string') { items.push(item); continue; }
    if (item.url) items.push(item.url);
    else if (item.b64) items.push(`data:image/png;base64,${item.b64}`);
    else if (item.base64) items.push(`data:image/png;base64,${item.base64}`);
    else if (item.data) items.push(item.data);
  }
  if (items.length === 0) {
    if (resp.url) items.push(resp.url);
    else if (resp.b64) items.push(`data:image/png;base64,${resp.b64}`);
    else if (resp.base64) items.push(`data:image/png;base64,${resp.base64}`);
  }
  return items;
}

async function callNanoBananaImage(
  modelConfig: ImageModelConfig,
  prompt: string,
  images: string[],
  options: { aspectRatio?: string; imageSize?: string; replyType?: string },
): Promise<NanoBananaResponse> {
  const baseURL = modelConfig.connectionConfig?.baseURL;
  const apiKey = modelConfig.connectionConfig?.apiKey;
  if (!baseURL) throw new Error('Nano Banana: baseURL is required');
  if (!apiKey) throw new Error('Nano Banana: apiKey is required');

  const body = {
    model: modelConfig.modelId || 'nano-banana-2',
    prompt,
    images,
    aspectRatio: options.aspectRatio || '1:1',
    imageSize: options.imageSize || '1K',
    replyType: options.replyType || 'json',
  };

  const response = await fetch(baseURL.replace(/\/+$/, ''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Nano Banana API error ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as NanoBananaResponse;
}

async function processAndSaveImages(
  resp: NanoBananaResponse,
  imageService: ImageService,
  prompt: string,
  modelKey: string,
  width?: number,
  height?: number,
): Promise<GeneratedImage[]> {
  const rawItems = extractImageData(resp);
  const results: GeneratedImage[] = [];

  for (const item of rawItems) {
    let localUrl: string;
    if (isImageData(item)) {
      localUrl = await saveImageToDisk(imageService.dataDir, item, prompt);
    } else if (item.startsWith('http://') || item.startsWith('https://')) {
      localUrl = await saveImageToDisk(imageService.dataDir, item, prompt);
    } else {
      localUrl = item;
    }

    const image: GeneratedImage = {
      id: uuidv4(),
      url: localUrl,
      prompt,
      modelKey,
      width: width || 1024,
      height: height || 1024,
      createdAt: Date.now(),
    };
    await imageService.saveImage(image);
    results.push(image);
  }

  return results;
}
// [AGC:END]

export function registerImageRoutes(
  router: Router,
  imageService: ImageService,
  imageModelManager?: ImageModelManager,
  llmCallLogger?: LLMCallLogger,
) {
  // [AGC:START] tool=Cc author=fangkun
  // GET /images - list all saved images with pagination
  router.get('/images', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const allImages = await imageService.getGeneratedImages();
      const total = allImages.length;
      const start = (page - 1) * pageSize;
      const items = allImages.slice(start, start + pageSize);
      res.json({ success: true, data: { items, total } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: { message } });
    }
  });

  // DELETE /images/:id - delete a saved image
  router.delete('/images/:id', async (req, res) => {
    try {
      await imageService.deleteImage(req.params.id);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ success: false, error: { message } });
    }
  });
  // [AGC:END]

  // POST /images/generate/text2image
  router.post('/images/generate/text2image', async (req, res) => {
    try {
      const { prompt, modelKey, width, height, aspectRatio, imageSize, replyType, images: inputImages } = req.body;
      if (!prompt) {
        res.status(400).json({ success: false, error: { message: 'prompt is required' } });
        return;
      }

      const startedAt = Date.now();
      let generated: GeneratedImage[] = [];

      if (modelKey && imageModelManager) {
        const allModels = await imageModelManager.getAllModels();
        const modelConfig = allModels.find(m => m.id === modelKey);
        if (modelConfig) {
          const resp = await callNanoBananaImage(
            modelConfig, prompt, inputImages || [],
            { aspectRatio, imageSize, replyType },
          );
          generated = await processAndSaveImages(resp, imageService, prompt, modelKey, width, height);

          // Log the call
          llmCallLogger?.start({
            source: 'image', modelKey, protocol: 'nano-banana',
            modelParams: { aspectRatio, imageSize, replyType },
            request: { prompt, images: inputImages || [] },
          }).complete({
            response: { imageCount: generated.length, images: generated.map(g => g.url) },
            status: 200,
          });
        }
      }

      if (generated.length === 0) {
        generated = [{
          id: uuidv4(),
          url: '/placeholder-image.png',
          prompt,
          modelKey: modelKey || 'placeholder',
          width: width || 1024,
          height: height || 1024,
          createdAt: Date.now(),
        }];
        await imageService.saveImage(generated[0]);
      }

      res.json({ success: true, data: generated.length === 1 ? generated[0] : generated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      llmCallLogger?.start({
        source: 'image', modelKey: req.body.modelKey || '', protocol: 'nano-banana',
        modelParams: {}, request: req.body || {},
      }).complete({ status: 500, error: message });
      res.status(400).json({ success: false, error: { message } });
    }
  });

  // POST /images/generate/image2image
  router.post('/images/generate/image2image', async (req, res) => {
    try {
      const { prompt, modelKey, images: inputImages, aspectRatio, imageSize, replyType, width, height } = req.body;
      if (!prompt) {
        res.status(400).json({ success: false, error: { message: 'prompt is required' } });
        return;
      }

      let generated: GeneratedImage[] = [];
      if (modelKey && imageModelManager) {
        const allModels = await imageModelManager.getAllModels();
        const modelConfig = allModels.find(m => m.id === modelKey);
        if (modelConfig) {
          const resp = await callNanoBananaImage(
            modelConfig, prompt, inputImages || [],
            { aspectRatio, imageSize, replyType },
          );
          generated = await processAndSaveImages(resp, imageService, prompt, modelKey, width, height);

          llmCallLogger?.start({
            source: 'image', modelKey, protocol: 'nano-banana',
            modelParams: { aspectRatio, imageSize, replyType },
            request: { prompt, images: inputImages || [] },
          }).complete({
            response: { imageCount: generated.length, images: generated.map(g => g.url) },
            status: 200,
          });
        }
      }

      if (generated.length === 0) {
        generated = [{
          id: uuidv4(), url: '/placeholder-image.png', prompt,
          modelKey: modelKey || 'placeholder', width: width || 1024, height: height || 1024,
          createdAt: Date.now(),
        }];
        await imageService.saveImage(generated[0]);
      }

      res.json({ success: true, data: generated.length === 1 ? generated[0] : generated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ success: false, error: { message } });
    }
  });

  // POST /images/test-connection
  router.post('/images/test-connection', async (req, res) => {
    try {
      const { modelKey } = req.body;
      if (!modelKey || !imageModelManager) {
        res.json({ success: true });
        return;
      }
      const allModels = await imageModelManager.getAllModels();
      const modelConfig = allModels.find(m => m.id === modelKey);
      if (!modelConfig) {
        res.status(404).json({ success: false, error: { message: `Image model "${modelKey}" not found` } });
        return;
      }
      await callNanoBananaImage(modelConfig, 'test', [], { replyType: 'json' });
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ success: false, error: { message } });
    }
  });
}
