import { StreamHandlers, Message } from '../llm/types';
import { LLMService } from '../llm/service';
import { TemplateManager, TemplateProcessor } from '../template/manager';
import { HistoryManager, PromptRecord } from '../history/manager';
import { TemplateTestHistoryManager } from '../template-test/manager';
import { TemplateTestRecord } from '../template-test/types';
import { v4 as uuidv4 } from 'uuid';

export interface OptimizationRequest {
  optimizationMode: 'system' | 'user';
  targetPrompt: string;
  modelKey: string;
  templateId?: string;
}

export interface MessageOptimizationRequest {
  targetMessage: string;
  modelKey: string;
  templateId?: string;
}

export interface IterateRequest {
  originalPrompt: string;
  lastOptimizedPrompt: string;
  iterateInput: string;
  modelKey: string;
  templateId?: string;
  recordId?: string;
}

export interface TestRequest {
  systemPrompt: string;
  userPrompt: string;
  modelKey: string;
}

export interface TestTemplateRequest {
  templateId: string;
  templateName: string;
  variables: Record<string, string>;
  processedSystemPrompt: string;
  processedUserPrompt: string;
  modelKey: string;
  modelInfo: { id: string; name: string; providerId: string };
  saveHistory: boolean;
}

export class PromptService {
  private llmService: LLMService;
  private templateManager: TemplateManager;
  private historyManager: HistoryManager;
  private templateTestHistoryManager: TemplateTestHistoryManager;

  constructor(
    llmService: LLMService,
    templateManager: TemplateManager,
    historyManager: HistoryManager,
    templateTestHistoryManager: TemplateTestHistoryManager,
  ) {
    this.llmService = llmService;
    this.templateManager = templateManager;
    this.historyManager = historyManager;
    this.templateTestHistoryManager = templateTestHistoryManager;
  }

  async optimizePrompt(request: OptimizationRequest): Promise<string> {
    const template = await this.templateManager.getTemplate(request.templateId || 'optimize-general');
    if (!template) {
      throw new Error(`Template not found: ${request.templateId || 'optimize-general'}`);
    }

    const variables = { originalPrompt: request.targetPrompt };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.targetPrompt },
    ];

    const result = await this.llmService.sendMessage(messages, request.modelKey);

    // Save to history
    const record: PromptRecord = {
      id: uuidv4(),
      originalContent: request.targetPrompt,
      optimizedContent: result,
      templateId: template.id,
      modelKey: request.modelKey,
      optimizationMode: request.optimizationMode,
      createdAt: Date.now(),
      iterationCount: 0,
      parentIds: [],
    };
    await this.historyManager.addRecord(record);

    return result;
  }

  async optimizeMessage(request: MessageOptimizationRequest): Promise<string> {
    const template = await this.templateManager.getTemplate(request.templateId || 'user-optimize-professional');
    if (!template) {
      throw new Error(`Template not found: ${request.templateId || 'user-optimize-professional'}`);
    }

    const variables = { originalPrompt: request.targetMessage };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.targetMessage },
    ];

    return this.llmService.sendMessage(messages, request.modelKey);
  }

  async iteratePrompt(request: IterateRequest): Promise<string> {
    const template = await this.templateManager.getTemplate(request.templateId || 'iterate-general');
    if (!template) {
      throw new Error(`Template not found: ${request.templateId || 'iterate-general'}`);
    }

    const variables = {
      originalPrompt: request.originalPrompt,
      lastOptimizedPrompt: request.lastOptimizedPrompt,
      iterateInput: request.iterateInput,
    };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.iterateInput },
    ];

    const result = await this.llmService.sendMessage(messages, request.modelKey);

    // Update history
    if (request.recordId) {
      const existing = await this.historyManager.getRecord(request.recordId);
      if (existing) {
        await this.historyManager.updateRecord(request.recordId, {
          optimizedContent: result,
          iterationCount: existing.iterationCount + 1,
          parentIds: [...existing.parentIds, existing.id],
        });
      }
    }

    return result;
  }

  async testPrompt(systemPrompt: string, userPrompt: string, modelKey: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return this.llmService.sendMessage(messages, modelKey);
  }

  async getHistory(): Promise<PromptRecord[]> {
    return this.historyManager.getRecords();
  }

  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return this.historyManager.getIterationChain(recordId);
  }

  // --- Stream methods ---

  async optimizePromptStream(request: OptimizationRequest, callbacks: StreamHandlers): Promise<void> {
    const template = await this.templateManager.getTemplate(request.templateId || 'optimize-general');
    if (!template) {
      callbacks.onError(new Error(`Template not found: ${request.templateId || 'optimize-general'}`));
      return;
    }

    const variables = { originalPrompt: request.targetPrompt };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.targetPrompt },
    ];

    let fullContent = '';
    await this.llmService.sendMessageStream(messages, request.modelKey, {
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onReasoningToken: (token) => {
        callbacks.onReasoningToken?.(token);
      },
      onComplete: (response) => {
        const finalContent = response?.content || fullContent;
        // Save to history
        const record: PromptRecord = {
          id: uuidv4(),
          originalContent: request.targetPrompt,
          optimizedContent: finalContent,
          templateId: template.id,
          modelKey: request.modelKey,
          optimizationMode: request.optimizationMode,
          createdAt: Date.now(),
          iterationCount: 0,
          parentIds: [],
        };
        this.historyManager.addRecord(record).catch(() => {});
        callbacks.onComplete(response);
      },
      onError: callbacks.onError,
    });
  }

  async optimizeMessageStream(request: MessageOptimizationRequest, callbacks: StreamHandlers): Promise<void> {
    const template = await this.templateManager.getTemplate(request.templateId || 'user-optimize-professional');
    if (!template) {
      callbacks.onError(new Error(`Template not found: ${request.templateId || 'user-optimize-professional'}`));
      return;
    }

    const variables = { originalPrompt: request.targetMessage };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.targetMessage },
    ];

    await this.llmService.sendMessageStream(messages, request.modelKey, callbacks);
  }

  async iteratePromptStream(
    request: IterateRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    const template = await this.templateManager.getTemplate(request.templateId || 'iterate-general');
    if (!template) {
      callbacks.onError(new Error(`Template not found: ${request.templateId || 'iterate-general'}`));
      return;
    }

    const variables = {
      originalPrompt: request.originalPrompt,
      lastOptimizedPrompt: request.lastOptimizedPrompt,
      iterateInput: request.iterateInput,
    };
    const processed = TemplateProcessor.processAdvanced(template, variables);

    const messages: Message[] = [
      { role: 'system', content: processed.system },
      { role: 'user', content: processed.user || request.iterateInput },
    ];

    let fullContent = '';
    await this.llmService.sendMessageStream(messages, request.modelKey, {
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onReasoningToken: (token) => {
        callbacks.onReasoningToken?.(token);
      },
      onComplete: (response) => {
        const finalContent = response?.content || fullContent;
        const recordId = request.recordId;
        if (recordId) {
          this.historyManager.getRecord(recordId).then(existing => {
            if (existing) {
              this.historyManager.updateRecord(recordId, {
                optimizedContent: finalContent,
                iterationCount: existing.iterationCount + 1,
                parentIds: [...existing.parentIds, existing.id],
              }).catch(() => {});
            }
          }).catch(() => {});
        }
        callbacks.onComplete(response);
      },
      onError: callbacks.onError,
    });
  }

  async testPromptStream(systemPrompt: string, userPrompt: string, modelKey: string, callbacks: StreamHandlers): Promise<void> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    await this.llmService.sendMessageStream(messages, modelKey, callbacks);
  }

  async testCustomConversationStream(request: { conversation: Array<{ system: string; user: string }>; modelKey: string }, callbacks: StreamHandlers): Promise<void> {
    // Process each turn sequentially
    for (const turn of request.conversation) {
      const messages: Message[] = [
        { role: 'system', content: turn.system },
        { role: 'user', content: turn.user },
      ];

      await new Promise<void>((resolve) => {
        let fullContent = '';
        this.llmService.sendMessageStream(messages, request.modelKey, {
          onToken: (token) => {
            fullContent += token;
            callbacks.onToken(token);
          },
          onReasoningToken: (token) => {
            callbacks.onReasoningToken?.(token);
          },
          onComplete: () => {
            resolve();
          },
          onError: (error) => {
            callbacks.onError(error);
            resolve();
          },
        });
      });
    }
    callbacks.onComplete();
  }

  // [AGC:START] tool=Cc author=fangkun
  async testTemplateStream(
    request: TestTemplateRequest,
    callbacks: StreamHandlers
  ): Promise<void> {
    const startTime = Date.now();
    let fullContent = '';

    const messages: Message[] = [
      { role: 'system', content: request.processedSystemPrompt },
      { role: 'user', content: request.processedUserPrompt },
    ];

    await this.llmService.sendMessageStream(messages, request.modelKey, {
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onReasoningToken: callbacks.onReasoningToken,
      onComplete: async (response) => {
        const finalContent = response?.content || fullContent;
        const duration = Date.now() - startTime;

        // Save test history
        if (request.saveHistory) {
          const record: TemplateTestRecord = {
            id: uuidv4(),
            templateId: request.templateId,
            templateName: request.templateName,
            variables: request.variables,
            processedSystemPrompt: request.processedSystemPrompt,
            processedUserPrompt: request.processedUserPrompt,
            modelKey: request.modelKey,
            modelInfo: request.modelInfo,
            output: finalContent,
            timestamp: Date.now(),
            duration,
          };

          try {
            await this.templateTestHistoryManager.addRecord(record);
          } catch (e) {
            console.error('Failed to save test history:', e);
          }
        }

        callbacks.onComplete(response);
      },
      onError: callbacks.onError,
    });
  }
  // [AGC:END]
}
