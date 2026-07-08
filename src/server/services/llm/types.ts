export interface ConnectionSchema {
  required: string[];
  optional: string[];
  fieldTypes: Record<string, 'string' | 'number' | 'boolean'>;
}

export interface TextProvider {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly corsRestricted?: boolean;
  readonly requiresApiKey: boolean;
  readonly defaultBaseURL: string;
  readonly supportsDynamicModels: boolean;
  readonly connectionSchema?: ConnectionSchema;
  readonly apiKeyUrl?: string;
}

export interface ParameterDefinition {
  key: string;
  name: string;
  description: string;
  type: 'number' | 'string' | 'boolean';
  default: any;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: any }>;
}

export interface TextModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly providerId: string;
  readonly capabilities: {
    supportsTools: boolean;
    supportsReasoning?: boolean;
    maxContextLength?: number;
  };
  readonly parameterDefinitions: readonly ParameterDefinition[];
  readonly defaultParameterValues?: Record<string, unknown>;
}

export interface TextModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  activationState?: {
    userConfigured?: boolean;
    autoEnabledBy?: string;
  };
  providerId?: string;
  protocol?: 'openai' | 'anthropic';  // NEW: determines which adapter to use
  modelId?: string;
  providerMeta: TextProvider;
  modelMeta: TextModel;
  connectionConfig: {
    apiKey?: string;
    baseURL?: string;
    [key: string]: any;
  };
  paramOverrides?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
}

export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

export interface LLMResponse {
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: string;
  };
}

export interface StreamHandlers {
  onToken: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete: (response?: LLMResponse) => void;
  onError: (error: Error) => void;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ModelOption {
  value: string;
  label: string;
}

export interface ILLMService {
  sendMessage(messages: Message[], provider: string): Promise<string>;
  sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse>;
  sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers
  ): Promise<void>;
  sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>;
  testConnection(provider: string): Promise<void>;
  fetchModelList(provider: string, customConfig?: Partial<TextModelConfig>): Promise<ModelOption[]>;
}

export interface ITextProviderAdapter {
  getProvider(): TextProvider;
  getModels(): TextModel[];
  getModelsAsync?(config: TextModelConfig): Promise<TextModel[]>;
  sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse>;
  sendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>;
  sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>;
  sendImageUnderstanding(
    request: ImageUnderstandingRequest,
    config: TextModelConfig
  ): Promise<LLMResponse>;
  sendImageUnderstandingStream(
    request: ImageUnderstandingRequest,
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>;
  buildDefaultModel(modelId: string): TextModel;
}

export interface ImageUnderstandingImageInput {
  b64: string;
  mimeType?: string;
}

export interface ImageUnderstandingRequest {
  systemPrompt?: string;
  userPrompt: string;
  images: ImageUnderstandingImageInput[];
  paramOverrides?: Record<string, unknown>;
  responseMimeType?: string;
}

export interface ITextAdapterRegistry {
  getAdapter(providerId: string): ITextProviderAdapter;
  getAllProviders(): TextProvider[];
  getStaticModels(providerId: string): TextModel[];
  getDynamicModels(providerId: string, config: TextModelConfig): Promise<TextModel[]>;
  getModels(providerId: string, config?: TextModelConfig): Promise<TextModel[]>;
  supportsDynamicModels(providerId: string): boolean;
  validateProviderModel(providerId: string, modelId: string): boolean;
}
