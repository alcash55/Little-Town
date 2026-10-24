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

for (const code of ["42703", "42P01", "PGRST202", "42501", "false", "timeout"]) {
  test(`actual entrypoint refuses health listener on schema failure ${code}`, async () => {
    const port = await unusedPort();
    const requests: string[] = [];
    let release: () => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = () => resolve(Response.json(true));
    });
    const stub = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        requests.push(new URL(request.url).pathname);
        if (code === "timeout") return pending;
        if (code === "false") return Response.json(false);
        return Response.json(
          { code, message: "sensitive-driver-detail", details: "secret-fixture" },
          { status: 400 }
        );
      },
    });
    const child = Bun.spawn([process.execPath, "run", "src/index.ts"], {
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
    });
    try {
      // Wait for the real Supabase request before checking the unopened listener.
      for (let i = 0; i < 200 && requests.length === 0; i++) await Bun.sleep(25);
      expect(requests).toHaveLength(1);
      await expect(fetch(`http://127.0.0.1:${port}/api/health`)).rejects.toThrow();
      const exit = await Promise.race([
        child.exited,
        Bun.sleep(7000).then(() => "still-running"),
      ]);
      expect(exit).toBe(1);
      const output = await new Response(child.stdout).text();
      const error = await new Response(child.stderr).text();
      expect(requests).toEqual(["/rest/v1/rpc/account_recovery_schema_ready"]);
      expect(error).toContain("[startup] Account recovery schema unavailable");
      expect(error).not.toContain("sensitive-driver-detail");
      expect(error).not.toContain("secret-fixture");
      expect(output).not.toContain("Server running");
      await expect(fetch(`http://127.0.0.1:${port}/api/health`)).rejects.toThrow();
    } finally {
      child.kill();
      await child.exited;
      release();
      stub.stop(true);
    }
  }, 15000);
}
