#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { printBanner } from "./utils/unicode-banner.js";

const timer = performance.now();

function renderProgress(done, total) {
  const width = 80; // bar width in chars
  const ratio = done / total;
  const filled = Math.floor(width * ratio);
  const bar = "#".repeat(filled) + " ".repeat(width - filled);
  process.stdout.write(
    `\r[${bar}] ${done}/${total} (${Math.round(ratio * 100)}%)`,
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
          const child = spawn("flac", ["-s", "-t", file]);
          let stderr = "";

          child.stderr.on("data", (chunk) => (stderr += chunk));
          child.on("error", (err) => resolve({ error: err.message })); // flac missing / can't start
          child.on("close", (code) => {
            if (code !== 0) {
              const idx = stderr.search(/^ERROR:/m);
              const reason =
                idx === -1 ? stderr.trim() : stderr.slice(idx).trim();
              resolve({ error: reason || `flac exited with code ${code}` });
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

async function main() {
  printBanner("flac-integrity-checker", "magenta");
  console.log();

  // check if flac is available
  const checkFlac = spawnSync("flac", ["-v"]);

  if (checkFlac.status !== 0 || checkFlac.error?.code === "ENOENT")
    throw new Error(
      `Could not run flac. Make sure it is present in your path. Please install it first from https://xiph.org/flac/download.html`,
      { cause: checkFlac.error },
    );

  const args = process.argv.slice(2);

  if (args.length !== 1)
    throw new Error("Please enter the directory path where your flacs are");

  const sourceDir = path.resolve(args[0]);

  // check if provided source directory is valid
  let sourceDirStat;
  try {
    sourceDirStat = fs.statSync(sourceDir);
  } catch (error) {
    throw new Error("Provided path is invalid", { cause: error });
  }

  if (!sourceDirStat.isDirectory())
    throw new Error("Provided path does not point to a directory");

  console.log(`Source Directory : ${sourceDir}`);

  // scan source directory for files
  const files = fs
    .readdirSync(sourceDir, {
      withFileTypes: true,
      recursive: true,
    })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => path.join(entry.parentPath, entry.name));

  const filesByExtension = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    if (!filesByExtension[ext]) filesByExtension[ext] = [];
    filesByExtension[ext].push(file);
  }

  if (!filesByExtension[".flac"] || filesByExtension[".flac"].length === 0)
    throw new Error("Directory does not contain any flac to test");

  let totalFiles = 0;
  let extLog = "";

  for (const ext in filesByExtension) {
    totalFiles += filesByExtension[ext].length;
    extLog += `    ${ext !== "" ? ext : " no ext"}: ${filesByExtension[ext].length}`;
  }

  console.log(`Files found      : ${totalFiles}`);
  console.log(extLog);

  // start testing
  const maxThreads = Math.max(1, Math.floor(os.cpus().length * 0.7));

  console.log(
    `\nVerifying ${filesByExtension[".flac"].length} flacs using ${maxThreads} threads`,
  );

  const results = await testAll(filesByExtension[".flac"], maxThreads);

  return { filesVerified: filesByExtension[".flac"].length, ...results };
}

main()
  .then((results) => {
    const totalSeconds = (performance.now() - timer) / 1000;
    console.log(
      styleText("reset", `\n\nCompleted in ${totalSeconds.toFixed(2)}s!`),
    );
    console.log(styleText("green", `Checked : ${results.filesVerified}`));
    console.log(styleText("green", `Passed  : ${results.passed.length}`));
    console.log(styleText("red", `Failed  : ${results.failed.length}`));
    console.log(styleText("yellow", `No MD5  : ${results.noMd5.length}`));

    if (results.noMd5.length > 0) {
      console.log(
        styleText("yellow", "\n--- Flacs without MD5 set in STREAMINFO ---"),
      );

      results.noMd5.forEach((f, i) => {
        console.log(styleText("yellow", `[${i + 1}] ${f}`));
      });
    }

    if (results.failed.length > 0) {
      console.log(styleText("red", "\n--- Flacs that failed verification ---"));

      results.failed.forEach((f, i) => {
        console.log(styleText("red", `\n[${i + 1}] ${f.path}`));
        console.log(f.error);

        if (f.path.length > 252)
          console.log(
            `${styleText("yellow", "[!]")} The path length of this file is greater than 252, which can make the test fail on Windows, even if the file is fine`,
          );
      });
    }
  })
  .catch((err) => {
    console.error(err.message);
    if (err.cause) console.error("Caused by:", err.cause.message ?? err.cause);
    process.exit(1);
  });
