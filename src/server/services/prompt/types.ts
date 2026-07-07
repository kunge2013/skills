import { Message, StreamHandlers } from '../llm/types';

export interface IPromptService {
  optimizePrompt(request: any): Promise<string>;
  optimizeMessage(request: any): Promise<string>;
  iteratePrompt(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    templateId?: string,
    contextData?: any,
  ): Promise<string>;
  testPrompt(systemPrompt: string, userPrompt: string, modelKey: string): Promise<string>;
  getHistory(): Promise<any[]>;
  getIterationChain(recordId: string): Promise<any[]>;
  optimizePromptStream(request: any, callbacks: StreamHandlers): Promise<void>;
  optimizeMessageStream(request: any, callbacks: StreamHandlers): Promise<void>;
  iteratePromptStream(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    callbacks: StreamHandlers,
    templateId: string,
    contextData?: any,
  ): Promise<void>;
  testPromptStream(systemPrompt: string, userPrompt: string, modelKey: string, callbacks: StreamHandlers): Promise<void>;
  testCustomConversationStream(request: any, callbacks: StreamHandlers): Promise<void>;
}
