import OpenAI from 'openai';
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

export function createOpenAIAdapter(): ITextProviderAdapter {
  const provider: TextProvider = {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
    supportsDynamicModels: false,
  };

  const models: TextModel[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      providerId: 'openai',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 128000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 4096 },
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      providerId: 'openai',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 128000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 4096 },
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      providerId: 'openai',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 8192 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 4096 },
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      providerId: 'openai',
      capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 16385 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 4096 },
    },
    {
      id: 'o1',
      name: 'o1',
      providerId: 'openai',
      capabilities: { supportsTools: false, supportsReasoning: true, maxContextLength: 200000 },
      parameterDefinitions: [],
      defaultParameterValues: {},
    },
    {
      id: 'o1-mini',
      name: 'o1 Mini',
      providerId: 'openai',
      capabilities: { supportsTools: false, supportsReasoning: true, maxContextLength: 128000 },
      parameterDefinitions: [],
      defaultParameterValues: {},
    },
    {
      id: 'o3-mini',
      name: 'O3 Mini',
      providerId: 'openai',
      capabilities: { supportsTools: true, supportsReasoning: true, maxContextLength: 200000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: {},
    },
  ];

  function getClient(config: TextModelConfig): OpenAI {
    return new OpenAI({
      apiKey: config.connectionConfig.apiKey,
      baseURL: config.connectionConfig.baseURL || provider.defaultBaseURL,
    });
  }

  function buildParams(config: TextModelConfig): Record<string, any> {
    const model = config.modelMeta;
    const params: Record<string, any> = {
      model: config.modelId || model.id,
    };

    const overrides = config.paramOverrides || {};
    if (overrides.temperature !== undefined) params.temperature = overrides.temperature;
    if (overrides.maxTokens !== undefined) params.max_tokens = overrides.maxTokens;
    if (overrides.topP !== undefined) params.top_p = overrides.topP;
    if (overrides.frequencyPenalty !== undefined) params.frequency_penalty = overrides.frequencyPenalty;
    if (overrides.presencePenalty !== undefined) params.presence_penalty = overrides.presencePenalty;
    if (overrides.stop !== undefined) params.stop = overrides.stop;

    return params;
  }

  function messagesToOpenAIMessages(messages: Message[]): Array<{ role: string; content: string; name?: string }> {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    }));
  }

  const adapter: ITextProviderAdapter = {
    getProvider() { return provider; },
    getModels() { return models; },

    async sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);
      const response = await client.chat.completions.create({
        ...params,
        messages: messagesToOpenAIMessages(messages),
      } as any);

      const choice = response.choices[0];
      return {
        content: choice?.message?.content || '',
        metadata: {
          model: response.model,
          finishReason: choice?.finish_reason || undefined,
        },
      };
    },

    async sendMessageStream(messages: Message[], config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const stream = await client.chat.completions.create({
          ...params,
          messages: messagesToOpenAIMessages(messages) as any,
          stream: true,
        } as any) as any;

        let fullContent = '';
        let reasoningContent = '';

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            callbacks.onToken(delta.content);
          }
          if (delta?.reasoning_content || (delta as any)?.reasoning) {
            const reasoning = (delta.reasoning_content || (delta as any).reasoning) as string;
            reasoningContent += reasoning;
            callbacks.onReasoningToken?.(reasoning);
          }
        }

        callbacks.onComplete({
          content: fullContent,
          reasoning: reasoningContent || undefined,
          metadata: { model: params.model as string },
        });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendMessageStreamWithTools(messages: Message[], config: TextModelConfig, tools: ToolDefinition[], callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);
        const stream = await client.chat.completions.create({
          ...params,
          messages: messagesToOpenAIMessages(messages),
          tools: tools.map((t: ToolDefinition) => ({ type: 'function' as const, function: t.function })),
          stream: false,
        } as any);

        const choice = stream.choices[0];
        if (choice?.message?.tool_calls) {
          for (const tc of choice.message.tool_calls) {
            callbacks.onToolCall?.({
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments },
            });
          }
        }

        callbacks.onComplete({
          content: choice?.message?.content || '',
          toolCalls: choice?.message?.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
          metadata: { model: stream.model },
        });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendImageUnderstanding(request: ImageUnderstandingRequest, config: TextModelConfig): Promise<LLMResponse> {
      const client = getClient(config);
      const params = buildParams(config);

      const contentParts: any[] = [{ type: 'text', text: request.userPrompt }];
      for (const img of request.images) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType || 'image/jpeg'};base64,${img.b64}`,
          },
        });
      }

      const response = await client.chat.completions.create({
        ...params,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          { role: 'user' as const, content: contentParts },
        ],
      } as any);

      return {
        content: response.choices[0]?.message?.content || '',
        metadata: { model: response.model },
      };
    },

    async sendImageUnderstandingStream(request: ImageUnderstandingRequest, config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      try {
        const client = getClient(config);
        const params = buildParams(config);

        const contentParts: any[] = [{ type: 'text', text: request.userPrompt }];
        for (const img of request.images) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${img.mimeType || 'image/jpeg'};base64,${img.b64}`,
            },
          });
        }

        const stream = await client.chat.completions.create({
          ...params,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
            { role: 'user' as const, content: contentParts },
          ],
          stream: true,
        } as any) as any;

        let fullContent = '';
        for await (const chunk of stream as any) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            callbacks.onToken(delta.content);
          }
        }
        callbacks.onComplete({ content: fullContent, metadata: { model: params.model as string } });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    buildDefaultModel(modelId: string): TextModel {
      return {
        id: modelId,
        name: modelId,
        providerId: 'openai',
        capabilities: { supportsTools: true, supportsReasoning: false, maxContextLength: 128000 },
        parameterDefinitions: getParameterDefinitions(),
        defaultParameterValues: { temperature: 0.7, maxTokens: 4096 },
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
      max: 2,
    },
    {
      key: 'maxTokens',
      name: 'Max Tokens',
      description: 'Maximum number of tokens to generate.',
      type: 'number',
      default: 4096,
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
    {
      key: 'frequencyPenalty',
      name: 'Frequency Penalty',
      description: 'Penalizes repeated tokens.',
      type: 'number',
      default: 0,
      min: -2,
      max: 2,
    },
    {
      key: 'presencePenalty',
      name: 'Presence Penalty',
      description: 'Penalizes repeated topics.',
      type: 'number',
      default: 0,
      min: -2,
      max: 2,
    },
  ];
}
