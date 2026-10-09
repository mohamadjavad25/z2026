export const ARTIST_RAIL_DOCK_KEY = "frfru_artist_rail_dock";

export function clampRail(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function defaultArtistRailDock() {
  return { wall: "left", along: 1 };
}

export function readArtistRailDock() {
  if (typeof window === "undefined") return defaultArtistRailDock();
  try {
    const saved = JSON.parse(window.localStorage.getItem(ARTIST_RAIL_DOCK_KEY) || "null");
    if (saved && ["left", "right", "top", "bottom"].includes(saved.wall) && typeof saved.along === "number") {
      return { wall: saved.wall, along: clampRail(saved.along, 0, 1) };
    }
    if ((saved?.side === "left" || saved?.side === "right") && (saved?.edge === "top" || saved?.edge === "bottom")) {
      return {
        wall: saved.side,
        along: saved.edge === "top" ? 0 : 1
      };
    }
  } catch {
    // ignore
  }
  return defaultArtistRailDock();
}

export function getArtistRailFrame() {
  if (typeof window === "undefined") {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const el = document.querySelector(".appShell");
  if (!el) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function getArtistRailSafeBounds(width = 68, height = 180, pad = 10) {
  const topSafe = pad;
  const bottomSafe = 78 + pad;
  const frame = getArtistRailFrame();
  const vw = frame.width;
  const vh = frame.height;
  return {
    pad,
    topSafe,
    bottomSafe,
    vw,
    vh,
    frameX: frame.left,
    frameY: frame.top,
    maxX: Math.max(pad, vw - width - pad),
    maxY: Math.max(topSafe, vh - height - bottomSafe),
    usableX: Math.max(0, vw - pad * 2 - width),
    usableY: Math.max(0, vh - topSafe - bottomSafe - height)
  };
}

export function snapArtistRailDock(centerX, centerY, width, height) {
  const { pad, topSafe, bottomSafe, vw, vh, usableX, usableY, frameX, frameY } = getArtistRailSafeBounds(width, height);
  const fx = centerX - frameX;
  const fy = centerY - frameY;
  const distLeft = fx;
  const distRight = vw - fx;
  const distTop = fy;
  const distBottom = vh - fy;
  const nearest = Math.min(distLeft, distRight, distTop, distBottom);

  if (nearest === distLeft || nearest === distRight) {
    const wall = nearest === distLeft ? "left" : "right";
    const top = clampRail(centerY - height / 2, topSafe, topSafe + usableY);
    const along = usableY <= 0 ? 0.5 : (top - topSafe) / usableY;
    return { wall, along: clampRail(along, 0, 1) };
  }

  const wall = nearest === distTop ? "top" : "bottom";
  const left = clampRail(centerX - width / 2, pad, pad + usableX);
  const along = usableX <= 0 ? 0.5 : (left - pad) / usableX;
  return { wall, along: clampRail(along, 0, 1) };
}

export function getArtistRailDockStyle(dock, width = 68, height = 180, { tucked = false } = {}) {
  if (typeof window === "undefined") {
    return { left: tucked ? 2 : 10, bottom: 78, right: "auto", top: "auto" };
  }
  const { pad, topSafe, bottomSafe, usableX, usableY, frameX, frameY, vw, vh } = getArtistRailSafeBounds(width, height, tucked ? 2 : 10);
  const along = clampRail(Number(dock?.along) || 0, 0, 1);
  const wall = dock?.wall || "left";
  const rightGap = Math.max(0, window.innerWidth - (frameX + vw));
  const bottomGap = Math.max(0, window.innerHeight - (frameY + vh));

  if (wall === "left" || wall === "right") {
    const top = frameY + topSafe + usableY * along;
    return wall === "left"
      ? { left: frameX + pad, top, right: "auto", bottom: "auto" }
      : { right: rightGap + pad, left: "auto", top, bottom: "auto" };
  }

  const left = frameX + pad + usableX * along;
  return wall === "top"
    ? { top: frameY + topSafe, left, right: "auto", bottom: "auto" }
    : { bottom: bottomGap + (bottomSafe - pad), left, right: "auto", top: "auto" };
}
