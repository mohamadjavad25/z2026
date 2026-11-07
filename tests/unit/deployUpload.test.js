import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// 2026-11-06: a real deploy from the GitHub button lost the road to the server mid-upload and stopped; the two
// «check» runs after it were green, so it looked as if the site had been updated.

const dirs = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Runs the upload with fake scp/ssh: the first `failures` scp calls drop, and the server reports `size`. */
function upload({ failures, size }) {
  const dir = mkdtempSync(join(tmpdir(), "upload-"));
  dirs.push(dir);
  const bin = dir.split(sep).join("/");
  writeFileSync(join(dir, "release.tgz"), "12345");
  writeFileSync(
    join(dir, "scp"),
    `#!/usr/bin/env bash\necho x >> "${bin}/scp-calls"\n[ "$(wc -l < "${bin}/scp-calls")" -gt ${failures} ]\n`,
  );
  writeFileSync(join(dir, "ssh"), `#!/usr/bin/env bash\necho ${size}\n`);
  const script = `chmod +x "${bin}/scp" "${bin}/ssh"; PATH="$(cd "${bin}" && pwd):$PATH" UPLOAD_RETRY_WAIT=0 bash deploy/upload-release.sh "${bin}/release.tgz" deploy@host`;
  const run = spawnSync("bash", ["-c", script], { encoding: "utf8" });
  const log = join(dir, "scp-calls");
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").length : 0;
  return { status: run.status, calls, out: run.stdout + run.stderr };
}

describe("uploading a release", () => {
  it("tries again when the road drops, and then succeeds", () => {
    const run = upload({ failures: 2, size: 5 });
    expect(run.status, run.out).toBe(0);
    expect(run.calls).toBe(3);
  });

  it("stops with an error when the road never comes back", () => {
    const run = upload({ failures: 99, size: 5 });
    expect(run.status).toBe(1);
    expect(run.calls).toBe(4);
  });

  it("does not trust an upload whose size on the server is wrong", () => {
    const run = upload({ failures: 0, size: 2 });
    expect(run.status).toBe(1);
    expect(run.out).toContain("only 2 of 5 bytes");
  });
});

describe("the deploy button", () => {
  const workflow = readFileSync(".github/workflows/deploy-main.yml", "utf8");

  it("says in the run's name whether it published or only checked", () => {
    expect(workflow).toMatch(/^run-name:.*inputs\.mode == 'deploy'.*انتشار.*فقط بررسی/m);
  });

  it("says on a check run that nothing was sent", () => {
    expect(workflow).toMatch(/if: inputs\.mode != 'deploy'[\s\S]*چیزی فرستاده نشد/);
  });

  it("uses the upload that tries again", () => {
    expect(readFileSync("deploy/deploy.sh", "utf8")).toContain("deploy/upload-release.sh");
  });
});
