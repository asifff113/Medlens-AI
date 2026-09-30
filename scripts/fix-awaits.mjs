import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name === "route.ts") out.push(p);
  }
  return out;
}

const files = walk(path.join(process.cwd(), "src", "app"));
let changed = 0;
for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  const before = c;
  // Add await to getActor() / requireActor() when missing
  c = c.replace(/(\s|\n)const actor = getActor\(\)/g, "$1const actor = await getActor()");
  c = c.replace(/(\s|\n)const actor = requireActor\(\)/g, "$1const actor = await requireActor()");
  c = c.replace(/await await /g, "await ");
  if (c !== before) {
    fs.writeFileSync(f, c);
    changed++;
  }
}
console.log(`Touched ${changed} files.`);