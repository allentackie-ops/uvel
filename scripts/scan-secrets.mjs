import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

// Build signatures from fragments so this scanner does not match its own source.
const signatures = [
  ["Stripe secret key", new RegExp(["sk", "_(live|test)_"].join(""))],
  ["OpenAI secret key", new RegExp(["sk", "-proj-"].join(""))],
  ["Anthropic secret key", new RegExp(["sk", "-ant-"].join(""))],
  ["Webhook signing secret", new RegExp(["whsec", "_"].join(""))],
  ["Private key block", /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/],
  ["Public build secret variable", /EXPO_PUBLIC_[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN)/],
];

const findings = [];
for (const file of tracked) {
  if (/\.(png|jpe?g|gif|webp|mp4|mov|pdf|zip|ttf|woff2?)$/i.test(file)) continue;
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (contents.includes("\0")) continue;
  for (const [label, pattern] of signatures) {
    if (pattern.test(contents)) findings.push(`${file}\t${label}`);
  }
}

if (findings.length) {
  console.error("Secret scan failed. Findings are listed by file and category only:");
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log(`Secret scan passed for ${tracked.length} tracked files.`);
