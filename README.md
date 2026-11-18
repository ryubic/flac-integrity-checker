# flac-integrity-checker (fic.js)

A Node.js script that scans a directory, summarizes the files it finds by extension, verifies the integrity of FLAC audio files using the official `flac` binary, and prints a detailed report.

## Features

- **Parallel Verification** — Runs up to ~70% of available CPU threads at once by default (respects container/CPU limits). Adjustable with `--max-concurrency`.
- **Checksum Validation** — Verifies embedded MD5 checksums.
- **Cross-Platform** — Works on Windows, macOS, and Linux.
- **Progress Tracking** — Simple ASCII progress bar that fits your terminal width and is disabled when output is piped or redirected.
- **File Summary** — Displays counts of files by extension.
- **Detailed Failure Reports** — Prints the error output from `flac` for every file that fails.
- **Resilient Scanning** — Directories that can't be read are skipped and reported instead of aborting the run.
- **Script-Friendly** — Uses distinct exit codes for failed files and incomplete scans.
- **Read-Only** — Files are never modified.

## Requirements

- **Node.js** 20.12 or newer
- **flac** (the official command-line binary, available in your `PATH`)

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ryubic/flac-integrity-checker
   cd flac-integrity-checker
   ```

2. **Ensure `flac` is available**:

   ```bash
   flac --version
   ```

## Usage

Run the script directly using Node.js:

```bash
node fic.js [options] [directory]
```

If no directory is given, the current directory is scanned. The folder is scanned recursively.

### Options

| Option                  | Short | Description                                                                                                     |
| ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `--max-concurrency <n>` | `-c`  | Maximum number of `flac` processes to run at once. Must be a positive integer. Defaults to ~70% of CPU threads. |

Values above the number of available CPU threads are clamped to it. On spinning disks or network shares, a lower value is often faster.

### Examples

```bash
# Check a music library
node fic.js /path/to/music/folder

# Check the current directory with at most 2 parallel checks
node fic.js -c 2
```

## Output

Each `.flac` file ends up in one of three categories:

- **Passed** — File is valid and the MD5 matches
- **No MD5** — The file decodes, but its MD5 field is missing or zeroed out, so the checksum could not be verified
- **Failed** — File is corrupt or unreadable. The error reported by `flac` is printed below the file path

If any directories could not be read (for example, due to permissions), they are listed before the checks start and counted in the final summary.

A one-line summary is printed at the end. It is red if any file failed, yellow if files only lack an MD5 or directories were skipped, and green otherwise. Files without an MD5 and failed files are then listed in full.

### Exit codes

| Code | Meaning                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------- |
| `0`  | Completed with no failed files and no skipped directories (files without MD5 do not affect the code) |
| `1`  | At least one file failed verification, or the script could not run                                   |
| `2`  | No file failed, but one or more directories could not be read, so the scan was incomplete            |

If a file fails verification and a directory was skipped, the exit code is `1`.

## Known limitations

- **Symbolic links are not followed.** Only regular files and directories are considered, so symlinked files and symlinked folders are skipped silently and are not included in the skipped directories count.
- **macOS resource-fork files** (`._*.flac`), created on non-native filesystems such as exFAT drives and network shares, are not real FLAC files and will be reported as failed.
- **Ctrl-C** stops the run immediately and does not print partial results.
- **Long paths on Windows** can make `flac` fail even when the file is fine (see below).

## Troubleshooting

**Missing `flac`?**

### Windows:

1. Download from [xiph.org](https://xiph.org/flac/download.html)
2. Add to your system PATH

### macOS:

```bash
brew install flac
```

### Linux:

```bash
sudo apt install flac      # Debian/Ubuntu
sudo pacman -S flac        # Arch
sudo dnf install flac      # Fedora
```

**Files failing on Windows even though they play fine?**

Paths longer than about 260 characters can make `flac` fail to open a file on Windows. The report flags failed files whose path is over 252 characters. Move the files to a shorter path and run the check again.

**`No flac files found, and N directories could not be read`?**

The directory exists, but you don't have permission to read it or its subfolders. Check the permissions and run the check again.

**Failures on files named `._something.flac`?**

These are macOS resource-fork files, not audio. Delete them or ignore those entries.
