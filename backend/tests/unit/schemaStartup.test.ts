import { expect, test } from "bun:test";
import { createServer } from "node:net";

async function unusedPort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return address.port;
}

const cases = ["42703", "42P01", "PGRST202", "42501", "false", "timeout"].map(
  (code) => ({ code, delayed: false })
);
cases.push({ code: "42703", delayed: true }, { code: "42P01", delayed: true });

for (const { code, delayed } of cases) {
  test(`actual entrypoint refuses health listener on schema failure ${code}${
    delayed ? " after delayed imports" : ""
  }`, async () => {
    const port = await unusedPort();
    const requests: string[] = [];
    let receivedRequest: () => void = () => {};
    const firstRequest = new Promise<void>((resolve) => {
      receivedRequest = resolve;
    });
    let release: () => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = () =>
        resolve(
          code === "false"
            ? Response.json(false)
            : Response.json(
                {
                  code,
                  message: "sensitive-driver-detail",
                  details: "secret-fixture",
                },
                { status: 400 }
              )
        );
    });
    let requestedAt = 0;
    const stub = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        requests.push(new URL(request.url).pathname);
        requestedAt = performance.now();
        receivedRequest();
        return pending;
      },
    });
    const child = Bun.spawn(
      [
        process.execPath,
        "run",
        ...(delayed
          ? ["--preload", "./tests/unit/schemaStartupDelay.fixture.ts"]
          : []),
        "src/index.ts",
      ],
      {
        cwd: new URL("../../", import.meta.url).pathname,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          SUPABASE_URL: `http://127.0.0.1:${stub.port}`,
          SUPABASE_SERVICE_ROLE_KEY: "startup-local-placeholder",
          JWT_SECRET: "startup-local-placeholder",
          FRONTEND_URL: "http://localhost:3000",
          RECOVERY_DELIVERY_URL: "",
          RECOVERY_DELIVERY_SECRET: "",
          DISCORD_BOT_TOKEN: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    // Drain immediately, but never put raw child output in failure diagnostics.
    const outputText = new Response(child.stdout).text();
    const errorText = new Response(child.stderr).text();
    let phase = "waiting for the first readiness RPC";
    const startedAt = performance.now();
    const diagnostics = () =>
      `Startup ${code}${delayed ? " with delayed imports" : ""}: ${phase}; ` +
      `elapsed=${Math.round(performance.now() - startedAt)}ms; ` +
      `requests=${requests.length}; exit=${child.exitCode ?? "pending"}`;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    // Share the existing 15s case budget across imports and RPC completion,
    // leaving time for cleanup. Import time is not the schema RPC deadline.
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => reject(new Error(diagnostics())), 14000);
    });
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        firstRequest,
        child.exited.then((exit) => {
          throw new Error(
            `${diagnostics()}; child exited before readiness RPC (${exit})`
          );
        }),
        deadline,
      ]);
      expect(requests).toHaveLength(1);
      phase = "checking health while readiness is pending";
      await expect(
        fetch(`http://127.0.0.1:${port}/api/health`)
      ).rejects.toThrow();
      // Keep timeout requests pending so the real production abort must fire.
      if (code !== "timeout") release();
      phase = "waiting for schema failure exit";
      const exit = await Promise.race([
        child.exited,
        new Promise<never>((_, reject) => {
          exitTimer = setTimeout(() => reject(new Error(diagnostics())), 7000);
        }),
        deadline,
      ]);
      expect(exit).toBe(1);
      if (code === "timeout") {
        // Catch an immediate rejection masquerading as the five-second abort.
        expect(performance.now() - requestedAt).toBeGreaterThanOrEqual(4500);
      }
      const output = await outputText;
      const error = await errorText;
      expect(requests).toEqual(["/rest/v1/rpc/account_recovery_schema_ready"]);
      expect(error).toContain("[startup] Account recovery schema unavailable");
      expect(error).not.toContain("sensitive-driver-detail");
      expect(error).not.toContain("secret-fixture");
      expect(output).not.toContain("Server running");
      await expect(
        fetch(`http://127.0.0.1:${port}/api/health`)
      ).rejects.toThrow();
    } finally {
      clearTimeout(deadlineTimer);
      clearTimeout(exitTimer);
      child.kill();
      await child.exited;
      release();
      stub.stop(true);
    }
  }, 15000);
}
