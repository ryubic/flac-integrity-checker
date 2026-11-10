import { styleText } from "node:util";

// Fonts. One entry per character: [top, middle, bottom].
// Glyphs may differ in width; each one is padded to its own widest row.
const SINGLE_FONT = {
  a: ["┌─┐", "├─┤", "┴ ┴"],
  b: ["┌┐ ", "├┴┐", "└─┘"],
  c: ["┌─┐", "│  ", "└─┘"],
  d: ["┌┬┐", " ││", "─┴┘"],
  e: ["┌─┐", "├┤ ", "└─┘"],
  f: ["┌─┐", "├┤ ", "└  "],
  g: ["┌─┐", "│ ┬", "└─┘"],
  h: ["┬ ┬", "├─┤", "┴ ┴"],
  i: ["┬", "│", "┴"],
  j: [" ┬", " │", "└┘"],
  k: ["┬┌─", "├┴┐", "┴ ┴"],
  l: ["┬  ", "│  ", "┴─┘"],
  m: ["┌┬┐", "│││", "┴ ┴"],
  n: ["┌┐┌", "│││", "┘└┘"],
  o: ["┌─┐", "│ │", "└─┘"],
  p: ["┌─┐", "├─┘", "┴  "],
  q: ["┌─┐ ", "│─┼┐", "└─┘└"],
  r: ["┬─┐", "├┬┘", "┴└─"],
  s: ["┌─┐", "└─┐", "└─┘"],
  t: ["┌┬┐", " │ ", " ┴ "],
  u: ["┬ ┬", "│ │", "└─┘"],
  v: ["┬  ┬", "└┐┌┘", " └┘ "],
  w: ["┬ ┬", "│││", "└┴┘"],
  x: ["─┐ ┬", "┌┴┬┘", "┴ └─"],
  y: ["┬ ┬", "└┬┘", " ┴ "],
  z: ["┌─┐", "┌─┘", "└─┘"],
  0: ["┌─┐", "│ │", "└─┘"],
  1: ["┌┐ ", " │ ", "─┴─"],
  2: ["┌─┐", "┌─┘", "└──"],
  3: ["┌─┐", " ─┤", "└─┘"],
  4: ["┬ ┬", "└─┤", "  ┴"],
  5: ["┌─ ", "└─┐", "└─┘"],
  6: ["┌─ ", "├─┐", "└─┘"],
  7: ["┌─┐", "  │", "  ┴"],
  8: ["┌─┐", "├─┤", "└─┘"],
  9: ["┌─┐", "└─┤", "└─┘"],
  " ": ["   ", "   ", "   "],
  "-": ["   ", "───", "   "],
  _: ["   ", "   ", "───"],
  ".": [" ", " ", "."],
  "!": ["│", "│", "."],
  "?": ["┌─┐", " ┌┘", " . "],
};

const DOUBLE_FONT = {
  a: ["╔═╗", "╠═╣", "╩ ╩"],
  b: ["╔╗ ", "╠╩╗", "╚═╝"],
  c: ["╔═╗", "║  ", "╚═╝"],
  d: ["╔╦╗", " ║║", "═╩╝"],
  e: ["╔═╗", "║╣ ", "╚═╝"],
  f: ["╔═╗", "╠╣ ", "╚  "],
  g: ["╔═╗", "║ ╦", "╚═╝"],
  h: ["╦ ╦", "╠═╣", "╩ ╩"],
  i: ["╦", "║", "╩"],
  j: [" ╦", " ║", "╚╝"],
  k: ["╦╔═", "╠╩╗", "╩ ╩"],
  l: ["╦  ", "║  ", "╩═╝"],
  m: ["╔╦╗", "║║║", "╩ ╩"],
  n: ["╔╗╔", "║║║", "╝╚╝"],
  o: ["╔═╗", "║ ║", "╚═╝"],
  p: ["╔═╗", "╠═╝", "╩  "],
  q: ["╔═╗ ", "║═╬╗", "╚═╝╚"],
  r: ["╦═╗", "╠╦╝", "╩╚═"],
  s: ["╔═╗", "╚═╗", "╚═╝"],
  t: ["╔╦╗", " ║ ", " ╩ "],
  u: ["╦ ╦", "║ ║", "╚═╝"],
  v: ["╦  ╦", "╚╗╔╝", " ╚╝ "],
  w: ["╦ ╦", "║║║", "╚╩╝"],
  x: ["═╗ ╦", "╔╩╦╝", "╩ ╚═"],
  y: ["╦ ╦", "╚╦╝", " ╩ "],
  z: ["╔═╗", "╔═╝", "╚═╝"],
  0: ["╔═╗", "║ ║", "╚═╝"],
  1: ["╔╗ ", " ║ ", "═╩═"],
  2: ["╔═╗", "╔═╝", "╚══"],
  3: ["╔═╗", " ═╣", "╚═╝"],
  4: ["╦ ╦", "╚═╣", "  ╩"],
  5: ["╔═ ", "╚═╗", "╚═╝"],
  6: ["╔═ ", "╠═╗", "╚═╝"],
  7: ["╔═╗", "  ║", "  ╩"],
  8: ["╔═╗", "╠═╣", "╚═╝"],
  9: ["╔═╗", "╚═╣", "╚═╝"],
  " ": ["   ", "   ", "   "],
  "-": ["   ", "═══", "   "],
  _: ["   ", "   ", "═══"],
  ".": [" ", " ", "."],
  "!": ["║", "║", "."],
  "?": ["╔═╗", " ╔╝", " . "],
};

// To add a font: define another object like the ones above and register it here.
// Every font needs a " " entry, which is used for characters it doesn't have.
const FONTS = { single: SINGLE_FONT, double: DOUBLE_FONT };

// Returns the text as a multi-line string. The fonts have a single case, so
// input is lowercased; unsupported characters become blank gaps.
export function renderBanner(text, font = "single") {
  const glyphs = FONTS[font];
  if (!glyphs)
    throw new Error(
      `Unknown font "${font}". Available: ${Object.keys(FONTS).join(", ")}`,
    );

  const blank = glyphs[" "];
  const rows = blank.map(() => ""); // row count comes from the font

  for (const ch of text.toLowerCase()) {
    const glyph = glyphs[ch] ?? blank;
    const width = Math.max(...glyph.map((row) => row.length));
    glyph.forEach((row, i) => (rows[i] += row.padEnd(width)));
  }

  return rows.map((row) => row.trimEnd()).join("\n");
}

// Prints the banner, e.g. printBanner("Hello World", color: "magenta", font: "double")
export function printBanner(text, color, font) {
  const COLORS = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "gray",
    "redBright",
    "greenBright",
    "yellowBright",
    "blueBright",
    "magentaBright",
    "cyanBright",
    "whiteBright",
  ];
  if (color && !COLORS.includes(color))
    throw new Error(`Invalid color "${color}". Allowed: ${COLORS.join(", ")}`);

  const art = renderBanner(text, font);
  console.log(color ? styleText(color, art) : art);
}
