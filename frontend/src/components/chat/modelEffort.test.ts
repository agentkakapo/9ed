import { describe, expect, it } from 'vitest';
import { cleanOptionName, hasModelEfforts, normalizeConfigOption, parseModelEffortItem, splitModelAndEffort } from './modelEffort';
import type { ConfigOptionInfo } from '../../types';

describe('cleanOptionName', () => {
  it('strips (Default) / (default) / [Default] / (recommended) suffixes', () => {
    expect(cleanOptionName('Claude 3.5 Sonnet (default)')).toBe('Claude 3.5 Sonnet');
    expect(cleanOptionName('Sonnet 5.5 (Default)')).toBe('Sonnet 5.5');
    expect(cleanOptionName('Gemini 3.8 Flash [Default]')).toBe('Gemini 3.8 Flash');
    expect(cleanOptionName('Claude 3.5 Sonnet (recommended)')).toBe('Claude 3.5 Sonnet');
  });

  it('resolves model Default (recommended) to model name from description', () => {
    expect(cleanOptionName('Default (recommended)', 'model', 'Sonnet 5.5')).toBe('Sonnet 5.5');
    expect(cleanOptionName('Default', 'model', 'Sonnet 5.5')).toBe('Sonnet 5.5');
  });

  it('resolves effort Default to Medium', () => {
    expect(cleanOptionName('Default', 'effort')).toBe('Medium');
    expect(cleanOptionName('default', 'effort')).toBe('Medium');
    expect(cleanOptionName('Standard', 'effort')).toBe('Medium');
  });

  it('resolves agent Default to Claude Code', () => {
    expect(cleanOptionName('Default', 'agent', 'Standard Claude Code agent')).toBe('Claude Code');
    expect(cleanOptionName('default', 'agent')).toBe('Claude Code');
    expect(cleanOptionName('Standard', 'agent')).toBe('Claude Code');
  });

  it('resolves mode Default to Manual', () => {
    expect(cleanOptionName('Default', 'mode', 'Default permission prompt flow')).toBe('Manual');
    expect(cleanOptionName('default', 'mode')).toBe('Manual');
    expect(cleanOptionName('Standard', 'mode')).toBe('Manual');
  });

  it('keeps other option names intact', () => {
    expect(cleanOptionName('Auto Edit', 'mode')).toBe('Auto Edit');
    expect(cleanOptionName('YOLO', 'mode')).toBe('YOLO');
    expect(cleanOptionName('High', 'effort')).toBe('High');
  });
});

describe('normalizeConfigOption', () => {
  it('normalizes Claude models: deduplicates Sonnet 5.5, reorders top 4, preserves default selection', () => {
    const rawClaudeModelOption: ConfigOptionInfo = {
      id: 'model',
      name: 'Model',
      type: 'select',
      currentValue: 'default',
      options: [
        { value: 'default', name: 'Default (recommended)', description: 'Sonnet 5.5' },
        { value: 'opus', name: 'Opus 5.5', description: 'For complex work and everyday tasks' },
        { value: 'fable', name: 'Fable 5.1', description: 'For your toughest challenges' },
        { value: 'sonnet', name: 'Sonnet 5.5', description: 'Most efficient for simpler tasks' },
        { value: 'haiku', name: 'Haiku 5.5', description: 'Fastest for quick answers' },
      ],
    };

    const normalized = normalizeConfigOption(rawClaudeModelOption);
    expect(normalized.options.map((o) => o.name)).toEqual([
      'Opus 5.5',
      'Sonnet 5.5',
      'Fable 5.1',
      'Haiku 5.5',
    ]);
    // The Sonnet 5.5 entry preserves value: 'default' so currentValue matches
    const sonnetEntry = normalized.options.find((o) => o.name === 'Sonnet 5.5');
    expect(sonnetEntry?.value).toBe('default');
  });

  it('normalizes Claude effort: deduplicates Medium, sorts logically, preserves default selection', () => {
    const rawEffortOption: ConfigOptionInfo = {
      id: 'effort',
      name: 'Effort',
      type: 'select',
      currentValue: 'default',
      options: [
        { value: 'default', name: 'Default' },
        { value: 'low', name: 'Low' },
        { value: 'medium', name: 'Medium' },
        { value: 'high', name: 'High' },
        { value: 'xhigh', name: 'Xhigh' },
        { value: 'max', name: 'Max' },
      ],
    };

    const normalized = normalizeConfigOption(rawEffortOption);
    expect(normalized.options.map((o) => o.name)).toEqual([
      'Low',
      'Medium',
      'High',
      'Xhigh',
      'Max',
    ]);
    const mediumEntry = normalized.options.find((o) => o.name === 'Medium');
    expect(mediumEntry?.value).toBe('default');
  });
});

describe('modelEffort parsing and splitting for Gemini', () => {
  const geminiOption: ConfigOptionInfo = {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue: 'gemini-pro-agent',
    options: [
      { value: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', description: 'gemini-3.8-flash-high' },
      { value: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)', description: 'gemini-3.8-flash-medium' },
      { value: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)', description: 'gemini-3.8-flash-low' },
      { value: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)', description: 'gemini-3.7-flash-high' },
      { value: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Medium)', description: 'gemini-3.7-flash-medium' },
      { value: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash (Low)', description: 'gemini-3.7-flash-low' },
      { value: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash (High)', description: 'gemini-3.6-flash-high' },
      { value: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash (Medium)', description: 'gemini-3.6-flash-medium' },
      { value: 'gemini-3.6-flash-low', name: 'Gemini 3.6 Flash (Low)', description: 'gemini-3.6-flash-low' },
      { value: 'gemini-pro-agent', name: 'Gemini 3.1 Pro (High)', description: 'gemini-pro-agent' },
      { value: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)', description: 'gemini-3.1-pro-low' },
    ],
  };

  const claudeOption: ConfigOptionInfo = {
    id: 'model',
    name: 'Model',
    type: 'select',
    currentValue: 'claude-sonnet-5-5',
    options: [
      { value: 'claude-opus-5-5', name: 'Opus 5.5' },
      { value: 'claude-sonnet-5-5', name: 'Sonnet 5.5' },
      { value: 'claude-fable-5-1', name: 'Fable 5.1' },
      { value: 'claude-haiku-5-5', name: 'Haiku 5.5' },
    ],
  };

  it('detects effort suffixes in Gemini models', () => {
    expect(hasModelEfforts(geminiOption)).toBe(true);
    expect(hasModelEfforts(claudeOption)).toBe(false);
  });

  it('correctly parses base model and effort level', () => {
    const item = parseModelEffortItem({ value: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' });
    expect(item.baseName).toBe('Gemini 3.8 Flash');
    expect(item.effort).toBe('Low');
  });

  it('deduplicates Gemini models into unique base models and creates second effort dropdown', () => {
    const split = splitModelAndEffort(geminiOption);

    // Should only have 4 unique base models instead of 11 repeated ones
    expect(split.baseModelOption.options).toHaveLength(4);
    expect(split.baseModelOption.options.map((o) => o.name)).toEqual([
      'Gemini 3.8 Flash',
      'Gemini 3.7 Flash',
      'Gemini 3.6 Flash',
      'Gemini 3.1 Pro',
    ]);

    // Current selection for gemini-pro-agent is Gemini 3.1 Pro (High)
    expect(split.currentBaseModel).toBe('Gemini 3.1 Pro');
    expect(split.currentEffort).toBe('High');

    // Second effort dropdown
    expect(split.effortOption.options.map((o) => o.value)).toEqual(['Low', 'High']);
    expect(split.effortOption.currentValue).toBe('High');

    // Switching effort to Low resolves to gemini-3.1-pro-low
    expect(split.resolveModelValue('Gemini 3.1 Pro', 'Low')).toBe('gemini-3.1-pro-low');

    // Switching base model to Gemini 3.8 Flash with High effort resolves to gemini-3.8-flash-high
    expect(split.resolveModelValue('Gemini 3.8 Flash', 'High')).toBe('gemini-3.8-flash-high');
    // with Medium effort
    expect(split.resolveModelValue('Gemini 3.8 Flash', 'Medium')).toBe('gemini-3.8-flash-medium');
  });
});
