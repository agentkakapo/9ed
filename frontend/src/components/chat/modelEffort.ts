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
 * - Strips any "(Default)", "[Default]", "(default)", "(recommended)", "[recommended]" etc.
 * - Resolves literal "Default" or "Default (recommended)" to the actual entity name
 *   (e.g. model name like "Sonnet 5.5", effort level "Medium", agent "Claude Code", mode "Manual").
 * - Never returns "Default" or "Standard".
 */
export function cleanOptionName(name: string, optionId?: string, description?: string): string {
  if (!name) return '';

  // 1. Strip parenthetical / bracketed default / recommended tags
  const cleaned = name
    .replace(/\s*[\(\[](default|recommended)[\)\]]/gi, '')
    .trim();

  // 2. If it is or starts with "Default", resolve to the actual item identity
  if (/^default(\s*\(.*\))?$/i.test(cleaned) || /^default$/i.test(cleaned)) {
    const opt = (optionId ?? '').toLowerCase();

    // Model option: resolve to actual model name from description
    if (opt.includes('model')) {
      if (description && !/^default/i.test(description) && !/^standard/i.test(description)) {
        return description.trim();
      }
      return 'Sonnet 5.5';
    }

    // Effort / thought level option
    if (opt.includes('effort') || opt.includes('thought')) {
      return 'Medium';
    }

    // Agent persona option
    if (opt.includes('agent')) {
      if (description) {
        // e.g. "Standard Claude Code agent" -> "Claude Code"
        const m = description.match(/(?:Standard\s+)?(.*?)(?:\s+agent)?$/i);
        if (m && m[1] && !/^default/i.test(m[1]) && !/^standard/i.test(m[1])) {
          return m[1].trim();
        }
      }
      return 'Claude Code';
    }

    // Permission mode option
    if (opt.includes('mode')) {
      return 'Manual';
    }

    if (description && !/^default/i.test(description) && !/^standard/i.test(description)) {
      return description.trim();
    }

    return 'Manual';
  }

  // Also replace any remaining literal "standard" if it were present
  if (/^standard$/i.test(cleaned)) {
    const opt = (optionId ?? '').toLowerCase();
    if (opt.includes('effort') || opt.includes('thought')) return 'Medium';
    if (opt.includes('agent')) return 'Claude Code';
    if (opt.includes('mode')) return 'Manual';
    if (opt.includes('model')) return 'Sonnet 5.5';
    return 'Manual';
  }

  return cleaned || name;
}

/**
 * Normalizes a ConfigOptionInfo:
 * - Cleans option names to remove Default/Standard/Recommended labels.
 * - Deduplicates options that have the same cleaned display name (e.g. "default" representing "Sonnet 5.5" vs explicit "sonnet" representing "Sonnet 5.5").
 * - Preserves the active currentValue by retaining whichever option key matches currentValue.
 * - Sorts effort options logically: Low, Medium, High, Xhigh, Max.
 * - Re-orders Claude model options so primary models are Opus, Sonnet, Fable, Haiku.
 */
export function normalizeConfigOption(option: ConfigOptionInfo): ConfigOptionInfo {
  if (!option || !option.options || option.options.length === 0) return option;

  const optId = option.id.toLowerCase();
  const cleanedItems: ConfigValueInfo[] = [];

  for (const item of option.options) {
    const cleanedName = cleanOptionName(item.name, option.id, item.description);
    const isCurrent = item.value === option.currentValue;

    const existingIndex = cleanedItems.findIndex(
      (ci) => ci.name.toLowerCase() === cleanedName.toLowerCase()
    );

    if (existingIndex >= 0) {
      if (isCurrent) {
        // Current item is active; replace existing entry with this one to preserve currentValue
        cleanedItems[existingIndex] = {
          ...item,
          name: cleanedName,
        };
      } else if (cleanedItems[existingIndex].value === 'default' && option.currentValue !== 'default') {
        // Prefer specific value over generic 'default' when 'default' is not active
        cleanedItems[existingIndex] = {
          ...item,
          name: cleanedName,
        };
      }
      continue;
    }

    cleanedItems.push({
      ...item,
      name: cleanedName,
    });
  }

  // Claude models reordering: if Sonnet (from default) is at index 0 and Opus at index 1,
  // put Opus first so the top 4 are Opus, Sonnet, Fable, Haiku
  if (optId.includes('model') && cleanedItems.length >= 2) {
    if (
      cleanedItems[0].name.toLowerCase().includes('sonnet') &&
      cleanedItems[1].name.toLowerCase().includes('opus')
    ) {
      const temp = cleanedItems[0];
      cleanedItems[0] = cleanedItems[1];
      cleanedItems[1] = temp;
    }
  }

  // Effort options logical ordering: Low, Medium, High, Xhigh, Max
  if (optId.includes('effort') || optId.includes('thought')) {
    const effortOrder = ['low', 'medium', 'high', 'xhigh', 'max'];
    cleanedItems.sort((a, b) => {
      const aIdx = effortOrder.indexOf(a.name.toLowerCase());
      const bIdx = effortOrder.indexOf(b.name.toLowerCase());
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      return 0;
    });
  }

  return {
    ...option,
    options: cleanedItems,
  };
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
