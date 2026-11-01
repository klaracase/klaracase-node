// Smoke test against the real API. Free endpoints only: corpus coverage and corpus facets.
// Needs KLARACASE_API_TOKEN and a build (`pnpm build`). Not part of CI.
import { Klaracase } from "../dist/index.js";

if (!process.env.KLARACASE_API_TOKEN) {
  console.error(
    "Set KLARACASE_API_TOKEN first. Create a token at https://klaracase.de/settings/api-tokens",
  );
  process.exit(1);
}

const client = new Klaracase();

const coverage = await client.corpus.coverage({ top: 3 });
console.log(
  "coverage:",
  coverage.total_decisions,
  "decisions;",
  coverage.courts.length,
  "courts shown",
);
console.log("api release:", coverage.meta.api_release, "cost:", coverage.credits.cost);

const facets = await client.corpus.facets("court_name", { prefix: "BGH" });
console.log(
  "facets:",
  Object.keys(facets.values).length,
  "values for court_name starting with BGH",
);
