import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";

const projectRoot = new URL("../", import.meta.url);
const checkedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".yaml",
  ".yml",
]);
const ignoredDirectories = new Set([".git", "node_modules"]);

const suspiciousText = [
  { label: "Unicode replacement character", value: "\uFFFD" },
  { label: "misread UTF-8 sequence beginning with A-circumflex", value: "\u00C2" },
  { label: "misread UTF-8 sequence beginning with A-tilde", value: "\u00C3" },
  { label: "misread smart punctuation", value: "\u00E2\u20AC" },
  { label: "misread four-byte character", value: "\u00F0\u009F" },
];

async function collectTextFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) files.push(...await collectTextFiles(entryUrl));
    else if (checkedExtensions.has(extname(entry.name))) files.push(entryUrl);
  }

  return files;
}

const failures = [];
const files = await collectTextFiles(projectRoot);

for (const fileUrl of files) {
  const content = await readFile(fileUrl, "utf8");
  const lines = content.split(/\r?\n/);

  for (const pattern of suspiciousText) {
    lines.forEach((line, index) => {
      if (line.includes(pattern.value)) {
        failures.push(`${relative(projectRoot.pathname, fileUrl.pathname)}:${index + 1} - ${pattern.label}`);
      }
    });
  }
}

if (failures.length > 0) {
  console.error("Text encoding check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Text encoding check passed: ${files.length} files scanned.`);
}
