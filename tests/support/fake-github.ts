import { createServer, type Server } from "node:http";

// A stand-in for GitHub's sign-in, used only by the browser tests (independent check F2).
// Local Supabase reaches it at host.docker.internal when started in fake mode
// (`npm run supabase:github-fake`). It answers the three calls Supabase makes after the
// person says yes on GitHub: swap the code for a token, read the user, read their emails.
// Fixed port: Supabase must know the address when it starts (agreed exception, plan Nov 3).
// One fake runs for the whole test run (started in tests/e2e/global-setup.ts); tests in any
// worker tell it who approves the next sign-in through approveOnFakeGitHub().
export const FAKE_GITHUB_PORT = 54390;
export const FAKE_GITHUB_ORIGIN = `http://host.docker.internal:${FAKE_GITHUB_PORT}`;

export type FakeGitHubUser = { id: number; login: string; email: string; verified: boolean };

export class FakeGitHub {
  private server: Server | null = null;
  private byCode = new Map<string, FakeGitHubUser>();
  private byToken = new Map<string, FakeGitHubUser>();

  // The code GitHub would hand back after this person approves HQ.
  approve(user: FakeGitHubUser): string {
    const code = `code-${user.id}-${Math.random().toString(36).slice(2)}`;
    this.byCode.set(code, user);
    return code;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://fake");
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      // Test-only: a test registers the person who will "approve" HQ and gets their code.
      if (req.method === "POST" && url.pathname === "/__test/approve") {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => send(200, { code: this.approve(JSON.parse(raw) as FakeGitHubUser) }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/login/oauth/access_token") {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => {
          const code = new URLSearchParams(raw).get("code") ?? "";
          const user = this.byCode.get(code);
          if (!user) return send(400, { error: "bad_verification_code" });
          this.byCode.delete(code);
          const token = `token-${code}`;
          this.byToken.set(token, user);
          send(200, { access_token: token, token_type: "bearer", scope: "read:user,user:email" });
        });
        return;
      }
      const token = (req.headers.authorization ?? "").replace(/^(bearer|token)\s+/i, "");
      const user = this.byToken.get(token);
      if (!user) return send(401, { message: "Bad credentials" });
      if (url.pathname === "/api/v3/user") {
        return send(200, { id: user.id, login: user.login, name: user.login, email: user.email, avatar_url: "" });
      }
      if (url.pathname === "/api/v3/user/emails") {
        return send(200, [{ email: user.email, primary: true, verified: user.verified, visibility: "public" }]);
      }
      send(404, { message: "Not Found" });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(FAKE_GITHUB_PORT, "127.0.0.1", () => resolve());
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}

// Called from a test: registers who approves the next sign-in, and returns the code GitHub
// would hand back.
export async function approveOnFakeGitHub(user: FakeGitHubUser): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${FAKE_GITHUB_PORT}/__test/approve`, { method: "POST", body: JSON.stringify(user) });
  return ((await response.json()) as { code: string }).code;
}
