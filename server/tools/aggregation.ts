import { tool } from 'ai';
import { z } from 'zod';
import {
  applyFilters,
  filterParamsSchema,
  pickFilters,
  round2,
  ToolContext,
} from './filters';
import { groupBy } from '../utils/array-helpers';
import { sum } from '../utils/math-helpers';
import { Expense } from '../agent/types';

const aggregateExpensesSchema = filterParamsSchema.extend({
  groupBy: z
    .enum(['category', 'month', 'vendor'])
    .describe('What to group the expenses by (month groups look like YYYY-MM)'),
  sortBy: z
    .enum(['total', 'count', 'key'])
    .optional()
    .describe('How to sort the groups (default: total)'),
  order: z
    .enum(['asc', 'desc'])
    .optional()
    .describe('Sort direction (default: desc; use asc with sortBy=key for chronological months)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Only return the first N groups, e.g. 5 for "top 5 vendors"'),
});

export type AggregateExpensesInput = z.infer<typeof aggregateExpensesSchema>;

export const aggregateExpensesTool = tool({
  description:
    'Group expenses and return the total and count for each group. Use for ' +
    '"spending by category", "monthly breakdown" or "top vendors". ' +
    'All filters are optional.',
  inputSchema: aggregateExpensesSchema,
});

const keyFns: Record<AggregateExpensesInput['groupBy'], (e: Expense) => string> = {
  category: (e) => e.category ?? 'uncategorized',
  month: (e) => e.date.slice(0, 7),
  vendor: (e) => e.vendor,
};

export const aggregateExpenses = (
  input: AggregateExpensesInput,
  ctx: ToolContext
) => {
  const matches = applyFilters(ctx.expenses, input, ctx.anomalies);
  const grouped = groupBy(matches, keyFns[input.groupBy]);

  const sortBy = input.sortBy ?? 'total';
  const direction = (input.order ?? 'desc') === 'desc' ? -1 : 1;

  const groups = Object.entries(grouped)
    .map(([key, items]) => ({
      key,
      total: round2(sum(items.map((e) => e.amount))),
      count: items.length,
    }))
    .sort((a, b) =>
      sortBy === 'key'
        ? direction * a.key.localeCompare(b.key)
        : direction * (a[sortBy] - b[sortBy])
    );

  return {
    groupBy: input.groupBy,
    groups: input.limit ? groups.slice(0, input.limit) : groups,
    grandTotal: round2(sum(matches.map((e) => e.amount))),
    appliedFilters: pickFilters(input),
  };
};
