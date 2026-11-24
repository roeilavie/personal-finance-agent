import { ToolContext } from './filters';
import { filterExpenses, filterExpensesTool } from './filterExpenses';
import { calculateStatistics, calculateStatisticsTool } from './statistics';
import { aggregateExpenses, aggregateExpensesTool } from './aggregation';

export type { ToolContext } from './filters';
export { buildAnomalySet } from './filters';

// Pass this to generateText({ tools }). No `execute`: the agent runs the calls.
export const tools = {
  filter_expenses: filterExpensesTool,
  calculate_statistics: calculateStatisticsTool,
  aggregate_expenses: aggregateExpensesTool,
};

export const executeTool = (
  name: string,
  input: unknown,
  ctx: ToolContext
): unknown => {
  switch (name) {
    case 'filter_expenses':
      return filterExpenses(input as Parameters<typeof filterExpenses>[0], ctx);
    case 'calculate_statistics':
      return calculateStatistics(
        input as Parameters<typeof calculateStatistics>[0],
        ctx
      );
    case 'aggregate_expenses':
      return aggregateExpenses(
        input as Parameters<typeof aggregateExpenses>[0],
        ctx
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
};
