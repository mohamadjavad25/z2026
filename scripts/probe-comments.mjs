const base = "http://localhost:3000";
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "09121112233", password: "password123" })
});
const setCookie = login.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0];
console.log("login status:", login.status, "cookie:", cookie ? "yes" : "no");

const get = async (path) => {
  const res = await fetch(base + path, { headers: { Cookie: cookie } });
  const txt = await res.text();
  return { status: res.status, body: txt.slice(0, 700) };
};

console.log("FEED:", JSON.stringify(await get("/api/explore/posts")));
console.log("C9:", JSON.stringify(await get("/api/posts/9/comments")));
console.log("C8:", JSON.stringify(await get("/api/posts/8/comments")));
