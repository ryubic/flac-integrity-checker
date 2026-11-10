# flac-integrity-checker (fic.js)

A Node.js script that scans directories, categorizes files, verifies the integrity of FLAC audio files using the official flac binary, and provides detailed reports.

## Features

- **Parallel Verification** — Uses ~70% of CPU threads for fast processing.
- **Checksum Validation** — Verifies embedded MD5 checksums.
- **Cross-Platform** — Works on Windows, macOS, and Linux.
- **Progress Tracking** — Simple ASCII progress bar.
- **File Summary** — Displays counts of files and their types.
- **Read-Only** — Files are never modified.

## Requirements

- **Node.js**
- **flac**

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ryubic/flac-integrity-checker
   cd flac-integrity-checker
   ```

2. **Ensure `flac` is available**:
   ```bash
   flac -v
   ```

## Usage

Run the script directly using Node.js:

```bash
node fic.js /path/to/music/folder
```

## Output

- **Passed** — File is valid and MD5 matches
- **No MD5** — Missing or zeroed-out MD5 field
- **Failed** — File is corrupt or unreadable

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
