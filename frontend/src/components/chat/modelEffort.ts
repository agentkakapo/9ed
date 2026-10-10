import type { ConfigOptionInfo, ConfigValueInfo } from '../../types';

export const EFFORT_SUFFIX_REGEX = /\s*[\(\[](High|Medium|Low)[\)\]]$/i;

export type EffortLevel = 'Low' | 'Medium' | 'High';

export type ParsedModelItem = {
  raw: ConfigValueInfo;
  baseName: string;
  effort: EffortLevel;
  value: string;
};

/**
 * Cleans option names:
 * - Strips any "(Default)", "[Default]", "(default)" etc.
 * - Replaces literal "Default" with a meaningful name like "Standard" for mode.
 */
export function cleanOptionName(name: string, optionId?: string): string {
  if (!name) return '';
  let cleaned = name.replace(/\s*[\(\[]default[\)\]]/gi, '').trim();
  if (/^default$/i.test(cleaned)) {
    if (optionId === 'mode') {
      return 'Standard';
    }
    return 'Standard';
  }
  return cleaned || name;
}

/**
 * Checks if a model option has items repeated with effort suffixes like (Low), (Medium), (High).
 */
export function hasModelEfforts(option: ConfigOptionInfo): boolean {
  if (!option || !option.options || option.options.length === 0) return false;
  let matches = 0;
  for (const opt of option.options) {
    if (EFFORT_SUFFIX_REGEX.test(opt.name) || EFFORT_SUFFIX_REGEX.test(opt.value)) {
      matches++;
    }
  }
  return matches >= 2;
}

export function parseModelEffortItem(item: ConfigValueInfo): ParsedModelItem {
  const nameMatch = item.name.match(EFFORT_SUFFIX_REGEX);
  let effort: EffortLevel = 'High';
  let baseName = item.name;

  if (nameMatch) {
    baseName = item.name.replace(EFFORT_SUFFIX_REGEX, '').trim();
    const raw = nameMatch[1].toLowerCase();
    if (raw === 'low') effort = 'Low';
    else if (raw === 'medium') effort = 'Medium';
    else if (raw === 'high') effort = 'High';
  } else {
    const val = item.value.toLowerCase();
    if (val.endsWith('-low')) {
      effort = 'Low';
      baseName = item.name.replace(/\s*low$/i, '').trim();
    } else if (val.endsWith('-medium')) {
      effort = 'Medium';
      baseName = item.name.replace(/\s*medium$/i, '').trim();
    } else if (val.endsWith('-high')) {
      effort = 'High';
      baseName = item.name.replace(/\s*high$/i, '').trim();
    }
  }

  baseName = cleanOptionName(baseName);

  return {
    raw: item,
    baseName,
    effort,
    value: item.value,
  };
}

export function splitModelAndEffort(option: ConfigOptionInfo): {
  baseModelOption: ConfigOptionInfo;
  effortOption: ConfigOptionInfo;
  resolveModelValue: (baseName: string, effort: EffortLevel) => string;
  currentBaseModel: string;
  currentEffort: EffortLevel;
} {
  const parsedItems = option.options.map(parseModelEffortItem);

  // Collect unique base model names in order of appearance
  const uniqueBaseNames: string[] = [];
  for (const item of parsedItems) {
    if (!uniqueBaseNames.includes(item.baseName)) {
      uniqueBaseNames.push(item.baseName);
    }
  }

  // Find currently active item
  const currentParsed = parsedItems.find((p) => p.value === option.currentValue) ?? parsedItems[0];
  const currentBaseModel = currentParsed.baseName;
  const currentEffort = currentParsed.effort;

  const resolveModelValue = (baseName: string, effort: EffortLevel): string => {
    // 1. Exact match for baseName + requested effort
    const match = parsedItems.find((p) => p.baseName === baseName && p.effort === effort);
    if (match) return match.value;

    // 2. If requested effort not available for this model, fallback to High or first available
    const fallbackHigh = parsedItems.find((p) => p.baseName === baseName && p.effort === 'High');
    if (fallbackHigh) return fallbackHigh.value;

    const anyFallback = parsedItems.find((p) => p.baseName === baseName);
    if (anyFallback) return anyFallback.value;

    return option.currentValue;
  };

  // Base model option: currentValue is the current base model name
  const baseModelOptions: ConfigValueInfo[] = uniqueBaseNames.map((baseName) => {
    const rep = parsedItems.find((p) => p.baseName === baseName && p.effort === currentEffort)
      ?? parsedItems.find((p) => p.baseName === baseName)
      ?? parsedItems[0];
    return {
      value: baseName,
      name: cleanOptionName(baseName, option.id),
      description: rep.raw.description,
    };
  });

  const baseModelOption: ConfigOptionInfo = {
    ...option,
    currentValue: currentBaseModel,
    options: baseModelOptions,
  };

  // Effort option: Low, Medium, High
  // Available efforts for currently selected base model
  const availableEffortsForBase = parsedItems
    .filter((p) => p.baseName === currentBaseModel)
    .map((p) => p.effort);

  const ALL_EFFORTS: EffortLevel[] = ['Low', 'Medium', 'High'];
  const finalEfforts = ALL_EFFORTS.filter((eff) => availableEffortsForBase.includes(eff));
  const effectiveEffortList = finalEfforts.length > 0 ? finalEfforts : ALL_EFFORTS;

  const effortOption: ConfigOptionInfo = {
    id: 'model_effort',
    name: 'Effort',
    category: 'model_effort',
    type: 'select',
    currentValue: currentEffort,
    options: effectiveEffortList.map((eff) => ({
      value: eff,
      name: eff,
      description: `${eff} reasoning effort`,
    })),
  };

  return {
    baseModelOption,
    effortOption,
    resolveModelValue,
    currentBaseModel,
    currentEffort,
  };
}
