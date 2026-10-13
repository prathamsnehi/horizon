import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEvaluation } from "../../evaluation/runner";
import { Checkpoint } from "../../evaluation/core";

jest.mock("../../llm/client", () => ({
  createLunaModel: jest.fn(() => ({ modelId: "openai/gpt-6-luna" })),
  LUNA_MODEL: "openai/gpt-6-luna", providerOptions: () => ({ tokenrouter: { reasoningEffort: "none", strictJsonSchema: true } }),
  COMPLETION_TOKEN_CAP: 4096, ATTEMPT_TIMEOUT_MS: 20_000,
}));
jest.mock("ai", () => ({
  Output: { object: jest.fn() },
  generateText: jest.fn(async ({ prompt }: { prompt: string }) => ({ output: { quests: [{ title: "Fixture focus",
    questDescription: "Spend 25 minutes writing at Fixture Café.", locationDescription: "A café at Fixture Address.",
    difficulty: "easy", estimatedActivityMinutes: 25, categories: ["coffee"], assignedLocationId: "loc_0",
    recommendedTransportationMode: prompt.includes('"publicTransport"') ? "publicTransport" : "walking",
    pushesComfortZoneEdges: [prompt.includes("Spending focused") ? "Spending focused time alone in a new public place" : "Trying unfamiliar activities alone"] }] } })),
}));

// A local fixture executable speaks the native JSON-lines protocol. It invokes
// no MapKit/model services. CLI and HTTP fixtures reject every non-eval action.
const nativeFixture = `#!${process.execPath}
const readline = require('node:readline');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line); let value;
 if(request.operation==='availability') value={available:true,availability:'available',model:'fixture',os:'fixture OS'};
 else if(request.operation==='probe') value={ready:true};
 else if(request.operation==='search') value=[{id:'fixture-place',name:'Fixture Café',address:'Fixture Address',latitude:44.98,longitude:-93.26,website:'https://example.org/',sourceURL:'https://maps.apple.com/'}];
 else if(request.operation==='write') value={quests:[{title:'Fixture focus',questDescription:'Spend 25 minutes writing at Fixture Café.',locationDescription:'A café at Fixture Address.',difficulty:'easy',estimatedActivityMinutes:25,categories:['coffee'],assignedLocationId:'loc_0',recommendedTransportationMode:request.prompt.includes('"publicTransport"')?'publicTransport':'walking',pushesComfortZoneEdges:[request.prompt.includes('Spending focused')?'Spending focused time alone in a new public place':'Trying unfamiliar activities alone']}]};
 else process.exit(42);
 console.log(JSON.stringify({ok:true,value}));
});
`;
const cliFixture = `#!${process.execPath}
if(process.argv[2]!=='functions:secrets:access') process.exit(42);
require('./node_modules/firebase-tools/lib/bin/cli.js').cli();
`;

test("complete isolated suite, bounded resume, and failed preflight use only mocked providers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-runner-test-"));
  const originalPath = process.env.PATH;
  const output = join(directory, "results"), binary = join(directory, "native");
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const http = jest.spyOn(globalThis, "fetch").mockImplementation(async url => {
    if (String(url) === "https://api.tokenrouter.com/v1/models") return new Response(JSON.stringify({ data: [{ id: "openai/gpt-6-luna", version: "fixture-version" }] }));
    if (String(url) === "https://places.googleapis.com/v1/places:searchText") return new Response(JSON.stringify({ places: [{ id: "fixture-place", displayName: { text: "Fixture Café" }, formattedAddress: "Fixture Address",
      location: { latitude: 44.98, longitude: -93.26 }, websiteUri: "https://example.org/", googleMapsUri: "https://maps.google.com/" }] }));
    throw new Error("Prohibited endpoint in isolated runner");
  });
  try {
    await writeFile(binary, nativeFixture, { mode: 0o700 });
    const loggerDirectory = join(directory, "node_modules/firebase-tools/lib");
    await mkdir(join(loggerDirectory, "bin"), { recursive: true });
    await writeFile(join(loggerDirectory, "logger.js"), "module.exports={useFileLogger:()=>{throw new Error('File logging must be disabled');},findAvailableLogFile:()=>{}};");
    const cliModule = join(loggerDirectory, "bin/cli.js");
    await writeFile(cliModule, "const logger=require('../logger'); exports.cli=()=>{if(logger.useFileLogger()!==undefined) process.exit(42); console.log('fixture-evaluation-key');};");
    await writeFile(join(directory, "firebase"), cliFixture, { mode: 0o700 });
    process.env.PATH = `${directory}:${originalPath}`;
    const args = ["run", "--native", binary, "--out", output];
    await runEvaluation([...args, "--phase", "tuning", "--limit", "1"], 0);
    const first = JSON.parse(await readFile(join(output, "checkpoint.json"), "utf8")) as Checkpoint;
    expect(first.frozen).toBe(false); expect(first.results.filter(r => r.stage === "writer")).toHaveLength(6);
    await expect(runEvaluation([...args, "--phase", "heldout"], 0)).rejects.toThrow("Finish all ten tuning");
    await runEvaluation([...args, "--phase", "all"], 0);
    const complete = JSON.parse(await readFile(join(output, "checkpoint.json"), "utf8")) as Checkpoint;
    expect(complete.frozen).toBe(true);
    expect(complete.results.filter(r => r.stage === "search")).toHaveLength(60);
    expect(complete.results.filter(r => r.stage === "writer")).toHaveLength(180);
    expect(complete.results.filter(r => r.stage === "pipeline")).toHaveLength(40);
    expect(complete.results.filter(r => r.stage !== "preflight").every(r => r.ok)).toBe(true);
    expect(complete.calls["cloud.write"]).toBe(110); expect(complete.calls["apple.write"]).toBe(110);
    expect(complete.calls["google.search"]).toBe(30); expect(complete.calls["apple.search"]).toBe(30);
    const blind = JSON.parse(await readFile(join(output, "blind-review.json"), "utf8"));
    expect(blind).toHaveLength(220); expect(blind.some((r: any) => r.provider || r.model)).toBe(false);
    const serialized = JSON.stringify(complete);
    expect(serialized).not.toMatch(/fixture-evaluation-key|Fixture Café|Fixture Address|"latitude"|"longitude"/);
    await runEvaluation(args, 0);
    const resumed = JSON.parse(await readFile(join(output, "checkpoint.json"), "utf8")) as Checkpoint;
    expect(resumed.calls["cloud.write"]).toBe(110); expect(resumed.calls["google.search"]).toBe(30);
    http.mockImplementation(async () => new Response("{}", { status: 403 }));
    const failedOutput = join(directory, "failed");
    await expect(runEvaluation(["run", "--native", binary, "--out", failedOutput])).rejects.toThrow("preflight blocked");
    const failed = JSON.parse(await readFile(join(failedOutput, "checkpoint.json"), "utf8")) as Checkpoint;
    expect(failed.calls["cloud.write"]).toBeUndefined();
    expect(failed.calls["apple.preflight.write"]).toBe(1);
    expect(failed.results.filter(r => r.stage === "preflight" && !r.ok)).toHaveLength(2);
    expect(await readFile(join(failedOutput, "blocker.txt"), "utf8")).not.toContain("fixture-evaluation-key");
    // A changed/unsupported CLI must fail before executing the secret action.
    await writeFile(cliModule, "exports.cli=()=>console.log('fixture-evaluation-key');");
    const incompatibleOutput = join(directory, "incompatible-cli");
    await expect(runEvaluation(["run", "--native", binary, "--out", incompatibleOutput])).rejects.toThrow("file logging disabled");
    const incompatible = JSON.parse(await readFile(join(incompatibleOutput, "checkpoint.json"), "utf8")) as Checkpoint;
    expect(incompatible.calls).toEqual({});
    await runEvaluation(["purge", "--out", output]);
    await runEvaluation(["purge", "--out", failedOutput]);
    await runEvaluation(["purge", "--out", incompatibleOutput]);
  } finally {
    process.env.PATH = originalPath; http.mockRestore(); log.mockRestore();
    await rm(directory, { recursive: true });
  }
}, 30_000);
