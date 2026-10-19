// Writes the «فرفرو مدیر» app's config (android/app/src/admin/assets/capacitor.config.json) from the one
// `cap sync` just copied for the normal app, so the two never drift apart. Run after every `cap sync`
// (npm run sync does). The admin flavor (android/app/build.gradle) packs this file over the main one.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "android", "app", "src");
const config = JSON.parse(readFileSync(join(root, "main", "assets", "capacitor.config.json"), "utf8"));

config.appId = "ir.frfro.admin";
config.appName = "فرفرو مدیر";
config.server = { ...config.server, url: "https://frfro.ir/admin" };
// "frfro-app" keeps the site's in-app look; "frfro-admin" switches its push to the admin side (app/shared/lib/nativePush.js).
config.appendUserAgent = "frfro-app frfro-admin";

const out = join(root, "admin", "assets", "capacitor.config.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(config, null, "\t")}\n`);
console.log(`admin config: ${out}`);
