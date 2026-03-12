const { execSync } = require("child_process");
process.chdir(__dirname);
execSync("npx tsx server.ts", { stdio: "inherit" });
