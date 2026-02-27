const fs = require("fs");
const path = require("path");

const workerPath = path.join(".open-next", "worker.js");
if (!fs.existsSync(workerPath)) {
  console.error("Missing .open-next/worker.js (run build first)");
  process.exit(1);
}

const walk = (dir) => {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};

const files = walk(".open-next").filter((p) => !p.endsWith("worker.js"));
let worker = fs.readFileSync(workerPath, "utf8");

const re = /@opennextjs\/cloudflare-([a-f0-9]{16,})/g;
const matches = [...worker.matchAll(re)];

if (matches.length === 0) {
  console.log("No @opennextjs/cloudflare-<hash> imports found. Nothing to patch.");
  process.exit(0);
}

for (const m of matches) {
  const full = m[0];           // "@opennextjs/cloudflare-xxxx"
  const hash = m[1];

  const candidate = files.find((f) => f.includes(hash));
  if (!candidate) {
    console.error(`Could not find a file in .open-next containing hash ${hash}`);
    process.exit(1);
  }

  // make it relative from .open-next/worker.js (same folder)
  const relFromOpenNext = path.relative(".open-next", candidate).replace(/\\/g, "/");
  const newSpec = "./" + relFromOpenNext;

  worker = worker.split(full).join(newSpec);
  console.log(`Patched ${full}  ->  ${newSpec}`);
}

fs.writeFileSync(workerPath, worker);
console.log("Patched .open-next/worker.js successfully.");
