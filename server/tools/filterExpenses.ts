import { tool } from 'ai';
import { z } from 'zod';
import {
  applyFilters,
  filterParamsSchema,
  pickFilters,
  round2,
  ToolContext,
} from './filters';
import { sum } from '../utils/math-helpers';

const DEFAULT_LIMIT = 50;

const filterExpensesSchema = filterParamsSchema.extend({
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Maximum number of expenses to return (default ${DEFAULT_LIMIT})`),
});

export type FilterExpensesInput = z.infer<typeof filterExpensesSchema>;

export const filterExpensesTool = tool({
  description:
    'Get the individual expenses that match the given criteria, sorted by date. ' +
    'Use for "show me groceries from last month" or "expenses over $50". ' +
    'All filters are optional and can be combined.',
  inputSchema: filterExpensesSchema,
});

export const filterExpenses = (input: FilterExpensesInput, ctx: ToolContext) => {
  const matches = applyFilters(ctx.expenses, input, ctx.anomalies).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const limit = input.limit ?? DEFAULT_LIMIT;

  return {
    count: matches.length,
    total: round2(sum(matches.map((e) => e.amount))),
    expenses: matches.slice(0, limit),
    truncated: matches.length > limit,
    appliedFilters: pickFilters(input),
  };
};
