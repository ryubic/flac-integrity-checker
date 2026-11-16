#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { spawn, spawnSync } from "node:child_process";

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

async function main() {
  const banner = `┌─┐┬  ┌─┐┌─┐   ┬┌┐┌┌┬┐┌─┐┌─┐┬─┐┬┌┬┐┬ ┬   ┌─┐┬ ┬┌─┐┌─┐┬┌─┌─┐┬─┐
├┤ │  ├─┤│  ───││││ │ ├┤ │ ┬├┬┘│ │ └┬┘───│  ├─┤├┤ │  ├┴┐├┤ ├┬┘
└  ┴─┘┴ ┴└─┘   ┴┘└┘ ┴ └─┘└─┘┴└─┴ ┴  ┴    └─┘┴ ┴└─┘└─┘┴ ┴└─┘┴└─
`;
  console.log(styleText("magenta", banner));

  // check if flac is available
  const checkFlac = spawnSync("flac", ["--version"]);

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
    .filter((entry) => entry.isFile())
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
    extLog += `    ${ext !== "" ? ext : " no ext"}: ${filesByExtension[ext].length}\n`;
  }

  const maxThreads = Math.max(1, Math.floor(os.availableParallelism() * 0.7));

  console.log(`Max concurrency  : ${maxThreads}`);
  console.log(`Files found      : ${totalFiles}`);
  console.log(extLog);

  // start testing
  const results = await testAll(filesByExtension[".flac"], maxThreads);

  return { flacCount: filesByExtension[".flac"].length, ...results };
}

main()
  .then(({ flacCount, passed, failed, noMd5 }) => {
    const color =
      failed.length > 0 ? "red" : noMd5.length > 0 ? "yellow" : "green";

    console.log(
      styleText(
        color,
        `\nCompleted in ${((performance.now() - timer) / 1000).toFixed(2)}s! Checked: ${flacCount} | Passed: ${passed.length} | Failed: ${failed.length} | No MD5: ${noMd5.length}`,
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
