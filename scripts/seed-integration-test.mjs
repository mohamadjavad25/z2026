/**
 * Full HomeApp integration smoke (LOCAL ONLY) — after Shop / Explore /
 * Salon-client / Public-artist / Artist-owner / Salon-owner extracts.
 * (AI Studio / shell-currency step removed along with that feature, 2026-09.)
 *
 * Uses: data/zibaban-integration-test.sqlite (never data/zibaban.sqlite)
 *
 * Usage:
 *   node scripts/seed-integration-test.mjs
 *   node scripts/seed-integration-test.mjs --cleanup
 *
 * Env: ZIBABAN_INTEGRATION_TEST_PORT  default 3020
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-integration-test.sqlite");
const PORT = Number(process.env.ZIBABAN_INTEGRATION_TEST_PORT || 3020);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "integration-test-pass";

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");

/** @type {Array<{ n: number, title: string, ok: boolean, detail: string, raw?: string, kind?: string }>} */
const steps = [];

function record(n, title, ok, detail = "", raw = "", kind = "") {
  const tag = ok ? "PASS" : "FAIL";
  const line = `[${tag}] ${n}. ${title}${detail ? ` — ${detail}` : ""}`;
  steps.push({ n, title, ok, detail, raw, kind: kind || (ok ? "" : "REGRESSION") });
  console.log(line);
  if (!ok && raw) {
    console.log("    RAW:", typeof raw === "string" ? raw.slice(0, 800) : JSON.stringify(raw).slice(0, 800));
  }
}

function cleanupDbFiles() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${TEST_DB}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

function parseCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const joined = raw.join(",");
  const match = joined.match(/zibaban_session=([^;]+)/);
  return match ? match[1] : "";
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `zibaban_session=${cookie}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload, cookie: parseCookie(res) || cookie || "", status: res.status };
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/salons`);
      if (res.status === 200) return true;
    } catch {
      // wait
    }
    await sleep(500);
  }
  return false;
}

function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      ZIBABAN_DB_PATH: TEST_DB,
      NEXT_DIST_DIR: ".next-integration-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-integration-test-server.log"), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(700);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

function userIdFrom(payload) {
  return payload?.data?.user?.id || payload?.profile?.id || null;
}

/**
 * Simulates notifyArtistBookingCreated when logged-in artist matches target:
 * bump + GET /api/artist/me → artistBookingList.
 */
async function simulateNotifyArtistBookingCreated({ artistCookie, artistId, targetArtistId, listRef }) {
  if (String(artistId) !== String(targetArtistId)) {
    return { skipped: true, list: listRef.current };
  }
  const me = await api("/api/artist/me", { cookie: artistCookie });
  const list = me.payload?.data?.bookings || [];
  listRef.current = list;
  return { skipped: false, ok: me.res.ok, list, status: me.status, payload: me.payload };
}

async function main() {
  console.log("=== HomeApp INTEGRATION test (isolated DB) ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);
  console.log("");

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleanup done");
    return;
  }

  cleanupDbFiles();
  const server = startTestServer();
  if (!(await waitForServer())) {
    record(0, "server ready", false, "timeout", "see data/zibaban-integration-test-server.log");
    await stopServer(server);
    process.exitCode = 1;
    printSummary();
    return;
  }
  console.log("[info] server ready on", BASE);

  let salonCookie = "";
  let salonId = null;
  let artistCookie = "";
  let artistId = null;
  let clientCookie = "";
  let clientId = null;
  let shopCookie = "";
  let shopId = null;
  let staffUnlinked = null;
  let staffLinked = null;
  let portfolioPostId = null;
  let portfolioTitle = "پورتفولیو یکپارچه آرتیست";
  const artistBookingListRef = { current: [] };

  try {
    // ─── 1. Register salon + login ───
    {
      const reg = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: "09161110001",
          password: PASSWORD,
          type: "salon",
          data: { name: "سالن یکپارچه", area: "تهران", service: "زیبایی" }
        }
      });
      salonCookie = reg.cookie;
      salonId = userIdFrom(reg.payload);
      const login = await api("/api/auth/login", {
        method: "POST",
        body: { phone: "09161110001", password: PASSWORD }
      });
      if (login.cookie) salonCookie = login.cookie;
      const ok = reg.res.ok && login.res.ok && Boolean(salonId) && Boolean(salonCookie);
      record(1, "ثبت‌نام + ورود سالن (owner)", ok,
        ok ? `salonId=${salonId}` : `reg=${reg.status} login=${login.status}`,
        ok ? "" : JSON.stringify({ reg: reg.payload, login: login.payload }));
      if (!ok) throw new Error("step 1 failed — abort");
    }

    // ─── 2. Salon: service, unlinked staff, hours ───
    {
      const svc = await api("/api/salon-services", {
        method: "POST",
        cookie: salonCookie,
        body: { name: "کات مو سالن", price: "۵۰۰", duration: "۴۵ دقیقه" }
      });
      const staff = await api("/api/salon-staff", {
        method: "POST",
        cookie: salonCookie,
        body: { name: "پرسنل بدون لینک", role: "کات", state: "فعال" }
      });
      staffUnlinked = staff.payload?.person;
      const hoursGet = await api("/api/salon-hours", { cookie: salonCookie });
      const hours = hoursGet.payload?.hours || [];
      const day = hours[0];
      const hoursPatch = day
        ? await api("/api/salon-hours", {
          method: "PATCH",
          cookie: salonCookie,
          body: { ...day, open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true }
        })
        : { res: { ok: false }, status: 0, payload: { error: "no hours" } };
      const hoursAfter = hoursPatch.payload?.hours || [];
      const ok = (svc.status === 201 || svc.res.ok)
        && (staff.status === 201 || staff.res.ok)
        && hoursGet.res.ok
        && hoursPatch.res.ok
        && hoursAfter.length > 0
        && !staffUnlinked?.artist_user_id;
      record(2, "سالن: سرویس + staff بدون لینک + ساعات", ok,
        ok ? `staffId=${staffUnlinked?.id} hours=${hoursAfter.length}` : `svc=${svc.status} staff=${staff.status} hoursPatch=${hoursPatch.status}`,
        ok ? "" : JSON.stringify({ svc: svc.payload, staff: staff.payload, hoursPatch: hoursPatch.payload }));
    }

    // ─── 3. Register artist + login ───
    {
      const reg = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: "09161110002",
          password: PASSWORD,
          type: "artist",
          data: { name: "آرتیست یکپارچه", area: "تهران", service: "میکاپ" }
        }
      });
      artistCookie = reg.cookie;
      artistId = userIdFrom(reg.payload);
      const login = await api("/api/auth/login", {
        method: "POST",
        body: { phone: "09161110002", password: PASSWORD }
      });
      if (login.cookie) artistCookie = login.cookie;
      const ok = reg.res.ok && login.res.ok && Boolean(artistId) && Boolean(artistCookie);
      record(3, "ثبت‌نام + ورود آرتیست (owner)", ok,
        ok ? `artistId=${artistId}` : `reg=${reg.status} login=${login.status}`,
        ok ? "" : JSON.stringify({ reg: reg.payload, login: login.payload }));
      if (!ok) throw new Error("step 3 failed — abort");
    }

    // ─── 4. Artist: portfolio post (explore) + service ───
    {
      const post = await api("/api/posts", {
        method: "POST",
        cookie: artistCookie,
        body: {
          title: portfolioTitle,
          tag: "میکاپ",
          caption: "پست یکپارچه برای Explore",
          image: "data:image/png;base64,iVBORw0KGgo=",
          inExplore: true,
          featured: true
        }
      });
      portfolioPostId = post.payload?.data?.post?.id || post.payload?.post?.id;
      const svc = await api("/api/artist/me", {
        method: "POST",
        cookie: artistCookie,
        body: { name: "میکاپ یکپارچه", price: "۸۰۰", duration: "۶۰ دقیقه" }
      });
      const explore = await api("/api/explore/posts", { cookie: artistCookie });
      const explorePosts = explore.payload?.data?.posts || explore.payload?.posts || [];
      const seenInExplore = explorePosts.some((p) => (
        String(p.id) === String(portfolioPostId) || p.title === portfolioTitle
      ));
      const ok = (post.status === 201 || post.res.ok) && Boolean(portfolioPostId)
        && (svc.status === 201 || svc.res.ok)
        && explore.res.ok && seenInExplore;
      record(4, "آرتیست: پورتفولیو در Explore + سرویس", ok,
        ok ? `postId=${portfolioPostId}` : `post=${post.status} exploreSeen=${seenInExplore}`,
        ok ? "" : JSON.stringify({ post: post.payload, svc: svc.payload, exploreCount: explorePosts.length }));
    }

    // ─── 5. Salon links second staff to artist ───
    {
      const staff = await api("/api/salon-staff", {
        method: "POST",
        cookie: salonCookie,
        body: {
          name: "آرتیست یکپارچه",
          role: "میکاپ",
          artist_user_id: artistId,
          artistUserId: artistId,
          state: "فعال"
        }
      });
      staffLinked = staff.payload?.person;
      const linked = Number(staffLinked?.artist_user_id || staffLinked?.artistUserId || 0);
      // Attach service to linked staff for staff="" fallback
      await api("/api/salon-services", {
        method: "POST",
        cookie: salonCookie,
        body: {
          name: "میکاپ سالن لینک‌شده",
          price: "۹۰۰",
          duration: "۶۰ دقیقه",
          staff_id: staffLinked?.id
        }
      });
      const ok = (staff.status === 201 || staff.res.ok) && linked === Number(artistId);
      record(5, "سالن: staff دوم با artist_user_id لینک", ok,
        ok ? `staffId=${staffLinked?.id} linked=${linked}` : `status=${staff.status} linked=${linked}`,
        ok ? "" : JSON.stringify(staff.payload));
    }

    // ─── 6. Register client + login ───
    {
      const reg = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: "09161110003",
          password: PASSWORD,
          type: "client",
          data: { name: "مشتری یکپارچه", area: "تهران" }
        }
      });
      clientCookie = reg.cookie;
      clientId = userIdFrom(reg.payload);
      const login = await api("/api/auth/login", {
        method: "POST",
        body: { phone: "09161110003", password: PASSWORD }
      });
      if (login.cookie) clientCookie = login.cookie;
      const ok = reg.res.ok && login.res.ok && Boolean(clientId) && Boolean(clientCookie);
      record(6, "ثبت‌نام + ورود مشتری", ok,
        ok ? `clientId=${clientId}` : `reg=${reg.status} login=${login.status}`,
        ok ? "" : JSON.stringify({ reg: reg.payload, login: login.payload }));
      if (!ok) throw new Error("step 6 failed — abort");
    }

    // ─── 7. Client sees salons + artists ───
    {
      const salons = await api("/api/salons", { cookie: clientCookie });
      const artists = await api("/api/artists", { cookie: clientCookie });
      const salonList = salons.payload?.salons || salons.payload?.data?.salons || [];
      const artistList = artists.payload?.data?.artists || artists.payload?.artists || [];
      const foundSalon = salonList.some((s) => Number(s.id) === Number(salonId) || s.name === "سالن یکپارچه");
      const foundArtist = artistList.some((a) => Number(a.id) === Number(artistId) || a.name === "آرتیست یکپارچه");
      const ok = salons.res.ok && artists.res.ok && foundSalon && foundArtist;
      record(7, "مشتری: GET salons + artists شامل موجودیت‌های تازه", ok,
        ok ? `salons=${salonList.length} artists=${artistList.length}` : `foundSalon=${foundSalon} foundArtist=${foundArtist}`,
        ok ? "" : JSON.stringify({ salonCount: salonList.length, artistCount: artistList.length }));
    }

    // ─── 8. Explore shows artist portfolio ───
    {
      const explore = await api("/api/explore/posts", { cookie: clientCookie });
      const posts = explore.payload?.data?.posts || explore.payload?.posts || [];
      const found = posts.some((p) => String(p.id) === String(portfolioPostId) || p.title === portfolioTitle);
      record(8, "مشتری: Explore شامل پست پورتفولیو آرتیست", explore.res.ok && found,
        found ? `postId=${portfolioPostId}` : `posts=${posts.length}`,
        found ? "" : JSON.stringify({ status: explore.status, titles: posts.map((p) => p.title).slice(0, 10) }));
    }

    // ─── 9. Save + rate post ───
    {
      const save = await api(`/api/posts/${portfolioPostId}/save`, {
        method: "POST",
        cookie: clientCookie
      });
      const rate = await api(`/api/posts/${portfolioPostId}/rate`, {
        method: "POST",
        cookie: clientCookie,
        body: { rating: 5 }
      });
      const ok = save.res.ok && rate.res.ok;
      record(9, "مشتری: save + rate پست", ok,
        ok ? `saved=${save.payload?.data?.saved ?? save.payload?.saved}` : `save=${save.status} rate=${rate.status}`,
        ok ? "" : JSON.stringify({ save: save.payload, rate: rate.payload }));
    }

    // ─── 10. Follow salon + artist ───
    {
      const followArtist = await api("/api/follows", {
        method: "POST",
        cookie: clientCookie,
        body: { targetUserId: artistId }
      });
      const followSalon = await api("/api/salon-follow", {
        method: "POST",
        cookie: clientCookie,
        body: { salonUserId: salonId, follow: true }
      });
      const follows = await api("/api/follows", { cookie: clientCookie });
      const ids = (follows.payload?.data?.followingIds || []).map(String);
      const ok = followArtist.res.ok && followSalon.res.ok && follows.res.ok
        && ids.includes(String(artistId));
      record(10, "مشتری: فالو سالن + آرتیست", ok,
        ok ? `followingIds=${ids.join(",")}` : `artist=${followArtist.status} salon=${followSalon.status}`,
        ok ? "" : JSON.stringify({ followArtist: followArtist.payload, followSalon: followSalon.payload, follows: follows.payload }));
    }

    // ─── 11. Public artist booking + notifyArtistBookingCreated sim ───
    {
      const before = await api("/api/artist/me", { cookie: artistCookie });
      const beforeCount = (before.payload?.data?.bookings || []).length;
      const book = await api("/api/artist/bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          artistUserId: artistId,
          service: "میکاپ یکپارچه",
          bookingDate: "امروز",
          time: "۱۱:۰۰",
          durationMinutes: 60,
          clientName: "مشتری یکپارچه",
          clientPhone: "09161110003"
        }
      });
      const notify = await simulateNotifyArtistBookingCreated({
        artistCookie,
        artistId,
        targetArtistId: artistId,
        listRef: artistBookingListRef
      });
      const ok = book.status === 201
        && !notify.skipped
        && notify.ok
        && notify.list.length === beforeCount + 1
        && notify.list.some((b) => String(b.time || "").includes("۱۱"));
      record(11, "مشتری: رزرو public artist + notifyArtistBookingCreated", ok,
        ok ? `bookings=${notify.list.length}` : `book=${book.status} list=${notify.list?.length}`,
        ok ? "" : JSON.stringify({ book: book.payload, notify }));
    }

    // ─── 12. Salon booking on linked staff → salon + artist + notify ───
    {
      const beforeArtist = artistBookingListRef.current.length;
      const beforeSalon = await api("/api/salon-bookings", { cookie: salonCookie });
      const beforeSalonCount = (beforeSalon.payload?.bookings || []).length;
      const book = await api("/api/salon-bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          salonUserId: salonId,
          client: "مشتری یکپارچه",
          phone: "09161110003",
          service: "میکاپ سالن لینک‌شده",
          staff: "آرتیست یکپارچه",
          bookingDate: "امروز",
          time: "۱۳:۰۰",
          status: "درخواست"
        }
      });
      const linkedId = book.payload?.linkedArtistId;
      const notify = await simulateNotifyArtistBookingCreated({
        artistCookie,
        artistId,
        targetArtistId: linkedId,
        listRef: artistBookingListRef
      });
      const afterSalon = await api("/api/salon-bookings", { cookie: salonCookie });
      const afterSalonCount = (afterSalon.payload?.bookings || []).length;
      const ok = book.status === 201
        && Boolean(book.payload?.artistBooking)
        && Number(linkedId) === Number(artistId)
        && afterSalonCount === beforeSalonCount + 1
        && !notify.skipped
        && notify.list.length >= beforeArtist + 1
        && notify.list.some((b) => String(b.time || "").includes("۱۳"));
      record(12, "مشتری: رزرو سالن روی staff لینک‌شده → salon+artist+notify", ok,
        ok ? `salon=${afterSalonCount} artist=${notify.list.length} linked=${linkedId}` : `book=${book.status} linked=${linkedId}`,
        ok ? "" : JSON.stringify({ book: book.payload, notify, afterSalon: afterSalon.payload }));
    }

    // ─── 13. Reviews for salon + artist ───
    {
      const revArtist = await api("/api/reviews", {
        method: "POST",
        cookie: clientCookie,
        body: { targetUserId: artistId, rating: 5, text: "عالی بود", service: "میکاپ" }
      });
      const revSalon = await api("/api/reviews", {
        method: "POST",
        cookie: clientCookie,
        body: { targetUserId: salonId, rating: 4, text: "سالن خوب", service: "میکاپ سالن" }
      });
      const ok = (revArtist.status === 201 || revArtist.res.ok)
        && (revSalon.status === 201 || revSalon.res.ok);
      record(13, "مشتری: ریویو سالن + آرتیست", ok,
        ok ? "both 201" : `artist=${revArtist.status} salon=${revSalon.status}`,
        ok ? "" : JSON.stringify({ revArtist: revArtist.payload, revSalon: revSalon.payload }));
    }

    // ─── 14. Artist final bookings ≥ 2 ───
    {
      const me = await api("/api/artist/me", { cookie: artistCookie });
      const list = me.payload?.data?.bookings || [];
      artistBookingListRef.current = list;
      const ok = me.res.ok && list.length >= 2;
      record(14, "آرتیست owner: artistBookingList نهایی ≥ ۲", ok,
        `count=${list.length}`,
        ok ? "" : JSON.stringify({ status: me.status, bookings: list }));
    }

    // ─── 15. Salon final appointments has step-12 booking ───
    {
      const me = await api("/api/salon-bookings", { cookie: salonCookie });
      const list = me.payload?.bookings || [];
      const found = list.some((b) => String(b.time || "").includes("۱۳") || b.staff === "آرتیست یکپارچه");
      const ok = me.res.ok && found;
      record(15, "سالن owner: salonAppointmentList شامل رزرو قدم ۱۲", ok,
        `count=${list.length} found=${found}`,
        ok ? "" : JSON.stringify({ status: me.status, bookings: list }));
    }

    // ─── 16. Hours PATCH regression ───
    {
      const before = await api("/api/salon-hours", { cookie: salonCookie });
      const hoursBefore = before.payload?.hours || [];
      const target = hoursBefore.find((h) => h.day) || hoursBefore[0];
      const patch = await api("/api/salon-hours", {
        method: "PATCH",
        cookie: salonCookie,
        body: { ...target, day: target.day, open_time: "۱۲:۰۰", close_time: "۲۱:۰۰", active: true }
      });
      const hoursFromPatch = patch.payload?.hours || [];
      const after = await api("/api/salon-hours", { cookie: salonCookie });
      const hoursAfter = after.payload?.hours || [];
      const updated = hoursAfter.find((h) => h.day === target.day);
      const ok = before.res.ok && patch.res.ok && after.res.ok
        && hoursFromPatch.length > 0
        && hoursAfter.length > 0
        && hoursAfter.length >= hoursBefore.length
        && String(updated?.open_time || "").includes("۱۲");
      record(16, "سالن: PATCH hours → GET لیست خالی نمی‌شود", ok,
        `before=${hoursBefore.length} patchHours=${hoursFromPatch.length} after=${hoursAfter.length} open=${updated?.open_time}`,
        ok ? "" : JSON.stringify({ patch: patch.payload, after: after.payload }));
    }

    // ─── 18. Shop register + product; client sees in GET /api/shops ───
    {
      const reg = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: "09161110004",
          password: PASSWORD,
          type: "shop",
          data: { name: "فروشگاه یکپارچه", area: "ونک", service: "مراقبت پوست" }
        }
      });
      shopCookie = reg.cookie;
      shopId = userIdFrom(reg.payload);
      const product = await api("/api/shop/me", {
        method: "POST",
        cookie: shopCookie,
        body: {
          name: "سرم یکپارچه",
          category: "مراقبت پوست",
          price: "۱٬۰۰۰٬۰۰۰",
          priceNum: 1000000,
          stock: 5,
          badge: "جدید",
          image: "/ad-rose-velvet.png",
          description: "integration product"
        }
      });
      const shops = await api("/api/shops", { cookie: clientCookie });
      const list = shops.payload?.data?.shops || shops.payload?.shops || [];
      const found = list.some((s) => Number(s.id) === Number(shopId) || s.name === "فروشگاه یکپارچه");
      const ok = reg.res.ok && Boolean(shopId)
        && (product.status === 201 || product.res.ok)
        && shops.res.ok && found;
      record(18, "Shop: ثبت‌نام + محصول؛ مشتری در GET /api/shops می‌بیند", ok,
        ok ? `shopId=${shopId} product=${product.payload?.data?.product?.id}` : `reg=${reg.status} product=${product.status} found=${found}`,
        ok ? "" : JSON.stringify({ reg: reg.payload, product: product.payload, shopCount: list.length }));
    }
  } catch (error) {
    console.log("\n[ABORT]", error.message || error);
    if (!steps.some((s) => !s.ok)) {
      record(99, "unexpected abort", false, error.message || String(error), String(error.stack || error));
    }
  }

  printSummary();

  if (!keepServer) {
    await stopServer(server);
    cleanupDbFiles();
    console.log("cleanup done (--cleanup equivalent after run)");
  } else {
    console.log("server kept:", BASE);
  }

  const failed = steps.filter((s) => !s.ok);
  if (failed.length) process.exitCode = 1;
}

function printSummary() {
  console.log("\n========== SUMMARY ==========");
  console.log("| # | Result | Kind | Step |");
  console.log("|---|--------|------|------|");
  for (const s of steps) {
    const result = s.ok ? "PASS" : "FAIL";
    const kind = s.ok ? "—" : (s.kind || "REGRESSION");
    console.log(`| ${s.n} | ${result} | ${kind} | ${s.title} |`);
  }
  const pass = steps.filter((s) => s.ok).length;
  const fail = steps.filter((s) => !s.ok).length;
  const known = steps.filter((s) => !s.ok && s.kind === "KNOWN_PREEXISTING").length;
  const regression = steps.filter((s) => !s.ok && s.kind === "REGRESSION").length;
  console.log("-----------------------------");
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL (${regression} REGRESSION, ${known} KNOWN_PREEXISTING)`);
  if (regression > 0) {
    console.log("\nREGRESSION failures (treat as refactor combo bugs):");
    for (const s of steps.filter((x) => !x.ok && x.kind === "REGRESSION")) {
      console.log(`  - ${s.n}. ${s.title}: ${s.detail}`);
    }
  }
  if (known > 0) {
    console.log("\nKNOWN_PREEXISTING (documented before extracts; not marked as new regression):");
    for (const s of steps.filter((x) => !x.ok && x.kind === "KNOWN_PREEXISTING")) {
      console.log(`  - ${s.n}. ${s.title}: ${s.detail}`);
    }
  }
  console.log("=============================\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
