import { initDB } from "./init";

await initDB();
console.log("Migration complete!");
process.exit(0);

