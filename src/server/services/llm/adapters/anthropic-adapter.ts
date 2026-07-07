import Anthropic from '@anthropic-ai/sdk';
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

export function createAnthropicAdapter(): ITextProviderAdapter {
  const provider: TextProvider = {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.anthropic.com',
    supportsDynamicModels: false,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  };

  const models: TextModel[] = [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      providerId: 'anthropic',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 200000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      providerId: 'anthropic',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 200000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      providerId: 'anthropic',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 200000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      providerId: 'anthropic',
      capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 200000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
  ];

  function getClient(config: TextModelConfig): Anthropic {
    return new Anthropic({
      apiKey: config.connectionConfig.apiKey,
      baseURL: config.connectionConfig.baseURL
        ? `${config.connectionConfig.baseURL}/v1`
        : undefined,
    });
  }

  function anthropicRole(role: Message['role']): 'user' | 'assistant' {
    if (role === 'system') return 'user';
    if (role === 'tool') return 'user';
    return role as 'user' | 'assistant';
  }

  function messagesToAnthropic(messages: Message[]): { system?: string; messages: Array<{ role: string; content: string }> } {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    const resultMessages = nonSystem.map(m => ({
      role: anthropicRole(m.role),
      content: m.content,
    }));

    return {
      system: systemMsg?.content,
      messages: resultMessages,
    };
  }

  function buildParams(config: TextModelConfig): Record<string, any> {
    const model = config.modelMeta;
    const params: Record<string, any> = {
      model: config.modelId || model.id,
      max_tokens: 8192,
    };

    const overrides = config.paramOverrides || {};
    if (overrides.temperature !== undefined) params.temperature = overrides.temperature;
    if (overrides.maxTokens !== undefined) params.max_tokens = overrides.maxTokens;
    if (overrides.topP !== undefined) params.top_p = overrides.topP;

    return params;
  }

  const adapter: ITextProviderAdapter = {
    getProvider() { return provider; },
    getModels() { return models; },

    async sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);
      const { system, messages: anthropicMessages } = messagesToAnthropic(messages);

      const response = await client.messages.create({
        ...params,
        system,
        messages: anthropicMessages as any,
      } as any);

      const content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      return {
        content,
        metadata: {
          model: response.model,
          finishReason: response.stop_reason || undefined,
        },
      };
    },

    async sendMessageStream(messages: Message[], config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const { system, messages: anthropicMessages } = messagesToAnthropic(messages);

        const stream: any = await client.messages.stream({
          ...params,
          system,
          messages: anthropicMessages as any,
        } as any);

        let fullContent = '';
        for await (const text of stream.textStream) {
          fullContent += text;
          callbacks.onToken(text);
        }

        const finalMessage = await stream.finalMessage();
        callbacks.onComplete({
          content: fullContent,
          metadata: { model: finalMessage.model, finishReason: finalMessage.stop_reason || undefined },
        });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendMessageStreamWithTools(messages: Message[], config: TextModelConfig, tools: ToolDefinition[], callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const { system, messages: anthropicMessages } = messagesToAnthropic(messages);

        const stream: any = await client.messages.stream({
          ...params,
          system,
          messages: anthropicMessages as any,
          tools: tools.map((t: ToolDefinition) => ({
            name: t.function.name,
            description: t.function.description || '',
            input_schema: t.function.parameters as any,
          })),
        } as any);

        let fullContent = '';
        for await (const text of stream.textStream) {
          fullContent += text;
          callbacks.onToken(text);
        }

        const finalMessage = await stream.finalMessage();
        const toolUseBlocks = finalMessage.content.filter((block: any) => block.type === 'tool_use');

        if (toolUseBlocks.length > 0) {
          for (const block of toolUseBlocks) {
            callbacks.onToolCall?.({
              id: (block as any).id,
              type: 'function',
              function: {
                name: (block as any).name,
                arguments: JSON.stringify((block as any).input),
              },
            });
          }
        }

        callbacks.onComplete({
          content: fullContent,
          metadata: { model: finalMessage.model, finishReason: finalMessage.stop_reason || undefined },
        });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendImageUnderstanding(request: ImageUnderstandingRequest, config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);

      const imageContent: any[] = request.images.map(img => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mimeType || 'image/jpeg',
          data: img.b64,
        },
      }));

      const response = await client.messages.create({
        ...params,
        system: request.systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: request.userPrompt },
            ...imageContent,
          ],
        }],
      } as any);

      const content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      return {
        content,
        metadata: { model: response.model },
      };
    },

    async sendImageUnderstandingStream(request: ImageUnderstandingRequest, config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);

        const imageContent: any[] = request.images.map(img => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mimeType || 'image/jpeg',
            data: img.b64,
          },
        }));

        const stream: any = await client.messages.stream({
          ...params,
          system: request.systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: request.userPrompt },
              ...imageContent,
            ],
          }],
        } as any);

        let fullContent = '';
        for await (const text of stream.textStream) {
          fullContent += text;
          callbacks.onToken(text);
        }
        callbacks.onComplete({ content: fullContent, metadata: { model: params.model } });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    buildDefaultModel(modelId: string): TextModel {
      return {
        id: modelId,
        name: modelId,
        providerId: 'anthropic',
        capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 200000 },
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
      description: 'Controls randomness. Lower = more deterministic.',
      type: 'number',
      default: 0.7,
      min: 0,
      max: 1,
    },
    {
      key: 'maxTokens',
      name: 'Max Tokens',
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
      default: 1,
      min: 0,
      max: 1,
    },
  ];
}
