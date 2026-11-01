// Check the citations in an uploaded file, with polling, and read the verdicts.
//
//   pnpm --filter @klaracase/sdk run build
//   node packages/sdk/examples/citation-check.mjs
//   KLARACASE_API_TOKEN=... node packages/sdk/examples/citation-check.mjs --live   (2 to 4 credits)
import { assertComplete, groupByVerdict, Klaracase, KlaracaseError } from "@klaracase/sdk";
import { connect } from "./mock-api.mjs";

const draft = new File(
  ["Der BGH hat im Urteil vom 15.11.2001 (1 StR 185/01) entschieden. Siehe § 266a Abs. 9 StGB."],
  "schriftsatz.txt",
  { type: "text/plain" },
);

const { client, stop } = await connect(Klaracase);
try {
  // Step by step: upload (free), poll until the file is read, then check.
  const receipt = await client.citationCheckDocuments.upload(draft);
  console.log("uploaded:", receipt.id, receipt.status);
  const ready = await client.citationCheckDocuments.waitUntilReady(receipt.id, {
    pollInterval: 0.1,
    timeout: 30,
  });
  console.log("ready:", ready.status, `(${ready.char_count} characters)`);
  const run = await client.citationChecks.create({ document_id: ready.id });

  // The same in one call: const run = await client.citationChecks.createFromFile(draft, { wait: { interval: 3 } });

  assertComplete(run); // throws CitationCheckIncompleteError unless status is "complete"
  if (run.partial) console.warn("The run is partial. Read the notes before you trust it.");
  for (const [verdict, findings] of Object.entries(groupByVerdict(run))) {
    if (findings.length === 0) continue;
    console.log(`${verdict}: ${findings.length}`);
    for (const finding of findings) console.log(`  ${finding.raw_text}`);
  }
  console.log("not_found means not found in the corpus. It does not mean invented.");
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
