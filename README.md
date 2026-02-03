# FLAC-Integrity-Checker (fic.js)

A fast, multi-threaded command-line tool that scans directories, categorizes files, and verifies the integrity of FLAC audio using the official flac binary. Provides clear results, progress bars, and detailed reports on passed, failed, missing-MD5, and unreadable files.

## Features 

- **Parallel Verification** — Uses ~70% of CPU threads for fast processing.
- **Checksum Validation** — Verifies embedded MD5 checksums.
- **Cross-Platform** — Works on Windows, macOS, and Linux.
- **Progress Tracking** — Simple ASCII progress bar.
- **File Summary** — Displays counts of files and their types.
- **Read-Only** — Files are never modified.

## Requirements

- **Node.js**
- `flac` — [Download here](https://xiph.org/flac/download.html)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ryubic/FLAC-Integrity-Checker
   cd FLAC-Integrity-Checker
   ```

2. **Ensure `flac` is available**:
   ```bash
   flac -v
   ```

## Usage

Run the script directly using Node.js:

```bash
node fic.js
```

Scan a specific directory:
  ```bash
  node fic.js -d /path/to/music
  ```

### Command-Line Options:

- `-d` — Directory to scan (default: current directory)

## Output

- **Passed verification** — File is valid and MD5 matches
- **Files without MD5** — Missing or zeroed-out MD5 field
- **Failed verification** — File is corrupt or unreadable

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