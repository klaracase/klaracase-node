// Quick start: search decisions, read one, read a norm.
//
//   pnpm --filter @klaracase/sdk run build
//   node packages/sdk/examples/quickstart.mjs           (offline, against the mock)
//   KLARACASE_API_TOKEN=... node packages/sdk/examples/quickstart.mjs --live   (costs credits)
import { Klaracase, KlaracaseError } from "@klaracase/sdk";
import { connect } from "./mock-api.mjs";

const { client, stop } = await connect(Klaracase);
try {
  const found = await client.decisions.search("Untreue Vermögensbetreuungspflicht", {
    court: "BGH",
    limit: 3,
  });
  console.log(`${found.results.length} results, cost ${found.credits.cost} credits`);
  for (const result of found.results) {
    console.log(`- ${result.aktenzeichen} (${result.court}, ${result.date})`);
  }

  const first = found.results[0];
  if (first !== undefined) {
    const decision = await client.decisions.get(first.id, { max_chars: 1000 });
    console.log("decision:", decision.aktenzeichen ?? first.aktenzeichen);
  }

  const norm = await client.norms.get("§ 535 BGB");
  console.log("norm:", norm.reference, "-", norm.norm.title);
  console.log(
    "API release:",
    norm.meta.api_release,
    "took",
    norm.meta.request_duration.toFixed(3),
    "s",
  );
} catch (error) {
  if (KlaracaseError.is(error)) {
    console.error(`API error ${error.code}: ${error.detail}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await stop();
}
