import { describe, expect, it } from 'vitest';
import { cleanOptionName, hasModelEfforts, parseModelEffortItem, splitModelAndEffort } from './modelEffort';
import type { ConfigOptionInfo } from '../../types';

describe('cleanOptionName', () => {
  it('strips (Default) / (default) / [Default] suffixes', () => {
    expect(cleanOptionName('Claude 3.5 Sonnet (default)')).toBe('Claude 3.5 Sonnet');
    expect(cleanOptionName('Sonnet 5.5 (Default)')).toBe('Sonnet 5.5');
    expect(cleanOptionName('Gemini 3.8 Flash [Default]')).toBe('Gemini 3.8 Flash');
  });

  it('transforms literal Default into Standard for mode option', () => {
    expect(cleanOptionName('Default', 'mode')).toBe('Standard');
    expect(cleanOptionName('default', 'mode')).toBe('Standard');
  });

  it('keeps other option names intact', () => {
    expect(cleanOptionName('Auto Edit', 'mode')).toBe('Auto Edit');
    expect(cleanOptionName('YOLO', 'mode')).toBe('YOLO');
    expect(cleanOptionName('High', 'effort')).toBe('High');
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
