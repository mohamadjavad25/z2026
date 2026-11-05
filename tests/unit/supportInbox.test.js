import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

globalThis.React = React;

const row = (over) => ({ id: 1, kind: "support", category: "question", subject: "سؤال", status: "open", last_actor: "user", last_message_at: "2026-11-05T10:00:00Z", last_body: "سلام", user_name: "مینا", from_admin: false, ...over });
let tickets = [];
vi.mock("../../app/admin/ui", () => ({
  useAdminData: () => ({ data: { tickets, total: tickets.length, counts: {} }, error: "", loading: false, reload: () => {} }),
  EmptyState: () => null,
  ErrorNote: () => null,
  Loading: () => null,
  Pager: () => null,
  Segmented: () => null,
  Skeleton: () => null,
  confirmAction: () => {},
  toast: () => {},
  withQuery: (path) => path
}));
vi.mock("../../app/admin/PageHead", () => ({ PageHead: () => null }));
vi.mock("../../app/admin/ClaudeConnect", () => ({ ClaudeMark: () => null, askClaude: () => {}, setClaudeContext: () => {} }));

const { SupportTab } = await import("../../app/admin/SupportTab.jsx");
const { turnOf } = await import("../../app/admin/format.js");
const inbox = () => renderToStaticMarkup(React.createElement(SupportTab, {}));

describe("whose turn a support conversation is", () => {
  it("names each state in the words the owner uses", () => {
    expect(turnOf(row({ last_actor: "user" })).label).toBe("منتظر پاسخ تو");
    expect(turnOf(row({ last_actor: "admin", status: "in_progress" })).label).toBe("جواب دادی");
    expect(turnOf(row({ last_actor: "admin", from_admin: true })).label).toBe("پیام دادی");
    expect(turnOf(row({ last_actor: "admin", status: "closed" })).label).toBe("بسته");
  });

  it("a new message from the user after a reply puts it back on the owner", () => {
    expect(turnOf(row({ last_actor: "user", status: "in_progress" })).key).toBe("you");
  });
});

describe("the support inbox rows", () => {
  it("says in words on every row which ones are answered, not only with a small dot", () => {
    tickets = [row({ id: 1 }), row({ id: 2, last_actor: "admin", status: "in_progress", last_body: "درست شد" }), row({ id: 3, last_actor: "admin", status: "closed" })];
    const html = inbox();
    expect(html).toContain("منتظر پاسخ تو");
    expect(html).toContain("جواب دادی");
    expect(html).toContain("بسته");
    expect(html).toContain("تو: درست شد");
  });
});
