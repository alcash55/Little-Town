import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Bun cannot restore mock.module registrations with mock.restore(). */
export function runIsolatedUnitTests(fixture: URL): void {
  const result = spawnSync(process.execPath, ["test", fileURLToPath(fixture)], {
    encoding: "utf8",
    timeout: 25_000,
  });
  if (
    result.error ||
    result.status !== 0 ||
    /[1-9]\d* skip/.test(result.stderr)
  ) {
    throw new Error(
      `Isolated unit suite failed: ${fileURLToPath(fixture)}\n${
        result.error?.message ?? ""
      }\n${result.stdout}\n${result.stderr}`
    );
  }
  console.log(result.stderr.trim());
}
