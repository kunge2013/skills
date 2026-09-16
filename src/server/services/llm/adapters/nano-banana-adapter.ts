// [AGC:FILE] tool=Cc author=fangkun date=2026-09-15
import {
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  StreamHandlers,
  LLMResponse,
  ToolDefinition,
  ImageUnderstandingRequest,
  ParameterDefinition,
} from '../types';
import { saveImageToDisk, isImageData, ImageService, GeneratedImage } from '../../image/service';
import { v4 as uuidv4 } from 'uuid';

// [AGC:START] tool=Cc author=fangkun

/**
 * nano-banana API adapter.
 *
 * Request shape:
 * {
 *   "model": "nano-banana-2",
 *   "prompt": "...",
 *   "images": [],
 *   "aspectRatio": "1:1",
 *   "imageSize": "1K",
 *   "replyType": "json"
 * }
 *
 * Auth header: `Authorization: Bearer <key>`.
 */
export function createNanoBananaAdapter(dataDir: string, imageService?: ImageService): ITextProviderAdapter {
  const provider: TextProvider = {
    id: 'nano-banana',
    name: 'Nano Banana',
    requiresApiKey: true,
    defaultBaseURL: '',
    supportsDynamicModels: false,
  };

  const models: TextModel[] = [
    {
      id: 'nano-banana-2',
      name: 'Nano Banana 2',
      providerId: 'nano-banana',
      capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 0 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { aspectRatio: '1:1', imageSize: '1K', replyType: 'json' },
    },
    {
      id: 'nano-banana-pro',
      name: 'Nano Banana Pro',
      providerId: 'nano-banana',
      capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 0 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { aspectRatio: '1:1', imageSize: '1K', replyType: 'json' },
    },
  ];

  function buildHeaders(config: TextModelConfig): Record<string, string> {
    const apiKey = config.connectionConfig?.apiKey;
    if (!apiKey) throw new Error('Nano Banana adapter: apiKey is required');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  function resolveBaseURL(config: TextModelConfig): string {
    const baseURL = config.connectionConfig?.baseURL;
    if (!baseURL) throw new Error('Nano Banana adapter: baseURL is required');
    return baseURL.replace(/\/+$/, '');
  }

  async function callNanoBanana(
    config: TextModelConfig,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = resolveBaseURL(config);
    const headers = buildHeaders(config);
    const body = JSON.stringify(payload);

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Nano Banana API error ${response.status}: ${text || response.statusText}`);
    }
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }
    // Non-JSON (e.g. raw image bytes) — wrap in a JSON envelope
    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return { rawBase64: b64, contentType: ct };
  }

  function extractTextFromResponse(resp: Record<string, unknown>): string {
    // Common shapes: { text: "..." }, { data: { text: "..." } }, { output: "..." },
    // { images: [...] } or { results: [...] } (image-only), or just stringified JSON.
    if (typeof resp.text === 'string') return resp.text;
    if (typeof resp.output === 'string') return resp.output;
    if (resp.data && typeof (resp.data as any).text === 'string') return (resp.data as any).text;
    if (Array.isArray(resp.images) && resp.images.length > 0) {
      return JSON.stringify({ images: resp.images });
    }
    if (Array.isArray(resp.results) && resp.results.length > 0) {
      return JSON.stringify({ images: resp.results });
    }
    return JSON.stringify(resp);
  }

  async function saveImagesFromResponse(
    resp: Record<string, unknown>,
    dataDir: string,
    prompt: string,
    modelKey: string = 'nano-banana-2',
  ): Promise<Record<string, unknown>> {
    // Process images array (support both 'images' and 'results' fields)
    const imageArrays = [resp.images, resp.results].filter(Array.isArray);
    let result = resp;

    for (const imageArray of imageArrays) {
      const saved: string[] = [];
      for (const item of imageArray!) {
        const imgData = typeof item === 'string' ? item
          : (item as any).url || (item as any).b64 || (item as any).base64 || (item as any).data;
        if (!imgData) { saved.push(String(item)); continue; }
        const src = (typeof item === 'string' && !isImageData(item) && !imgData.startsWith('http'))
          ? `data:image/png;base64,${imgData}` : imgData;
        try {
          const localUrl = await saveImageToDisk(dataDir, src, prompt);
          saved.push(localUrl);
          // Save image metadata to ImageService
          if (imageService) {
            const image: GeneratedImage = {
              id: uuidv4(),
              url: localUrl,
              prompt,
              modelKey,
              width: 1024,
              height: 1024,
              createdAt: Date.now(),
            };
            await imageService.saveImage(image);
          }
        } catch {
          saved.push(imgData);
        }
      }
      const key = imageArray === resp.images ? 'images' : 'results';
      result = { ...result, [key]: saved };
    }

    // Process single b64/base64/url at top level
    for (const key of ['b64', 'base64', 'url']) {
      const val = result[key];
      if (typeof val === 'string' && (isImageData(val) || val.startsWith('http'))) {
        try {
          const localUrl = await saveImageToDisk(dataDir, val, prompt);
          result = { ...result, [key]: localUrl, savedImage: localUrl };
          // Save image metadata to ImageService
          if (imageService) {
            const image: GeneratedImage = {
              id: uuidv4(),
              url: localUrl,
              prompt,
              modelKey,
              width: 1024,
              height: 1024,
              createdAt: Date.now(),
            };
            await imageService.saveImage(image);
          }
        } catch {
          // keep original
        }
      }
    }

    return result;
  }

  const adapter: ITextProviderAdapter = {
    getProvider() { return provider; },
    getModels() { return models; },

    async sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const prompt = lastUser?.content || '';
      const payload = {
        model: config.modelId || config.modelMeta?.id || 'nano-banana-2',
        prompt,
        images: [],
        ...(config.paramOverrides || {}),
      };
      const resp = await callNanoBanana(config, payload);
      return {
        content: extractTextFromResponse(resp),
        metadata: { model: payload.model as string },
      };
    },

    async sendMessageStream(messages: Message[], config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const result = await adapter.sendMessage(messages, config);
        callbacks.onToken(result.content);
        callbacks.onComplete(result);
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendMessageStreamWithTools(
      messages: Message[],
      config: TextModelConfig,
      _tools: ToolDefinition[],
      callbacks: StreamHandlers,
    ): Promise<void> {
      // nano-banana doesn't support tool use — fall back to plain send
      await adapter.sendMessageStream(messages, config, callbacks);
    },

    async sendImageUnderstanding(request: ImageUnderstandingRequest, config: TextModelConfig): Promise<LLMResponse> {
      const payload = {
        model: config.modelId || config.modelMeta?.id || 'nano-banana-2',
        prompt: request.userPrompt,
        images: request.images.map(img => `data:${img.mimeType || 'image/jpeg'};base64,${img.b64}`),
        ...(config.paramOverrides || {}),
      };
      const resp = await callNanoBanana(config, payload);
      return {
        content: extractTextFromResponse(resp),
        metadata: { model: payload.model as string },
      };
    },

    async sendImageUnderstandingStream(
      request: ImageUnderstandingRequest,
      config: TextModelConfig,
      callbacks: StreamHandlers,
    ): Promise<void> {
      try {
        const result = await adapter.sendImageUnderstanding(request, config);
        callbacks.onToken(result.content);
        callbacks.onComplete(result);
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendRaw(payload: Record<string, any>, config: TextModelConfig): Promise<Record<string, any>> {
      const modelKey = payload.model || config.modelId || config.modelMeta?.id || 'nano-banana-2';
      const body = {
        model: modelKey,
        ...payload,
      };
      const resp = await callNanoBanana(config, body);
      // Save images locally and replace base64/URLs with local paths
      return saveImagesFromResponse(resp, dataDir, payload.prompt || '', modelKey);
    },

    buildDefaultModel(modelId: string): TextModel {
      return {
        id: modelId,
        name: modelId,
        providerId: 'nano-banana',
        capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 0 },
        parameterDefinitions: getParameterDefinitions(),
        defaultParameterValues: { aspectRatio: '1:1', imageSize: '1K', replyType: 'json' },
      };
    },
  };

  return adapter;
}

function getParameterDefinitions(): ParameterDefinition[] {
  return [
    {
      key: 'aspectRatio',
      name: 'Aspect Ratio',
      description: 'Image aspect ratio (e.g. 1:1, 16:9, 9:16, 4:3, 3:4).',
      type: 'string',
      default: '1:1',
      options: [
        { label: '1:1', value: '1:1' },
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '4:3', value: '4:3' },
        { label: '3:4', value: '3:4' },
      ],
    },
    {
      key: 'imageSize',
      name: 'Image Size',
      description: 'Output image size tier.',
      type: 'string',
      default: '1K',
      options: [
        { label: '1K', value: '1K' },
        { label: '2K', value: '2K' },
        { label: '4K', value: '4K' },
      ],
    },
    {
      key: 'replyType',
      name: 'Reply Type',
      description: 'Response format: "json" returns structured JSON, "url" returns direct image URLs.',
      type: 'string',
      default: 'json',
      options: [
        { label: 'JSON', value: 'json' },
        { label: 'URL', value: 'url' },
      ],
    },
  ];
}
// [AGC:END]
