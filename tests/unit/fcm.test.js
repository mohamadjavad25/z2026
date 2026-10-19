import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// fcm.js reads its key once per module load, so each test loads a fresh copy.
async function loadFcm(env) {
  vi.resetModules();
  process.env.FRFRO_FCM_SERVICE_ACCOUNT = env;
  return import("../../app/lib/fcm.js");
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "frfro-test",
  client_email: "push@frfro-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" })
};
const accountB64 = Buffer.from(JSON.stringify(account)).toString("base64");

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FRFRO_FCM_SERVICE_ACCOUNT;
});

describe("fcm", () => {
  it("is off without a key, and sends nothing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const fcm = await loadFcm("");
    expect(fcm.fcmConfigured()).toBe(false);
    expect(await fcm.sendFcm("t", { title: "x" })).toEqual({ ok: false, gone: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is off with a broken key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fcm = await loadFcm("not-a-key");
    expect(fcm.fcmConfigured()).toBe(false);
  });

  it("signs a Google token and sends a high-priority message on the frfro channel", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }));
      return new Response("{}");
    }));
    const fcm = await loadFcm(accountB64);
    expect(fcm.fcmConfigured()).toBe(true);
    expect(await fcm.sendFcm("device-1", { title: "درخواست نوبت", body: "از سارا", url: "/?x=1" })).toEqual({ ok: true });
    await fcm.sendFcm("device-2", { title: "دوم" });

    // One login for both sends.
    expect(calls.filter((c) => String(c.url).includes("oauth2"))).toHaveLength(1);
    const assertion = new URLSearchParams(calls[0].init.body).get("assertion");
    const [header, claims, signature] = assertion.split(".");
    const verified = createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url"));
    expect(verified).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString()).iss).toBe(account.client_email);

    const send = calls[1];
    expect(send.url).toBe("https://fcm.googleapis.com/v1/projects/frfro-test/messages:send");
    expect(send.init.headers.Authorization).toBe("Bearer AT");
    const { message } = JSON.parse(send.init.body);
    expect(message.token).toBe("device-1");
    expect(message.notification).toEqual({ title: "درخواست نوبت", body: "از سارا" });
    expect(message.data).toEqual({ url: "/?x=1" });
    expect(message.android.priority).toBe("HIGH");
    expect(message.android.notification.channel_id).toBe("frfro");
  });

  it("reports a token that no longer belongs to an app as gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }));
      return new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
    }));
    const fcm = await loadFcm(accountB64);
    expect(await fcm.sendFcm("old", { title: "x" })).toEqual({ ok: false, gone: true });
  });

  it("keeps the token on a passing outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }));
      return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: 503 });
    }));
    const fcm = await loadFcm(accountB64);
    expect(await fcm.sendFcm("ok", { title: "x" })).toEqual({ ok: false, gone: false });
  });
});
