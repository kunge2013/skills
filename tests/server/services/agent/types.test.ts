import { describe, it, expect } from 'vitest';
import type { Plan, Step, UserQuestion, SkillRegistration, AgentSSEEvent } from '../../../src/server/services/agent/types';

describe('Agent Types', () => {
  it('Plan has required fields', () => {
    const plan: Plan = {
      id: 'test-1',
      userMessage: 'test',
      providerId: 'anthropic',
      modelKey: 'claude-sonnet-4-6',
      status: 'pending_review',
      steps: [],
      createdAt: '2026-07-10T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
    };
    expect(plan.id).toBe('test-1');
    expect(plan.status).toBe('pending_review');
    expect(plan.steps).toEqual([]);
  });

  it('Step has required fields', () => {
    const step: Step = {
      id: 'step-1',
      planId: 'test-1',
      skillName: 'openspec-propose',
      title: 'Create proposal',
      description: 'Generate openspec proposal',
      status: 'pending',
      output: null,
    };
    expect(step.status).toBe('pending');
    expect(step.output).toBeNull();
  });

  it('UserQuestion structure', () => {
    const q: UserQuestion = { question: 'Which file?', answer: null };
    expect(q.answer).toBeNull();
  });

  it('SkillRegistration contains content and tools', () => {
    const skill: SkillRegistration = {
      name: 'test-skill',
      description: 'A test skill',
      filePath: '/path/to/SKILL.md',
      content: '# Test Skill\n\nContent here',
      tools: [],
    };
    expect(skill.content).toContain('# Test Skill');
    expect(skill.tools).toEqual([]);
  });

  it('AgentSSEEvent type union', () => {
    const event: AgentSSEEvent = {
      type: 'step_token',
      stepId: 'step-1',
      payload: { token: 'hello' },
    };
    expect(event.type).toBe('step_token');
  });
});
