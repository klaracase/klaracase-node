// Agent tools: hand the definitions to a model, run the calls it makes, keep a credit budget.
// No model is called here. The "model" is a fixed list of tool calls, so the example runs offline.
//
//   pnpm --filter @klaracase/sdk run build
//   node packages/sdk/examples/agent-tools.mjs
import { Klaracase } from "@klaracase/sdk";
import { callTool, tools } from "@klaracase/sdk/tools";
import { connect } from "./mock-api.mjs";

// What you pass to a model API as its tool list.
const definitions = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
}));
console.log("tools:", definitions.map((definition) => definition.name).join(", "));

// Tool calls as a model would produce them.
const calls = [
  { name: "searchDecisions", input: { query: "Untreue", court: "BGH", limit: 3 } },
  { name: "getNorm", input: { reference: "§ 266 StGB" } },
  { name: "searchDecisions", input: {} }, // missing arguments come back as an error object
  { name: "dropTables", input: {} }, // an unknown tool too
];

const { client, stop } = await connect(Klaracase);
try {
  const budget = { credits: 3 };
  for (const call of calls) {
    const result = await callTool(client, call.name, call.input, { maxChars: 2000, budget });
    const outcome = "error" in result ? `error ${result.error.code}` : "ok";
    console.log(`${call.name}: ${outcome}, ${budget.credits} credits left`);
  }
} finally {
  await stop();
}
