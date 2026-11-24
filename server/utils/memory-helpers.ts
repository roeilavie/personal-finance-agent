import type { ModelMessage } from 'ai';

// Each turn is the user's question plus the agent's final answer (2 messages).
// Tool calls and tool results stay inside their own turn and are never kept.
export const MAX_HISTORY_TURNS = 10;

// Turns are added in pairs, so trimming the oldest messages never splits a question from its answer.
export const appendTurn = (
  history: ModelMessage[],
  question: string,
  answer: string
): ModelMessage[] =>
  [
    ...history,
    { role: 'user' as const, content: question },
    { role: 'assistant' as const, content: answer },
  ].slice(-MAX_HISTORY_TURNS * 2);

// ~4000 chars is roughly 1000 tokens: small summaries fit, a 50-row filter result does not.
export const MAX_STORED_RESULT_CHARS = 4000;
const PREVIEW_ROWS = 5;

// Returns the tool result as-is if it is small, otherwise a compact version to keep in memory.
export const compactToolResult = (toolName: string, result: unknown): unknown => {
  const size = JSON.stringify(result ?? null).length;
  if (size <= MAX_STORED_RESULT_CHARS) return result;

  if (toolName === 'filter_expenses' && result && typeof result === 'object') {
    const { count, total, truncated, appliedFilters, expenses } = result as {
      count: number;
      total: number;
      truncated: boolean;
      appliedFilters: unknown;
      expenses: unknown[];
    };
    return {
      count,
      total,
      truncated,
      appliedFilters,
      expenses: expenses.slice(0, PREVIEW_ROWS),
      note: `Only the first ${PREVIEW_ROWS} of ${expenses.length} rows are kept; the rest were omitted to save space.`,
    };
  }

  return { note: `Result from ${toolName} was too large (${size} chars) and was omitted from memory.` };
};
