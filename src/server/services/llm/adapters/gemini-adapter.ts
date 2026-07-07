import { GoogleGenAI } from '@google/genai';
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

export function createGeminiAdapter(): ITextProviderAdapter {
  const provider: TextProvider = {
    id: 'gemini',
    name: 'Google Gemini',
    requiresApiKey: true,
    defaultBaseURL: '',
    supportsDynamicModels: false,
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
  };

  const models: TextModel[] = [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      providerId: 'gemini',
      capabilities: { supportsTools: true, supportsReasoning: true, maxContextLength: 1000000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      providerId: 'gemini',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 1000000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      providerId: 'gemini',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 1000000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      providerId: 'gemini',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 1000000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
  ];

  function getClient(config: TextModelConfig): GoogleGenAI {
    return new GoogleGenAI({ apiKey: config.connectionConfig.apiKey });
  }

  function buildParams(config: TextModelConfig): Record<string, any> {
    const params: Record<string, any> = {};
    const overrides = config.paramOverrides || {};
    if (overrides.temperature !== undefined) params.temperature = overrides.temperature;
    if (overrides.maxTokens !== undefined) params.maxOutputTokens = overrides.maxTokens;
    if (overrides.topP !== undefined) params.topP = overrides.topP;
    if (overrides.topK !== undefined) params.topK = overrides.topK;
    return params;
  }

  function messagesToGeminiContents(messages: Message[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  const adapter: ITextProviderAdapter = {
    getProvider() { return provider; },
    getModels() { return models; },

    async sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);
      const modelId = config.modelId || 'gemini-2.5-pro';

      const geminiMessages = messagesToGeminiContents(messages);

      const response = await client.models.generateContent({
        model: modelId,
        contents: geminiMessages as any,
        config: params as any,
      });

      return {
        content: response.text || '',
        metadata: { model: modelId },
      };
    },

    async sendMessageStream(messages: Message[], config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const modelId = config.modelId || 'gemini-2.5-pro';
        const geminiMessages = messagesToGeminiContents(messages);

        const stream = await client.models.generateContentStream({
          model: modelId,
          contents: geminiMessages as any,
          config: params as any,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const text = chunk.text || '';
          fullContent += text;
          callbacks.onToken(text);
        }
        callbacks.onComplete({ content: fullContent, metadata: { model: modelId } });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendMessageStreamWithTools(messages: Message[], config: TextModelConfig, tools: ToolDefinition[], callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const modelId = config.modelId || 'gemini-2.5-pro';
        const geminiMessages = messagesToGeminiContents(messages);

        const stream = await client.models.generateContentStream({
          model: modelId,
          contents: geminiMessages as any,
          config: {
            ...params,
            tools: tools.map((t: ToolDefinition) => ({
              functionDeclarations: [{
                name: t.function.name,
                description: t.function.description || '',
                parameters: t.function.parameters as any,
              }],
            })),
          } as any,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const text = chunk.text || '';
          fullContent += text;
          callbacks.onToken(text);
        }
        callbacks.onComplete({ content: fullContent, metadata: { model: modelId } });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendImageUnderstanding(request: ImageUnderstandingRequest, config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);
      const modelId = config.modelId || 'gemini-2.5-pro';

      const parts: any[] = [{ text: request.userPrompt }];
      for (const img of request.images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.b64,
          },
        });
      }

      const response = await client.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts }],
        config: params as any,
      });

      return {
        content: response.text || '',
        metadata: { model: modelId },
      };
    },

    async sendImageUnderstandingStream(request: ImageUnderstandingRequest, config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const modelId = config.modelId || 'gemini-2.5-pro';

        const parts: any[] = [{ text: request.userPrompt }];
        for (const img of request.images) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: img.b64,
            },
          });
        }

        const stream = await client.models.generateContentStream({
          model: modelId,
          contents: [{ role: 'user', parts }],
          config: params as any,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const text = chunk.text || '';
          fullContent += text;
          callbacks.onToken(text);
        }
        callbacks.onComplete({ content: fullContent, metadata: { model: modelId } });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    buildDefaultModel(modelId: string): TextModel {
      return {
        id: modelId,
        name: modelId,
        providerId: 'gemini',
        capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 1000000 },
        parameterDefinitions: getParameterDefinitions(),
        defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
      };
    },
  };
  return adapter;
}

function getParameterDefinitions(): ParameterDefinition[] {
  return [
    {
      key: 'temperature',
      name: 'Temperature',
      description: 'Controls randomness.',
      type: 'number',
      default: 0.7,
      min: 0,
      max: 2,
    },
    {
      key: 'maxTokens',
      name: 'Max Output Tokens',
      description: 'Maximum number of tokens to generate.',
      type: 'number',
      default: 8192,
      min: 1,
    },
    {
      key: 'topP',
      name: 'Top P',
      description: 'Nucleus sampling threshold.',
      type: 'number',
      default: 0.95,
      min: 0,
      max: 1,
    },
    {
      key: 'topK',
      name: 'Top K',
      description: 'Top-K sampling.',
      type: 'number',
      default: 40,
      min: 1,
    },
  ];
}
