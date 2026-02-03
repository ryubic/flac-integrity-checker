import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execSync } from "child_process";
import { log } from "console";

console.time("Time taken");
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[92m",
  red: "\x1b[38;5;202m",
  yellow: "\x1b[38;5;185m",
};

function renderProgress(done, total) {
  const width = 80; // bar width in chars
  const ratio = done / total;
  const filled = Math.floor(width * ratio);
  const bar = "#".repeat(filled) + " ".repeat(width - filled);
  process.stdout.write(
    `\r[${bar}] ${done}/${total} (${Math.round(ratio * 100)}%)`,
  );
}

function main() {
  // ckeck if flac is available in path
  try {
    execSync("flac -v", { stdio: "ignore" });
  } catch (error) {
    log(
      "Flac tools are not present in your path. Please install it first from https://xiph.org/flac/download.html",
    );
    return;
  }

  // extract args to find if user has specified target directory
  const args = process.argv.slice(2);
  let targetDir =
    args.indexOf("-d") === -1 ? process.cwd() : args[args.indexOf("-d") + 1];
  targetDir = targetDir.replace(/^["']+|["']+$/g, ""); // remove trailing slashes in path
  targetDir = path.resolve(targetDir); // get absolute path from relative path

  log("=".repeat(process.stdout.columns || 80));
  log(
    `FLAC INTEGRITY CHECKER - Verify the integrity of your FLAC audio files\n\nTarget directory: ${targetDir}\nSearching for files...`,
  );

  // scan directory recursively for files
  const files = fs.readdirSync(targetDir, {
    withFileTypes: true,
    recursive: true,
  });

  const filelist = {};

  for (const file of files) {
    if (file.isDirectory()) continue;
    const filePath = path.join(file.parentPath, file.name);
    let ext = path.extname(filePath);
    ext = ext.slice(1); // slice to exclude . from file extention (ex: .flac => flac)
    if (!filelist[ext]) filelist[ext] = [];
    filelist[ext].push(filePath);
  }

  if (!filelist.flac || filelist.flac.length === 0) {
    log("This directory does not contain any flac files.");
    log("=".repeat(process.stdout.columns || 80));
    return;
  }

  log(`\nFiles found in the directory: `);
  let totalFiles = 0;
  for (const key in filelist) {
    totalFiles += filelist[key].length;
    log(`   ${key}: ${filelist[key].length}`);
  }
  log("-".repeat(29));
  log(`   Total:  ${totalFiles}\n`);

  const maxThreads = Math.max(1, Math.floor(os.cpus().length * 0.7));
  log(
    `Starting verification of ${filelist.flac.length} FLAC files using ${maxThreads} threads.`,
  );

  let activeThreads = 0;
  let completed = 0;

  const results = {
    passed: [],
    failed: [],
    no_md5: [],
  };

  let flacs = [...filelist.flac]; // shallow copy, not let flacs = filelist.flac as it will be called by reference and will cause error in progress bar due to shifting items from the array
  return new Promise((resolve) => {
    function runNext() {
      if (flacs.length === 0 && activeThreads === 0) {
        return resolve(results); // all done
      }

      while (flacs.length > 0 && activeThreads < maxThreads) {
        const path = flacs.shift();
        activeThreads++;

        const child = spawn("flac", ["-t", path]);
        let stderrData = "";

        child.stderr.on("data", (chunk) => (stderrData += chunk.toString()));

        child.on("close", (code) => {
          if (code !== 0) {
            const error = stderrData.split(/\r?\n/);
            const idx = error.findIndex((line) => line.startsWith("ERROR:"));
            const cleanedError =
              idx === -1 ? stderrData : error.slice(idx).join("\n");
            results.failed.push({
              path,
              error: cleanedError,
            });
          } else if (stderrData.includes("WARNING, cannot check MD5 signature"))
            results.no_md5.push(path);
          else results.passed.push(path);

          completed++;
          renderProgress(completed, filelist.flac.length);

          activeThreads--;
          runNext(); // try starting next job
        });
      }
    }
    renderProgress(completed, filelist.flac.length);
    runNext();
  });
}

main()?.then((results) => {
  log("\n\nVerification complete.");
  console.timeEnd("Time taken");
  log(
    `${colors.green}Total files checked:    ${results.passed.length + results.failed.length + results.no_md5.length}`,
  );
  log(`Passed verification:    ${results.passed.length}${colors.reset}`);

  results.no_md5.length > 0
    ? log(
        `${colors.yellow}Files without MD5:      ${results.no_md5.length}${colors.reset}`,
      )
    : "";

  results.failed.length > 0
    ? log(
        `${colors.red}Failed verification:    ${results.failed.length}${colors.reset}`,
      )
    : "";

  // log paths if files without md5 or files with errors are present
  if (results.no_md5.length > 0) {
    log("-".repeat(process.stdout.columns || 80));
    process.stdout.write(colors.yellow);
    log("Files with unset MD5 in STREAMINFO:\n");
    for (const item in results.no_md5) {
      log(`${Number(item) + 1}. ${results.no_md5[item]}`);
    }
    process.stdout.write(colors.reset);
  }

  if (results.failed.length > 0) {
    log("-".repeat(process.stdout.columns || 80));
    log(`${colors.red}Failed files: ${colors.reset}`);
    for (const item in results.failed) {
      log(
        `\n${colors.red}${Number(item) + 1}. ${results.failed[item].path}${colors.reset}`,
      );
      log(`${results.failed[item].error}`);
      results.failed[item].error.includes(".flac: No such file or directory")
        ? log(
            "This is likely caused by a very long file path exceeding Windows' limits. Try shortening the path.",
          )
        : "";
    }
  }

  log("=".repeat(process.stdout.columns || 80));
});
