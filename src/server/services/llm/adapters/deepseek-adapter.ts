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

export function createDeepSeekAdapter(): ITextProviderAdapter {
  const provider: TextProvider = {
    id: 'deepseek',
    name: 'DeepSeek',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.deepseek.com/v1',
    supportsDynamicModels: false,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  };

  const models: TextModel[] = [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek V3',
      providerId: 'deepseek',
      capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 64000 },
      parameterDefinitions: getParameterDefinitions(),
      defaultParameterValues: { temperature: 0.7, maxTokens: 8192 },
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1',
      providerId: 'deepseek',
      capabilities: { supportsTools: false, supportsReasoning: true, maxContextLength: 64000 },
      parameterDefinitions: [],
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

    return params;
  }

  function messagesToOpenAIMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
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
          // DeepSeek R1 reasoning content
          if ((delta as any)?.reasoning_content) {
            const reasoning = (delta as any).reasoning_content as string;
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
      // DeepSeek doesn't support tool calling in streaming mode
      // Use non-streaming approach
      try {
        const client = getClient(config);
        const params = buildParams(config);

        const response = await client.chat.completions.create({
          ...params,
          messages: messagesToOpenAIMessages(messages),
          tools: tools.map((t: ToolDefinition) => ({ type: 'function' as const, function: t.function })),
        } as any);

        const choice = response.choices[0];
        callbacks.onComplete({
          content: choice?.message?.content || '',
          toolCalls: choice?.message?.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
          metadata: { model: response.model },
        });
      } catch (error) {
        callbacks.onError(error as Error);
      }
    },

    async sendImageUnderstanding(request: ImageUnderstandingRequest, config: TextModelConfig): Promise<LLMResponse> {
      // DeepSeek doesn't support image understanding
      throw new Error('DeepSeek does not support image understanding');
    },

    async sendImageUnderstandingStream(request: ImageUnderstandingRequest, config: TextModelConfig, callbacks: StreamHandlers): Promise<void> {
      callbacks.onError(new Error('DeepSeek does not support image understanding'));
    },

    buildDefaultModel(modelId: string): TextModel {
      return {
        id: modelId,
        name: modelId,
        providerId: 'deepseek',
        capabilities: { supportsTools: false, supportsReasoning: false, maxContextLength: 64000 },
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
