# flac-integrity-checker (fic.js)

A Node.js script that scans a directory, summarizes the files it finds by extension, verifies the integrity of FLAC audio files using the official `flac` binary, and prints a detailed report.

## Features

- **Parallel Verification** — Runs up to ~70% of available CPU threads at once (respects container/CPU limits).
- **Checksum Validation** — Verifies embedded MD5 checksums.
- **Cross-Platform** — Works on Windows, macOS, and Linux.
- **Progress Tracking** — Simple ASCII progress bar.
- **File Summary** — Displays counts of files by extension.
- **Detailed Failure Reports** — Prints the error output from `flac` for every file that fails.
- **Script-Friendly** — Exits with a non-zero code when any file fails verification.
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
node fic.js /path/to/music/folder
```

The folder is scanned recursively. Only regular files are considered, so symbolic links are skipped.

## Output

Each `.flac` file ends up in one of three categories:

- **Passed** — File is valid and the MD5 matches
- **No MD5** — The file decodes, but its MD5 field is missing or zeroed out, so the checksum could not be verified
- **Failed** — File is corrupt or unreadable. The error reported by `flac` is printed below the file path

A one-line summary is printed at the end. It is red if any file failed, yellow if files only lack an MD5, and green otherwise. Files without an MD5 and failed files are then listed in full.

### Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | Completed with no failed files (files without MD5 do not affect the code)   |
| `1`  | At least one file failed verification, or the script could not run          |

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
