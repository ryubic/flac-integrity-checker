#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, styleText } from "node:util";
import { spawn, spawnSync } from "node:child_process";

const timer = performance.now();

function renderProgress(done, total) {
  if (!process.stdout.isTTY) return;

  const label = ` ${done}/${total} (${Math.round((done / total) * 100)}%)`;
  const width = Math.max(10, (process.stdout.columns ?? 80) - label.length - 3);
  const filled = Math.floor(width * (done / total));

  process.stdout.write(
    `\r[${"#".repeat(filled)}${" ".repeat(width - filled)}]${label}`,
  );
}

async function testAll(files, concurrency) {
  const results = { passed: [], noMd5: [], failed: [] };
  const queue = files.values(); // shared iterator: workers never take the same file
  let completed = 0;

  renderProgress(0, files.length);

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      for (const file of queue) {
        const outcome = await new Promise((resolve) => {
          const child = spawn("flac", ["--silent", "--test", "--", file], {
            stdio: ["ignore", "ignore", "pipe"],
          });

          let stderr = "";

          child.stderr.setEncoding("utf8"); // chunks are now strings, and multi-byte chars are never split
          child.stderr.on("data", (chunk) => (stderr += chunk));

          child.on("error", (err) => resolve({ error: err.message })); // flac missing / can't start

          child.on("close", (code, signal) => {
            if (code !== 0) {
              const exit = signal
                ? `terminated by ${signal}`
                : `exited with code ${code}`;
              resolve({ error: stderr.trim() || `flac ${exit}` });
            } else if (stderr.includes("WARNING, cannot check MD5 signature")) {
              resolve({ noMd5: true });
            } else {
              resolve({});
            }
          });
        });

        if (outcome.error !== undefined)
          results.failed.push({ path: file, error: outcome.error });
        else if (outcome.noMd5) results.noMd5.push(file);
        else results.passed.push(file);

        renderProgress(++completed, files.length);
      }
    }),
  );

  return results;
}

function scanDir(dir, files = [], skipped = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    skipped.push({ path: dir, error: err.code });
    return { files, skipped };
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scanDir(full, files, skipped);
    else if (e.isFile()) files.push(full);
  }
  return { files, skipped };
}

async function main() {
  const banner = `
┌─┐┬  ┌─┐┌─┐   ┬┌┐┌┌┬┐┌─┐┌─┐┬─┐┬┌┬┐┬ ┬   ┌─┐┬ ┬┌─┐┌─┐┬┌─┌─┐┬─┐
├┤ │  ├─┤│  ───││││ │ ├┤ │ ┬├┬┘│ │ └┬┘───│  ├─┤├┤ │  ├┴┐├┤ ├┬┘
└  ┴─┘┴ ┴└─┘   ┴┘└┘ ┴ └─┘└─┘┴└─┴ ┴  ┴    └─┘┴ ┴└─┘└─┘┴ ┴└─┘┴└─
`;
  console.log(banner.trimStart());

  // parse args
  const args = parseArgs({
    allowPositionals: true,
    options: {
      "max-concurrency": { type: "string", short: "c" },
    },
  });

  if (args.positionals.length > 1)
    throw new Error("Please enter only options and a single directory path");

  const sourceDir = path.resolve(args.positionals[0] ?? ".");

  let sourceDirStat;
  try {
    sourceDirStat = fs.statSync(sourceDir);
  } catch (error) {
    throw new Error("Provided path is invalid", { cause: error });
  }

  if (!sourceDirStat.isDirectory())
    throw new Error("Provided path does not point to a directory");

  // calculate max concurrency
  let maxConcurrency = Math.max(1, Math.floor(os.availableParallelism() * 0.7));

  const requestedConcurrency = args.values["max-concurrency"];

  if (requestedConcurrency !== undefined) {
    if (
      !/^\d+$/.test(requestedConcurrency) ||
      Number(requestedConcurrency) < 1
    ) {
      throw new Error(
        `Invalid value for --max-concurrency: "${requestedConcurrency}". Expected a positive integer.`,
      );
    }

    maxConcurrency = Math.min(
      Number(requestedConcurrency),
      os.availableParallelism(),
    );
  }

  // check if flac is available
  const checkFlac = spawnSync("flac", ["--version"]);

  if (checkFlac.error) {
    const errorMsg =
      checkFlac.error.code === "ENOENT"
        ? "Cannot run flac: Make sure it is available in your PATH."
        : `Cannot run flac: ${checkFlac.error.message}`;

    throw new Error(errorMsg);
  }

  if (checkFlac.status !== 0)
    throw new Error(
      `flac version check failed with exit code ${checkFlac.status}`,
    );

  // scan source directory for files
  const { files, skipped } = scanDir(sourceDir);

  const filesByExtension = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    if (!filesByExtension[ext]) filesByExtension[ext] = [];
    filesByExtension[ext].push(file);
  }

  if (!filesByExtension[".flac"] || filesByExtension[".flac"].length === 0) {
    const reason =
      skipped.length > 0
        ? `No flac files found, and ${skipped.length} directories could not be read (first: ${skipped[0].path}, ${skipped[0].error})`
        : `Source directory does not contain any flac files: ${sourceDir}`;

    throw new Error(reason);
  }

  let totalFiles = 0;
  let extLog = "";

  for (const ext in filesByExtension) {
    totalFiles += filesByExtension[ext].length;
    extLog += `    ${ext !== "" ? ext : " no ext"}: ${filesByExtension[ext].length}\n`;
  }

  // summary
  console.log(`Source Directory     : ${sourceDir}`);
  console.log(`Max concurrency      : ${maxConcurrency}`);
  console.log(`Files found          : ${totalFiles}`);
  console.log(extLog.trimEnd());
  if (skipped.length > 0) {
    console.log(`Directories skipped  : ${skipped.length}\n`);
    skipped.forEach((s, i) =>
      console.log(`    ${i + 1}. ${s.path} (${s.error})`),
    );
  }
  console.log();

  // start testing
  const results = await testAll(filesByExtension[".flac"], maxConcurrency);

  return {
    skippedDirectories: skipped,
    totalFlacs: filesByExtension[".flac"].length,
    ...results,
  };
}

main()
  .then(({ skippedDirectories, totalFlacs, passed, failed, noMd5 }) => {
    if (skippedDirectories.length > 0) process.exitCode = 2;

    const color =
      failed.length > 0
        ? "red"
        : noMd5.length > 0 || skippedDirectories.length > 0
          ? "yellow"
          : "green";

    const skippedPart =
      skippedDirectories.length > 0
        ? `Skipped Directories: ${skippedDirectories.length} | `
        : "";

    console.log(
      styleText(
        color,
        `\nCompleted in ${((performance.now() - timer) / 1000).toFixed(2)}s! ${skippedPart}Checked: ${totalFlacs} | Passed: ${passed.length} | Failed: ${failed.length} | No MD5: ${noMd5.length}`,
      ),
    );

    if (noMd5.length > 0) {
      console.log(
        styleText("yellow", "\n--- Flacs without MD5 set in STREAMINFO ---"),
      );

      noMd5.forEach((f, i) => {
        console.log(styleText("yellow", `[${i + 1}] ${f}`));
      });
    }

    if (failed.length > 0) {
      console.log(styleText("red", "\n--- Flacs that failed verification ---"));

      failed.forEach((f, i) => {
        console.log(styleText("red", `\n[${i + 1}] ${f.path}`));
        console.log(f.error);

        if (f.path.length > 252)
          console.log(
            `${styleText("yellow", "[!]")} The path length of this file is greater than 252, which can make the test fail on Windows, even if the file is fine`,
          );
      });

      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error(err.message);
    if (err.cause) console.error("Caused by:", err.cause.message ?? err.cause);
    process.exit(1);
  });
