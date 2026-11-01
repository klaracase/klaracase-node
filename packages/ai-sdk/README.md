# @klaracase/ai-sdk

[Vercel AI SDK](https://ai-sdk.dev) tools for the [Klaracase](https://klaracase.de) API. The tools
sit on top of [`@klaracase/sdk`](https://www.npmjs.com/package/@klaracase/sdk).

Klaracase covers German law only. It is a research tool. It gives no legal advice and does not
replace a lawyer's review. A `not_found` verdict means the citation was not found in the corpus; it
is not a claim that the citation is fabricated.

## Install

```sh
npm install @klaracase/ai-sdk @klaracase/sdk ai zod
```

`ai` must be version 5 or newer. Create an API token at
<https://klaracase.de/settings/api-tokens> and set `KLARACASE_API_TOKEN`.

## Use

```ts
import { generateText } from "ai";
import { Klaracase } from "@klaracase/sdk";
import { klaracaseTools } from "@klaracase/ai-sdk";

const client = new Klaracase(); // reads KLARACASE_API_TOKEN

const { text } = await generateText({
  model: yourModel,
  tools: klaracaseTools(client),
  prompt: "Check the citations in this draft: ...",
});
```

Pick a subset with the `tools` option:

```ts
klaracaseTools(client, { tools: ["searchDecisions", "getNorm"] });
```

## Tools

| Tool              | API call                          | Credits                       |
| ----------------- | --------------------------------- | ----------------------------- |
| `searchDecisions` | `GET /decisions/search`           | 1                             |
| `getDecision`     | `GET /decisions/{id}`             | 1                             |
| `getNorm`         | `GET /norms/{reference}`          | 1                             |
| `checkCitations`  | `POST /citation-checks` with text | 2 to 4, by length of the text |

The input schemas use the parameter names of the REST API. They are exported too:
`searchDecisionsInput`, `getDecisionInput`, `getNormInput` and `checkCitationsInput`.

A tool returns the parsed API body. If a call fails, the tool throws a `KlaracaseError` and the AI
SDK reports it to the model as a tool error. Tell the model to cite only what a tool returned.

For an agent with an MCP client, you can connect to `https://klaracase.de/mcp` instead.

License: MIT, Copyright (c) 2026 SPARQ VENTURES UG
