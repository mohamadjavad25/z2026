import fs from "node:fs";

const path = "C:/Users/novin/Desktop/zibaban/app/features/shell/HomeApp.jsx";
let src = fs.readFileSync(path, "utf8");
const beforeLines = src.split(/\r?\n/).length;
console.log("before lines", beforeLines);

function must(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

src = src.replace(/\r\n/g, "\n");

{
  const re = /import \{\n  getShopProductTone,\n  mapShopCard,\n  mapShopProduct,\n  renderShopProductCanvas,\n  resolveShopProductBadge,\n  ShopStorefrontPage,\n  ShopStoreDock,\n  shopProductAspectPresets,\n  shopProductBadges,\n  shopProductEnhancePresets\n\} from "\.\.\/shops";/;
  must(re.test(src), "shops import block not found");
  src = src.replace(
    re,
    `import {
  getShopProductTone,
  ShopStorefrontPage,
  ShopStoreDock,
  shopProductAspectPresets,
  shopProductBadges,
  shopProductEnhancePresets,
  useShopWorkspace
} from "../shops";`
  );
}

src = src.replace(/\n  const \[shopCategory, setShopCategory\] = useState\("همه"\);\n/, "\n");

{
  const shopStateStart = src.indexOf("  const [selectedShop, setSelectedShop] = useState(null);");
  const afterShopRefs = src.indexOf("  const [salonDirectory, setSalonDirectory] = useState([]);");
  must(shopStateStart > 0 && afterShopRefs > shopStateStart, "shop state markers missing");

  const ownerChatBlock = `  const [shopOwnerChatOpen, setShopOwnerChatOpen] = useState(false);
  const [shopOwnerChatDraft, setShopOwnerChatDraft] = useState("");
  const [shopOwnerActiveChat, setShopOwnerActiveChat] = useState(null);
  const [shopOwnerMessages, setShopOwnerMessages] = useState([]);
`;

  const hookCall = `
  const {
    shopDirectory,
    setShopDirectory,
    shopCatalog,
    setShopCatalog,
    shopOrderList,
    setShopOrderList,
    shopCategory,
    setShopCategory,
    selectedShop,
    setSelectedShop,
    shopStoreFilter,
    setShopStoreFilter,
    shopProductSheetOpen,
    editingShopProduct,
    viewingShopProduct,
    shopProductImage,
    shopProductImageOriginal,
    shopProductEnhanceTab,
    setShopProductEnhanceTab,
    shopProductEnhanceBusy,
    shopProductActiveEnhance,
    shopProductActiveAspect,
    shopCart,
    shopCartOpen,
    setShopCartOpen,
    shopChatOpen,
    setShopChatOpen,
    shopChatDraft,
    setShopChatDraft,
    shopChatMessages,
    shopProductsRef,
    shopReviewsRailRef,
    visibleShops,
    selectedShopCatalog,
    featuredShopProducts,
    currentShopCart,
    shopCartSummary,
    refreshShopDirectory,
    refreshShopWorkspace,
    resetShopWorkspace,
    addToShopCart,
    updateShopCartQty,
    submitShopOrder,
    openShopChat,
    sendShopChatMessage,
    closeShopStorefront,
    onShopReviewsPointerDown,
    onShopReviewsPointerMove,
    onShopReviewsPointerUp,
    onShopReviewsWheel,
    openShopProductSheet,
    closeShopProductSheet,
    handleShopProductImageUpload,
    clearShopProductImage,
    applyShopProductEnhance,
    applyShopProductAspect,
    resetShopProductImageEdits,
    saveShopProduct,
    openShopProductDetail,
    closeShopProductDetail,
    editShopProductFromDetail,
    deleteShopProduct,
    selectShop,
    applyFollowCount,
    bumpFollowOptimistic
  } = useShopWorkspace({
    createdProfile,
    activeTab,
    onNotice: setAppToast
  });

`;

  src = src.slice(0, shopStateStart) + ownerChatBlock + hookCall + src.slice(afterShopRefs);
}

{
  const memoStart = src.indexOf("  const visibleShops = useMemo(() => {");
  const memoEnd = src.indexOf("  function addToShopCart(product) {");
  must(memoStart > 0 && memoEnd > memoStart, "shop memo block missing");
  src = src.slice(0, memoStart) + src.slice(memoEnd);
}

{
  const fnStart = src.indexOf("  function addToShopCart(product) {");
  const getOwner = src.indexOf("  function getOwnerInbox() {");
  must(fnStart > 0 && getOwner > fnStart, "shop fn / getOwnerInbox markers missing");
  src = src.slice(0, fnStart) + src.slice(getOwner);

  const openProductDetail2 = src.indexOf("  function openShopProductDetail(product) {");
  const activeRole2 = src.indexOf("  const activeRoleMeta = profileRoleMeta[profileType]");
  must(openProductDetail2 > 0 && activeRole2 > openProductDetail2, "product detail markers missing");
  src = src.slice(0, openProductDetail2) + src.slice(activeRole2);
}

{
  const refreshDir = src.indexOf("  async function refreshShopDirectory() {");
  const afterDir = src.indexOf("  async function refreshArtistWorkspace() {", refreshDir);
  must(refreshDir > 0 && afterDir > refreshDir, "refreshShopDirectory block missing");
  src = src.slice(0, refreshDir) + src.slice(afterDir);
}

{
  const refreshWs = src.indexOf("  async function refreshShopWorkspace() {");
  must(refreshWs > 0, "refreshShopWorkspace missing");
  let i = refreshWs + 10;
  let depth = 0;
  let started = false;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") {
      depth += 1;
      started = true;
    } else if (ch === "}") {
      depth -= 1;
      if (started && depth === 0) {
        i += 1;
        break;
      }
    }
  }
  if (src[i] === "\n") i += 1;
  src = src.slice(0, refreshWs) + src.slice(i);
}

{
  const effect1 = src.indexOf(`  useEffect(() => {
    setShopChatMessages([]);
    setShopChatDraft("");
    setShopCartOpen(false);
    setShopChatOpen(false);
  }, [selectedShop?.name]);`);
  must(effect1 > 0, "shop chat reset effect missing");
  const effect2Block = `  useEffect(() => {
    if (activeTab === "shops") return;
    setShopCartOpen(false);
    setShopChatOpen(false);
  }, [activeTab]);`;
  const effect2 = src.indexOf(effect2Block, effect1);
  must(effect2 > effect1, "shops tab effect missing");
  src = src.slice(0, effect1) + src.slice(effect2 + effect2Block.length);
}

src = src.replace(
  `    setExplorePostList([]);
    setShopDirectory([]);
    setShopCatalog([]);
    setShopOrderList([]);
    setArtistPortfolioItems([]);`,
  `    setExplorePostList([]);
    resetShopWorkspace();
    setArtistPortfolioItems([]);`
);

{
  const start = src.indexOf("  async function toggleFollowShop(shop) {");
  const end = src.indexOf("  function openPublicArtistWork(item) {");
  must(start > 0 && end > start, "toggleFollowShop block missing");
  const replacement = `  async function toggleFollowShop(shop) {
    if (!shop?.id) return;
    const key = String(shop.id);
    const nextFollowed = !(followedArtists.includes(key) || followedSalons.includes(key));
    setFollowedArtists((items) => (
      nextFollowed ? [...items.filter((item) => item !== key), key] : items.filter((item) => item !== key)
    ));
    setFollowedSalons((items) => (
      nextFollowed ? [...items.filter((item) => item !== key), key] : items.filter((item) => item !== key)
    ));
    bumpFollowOptimistic(shop.id, nextFollowed ? 1 : -1);
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: shop.id })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "فالو فروشگاه ذخیره نشد.");
        return;
      }
      const followerCount = payload.data?.followerCount ?? payload.data?.follower_count;
      if (followerCount != null) {
        applyFollowCount(shop.id, followerCount);
      }
      setAppToast(
        nextFollowed
          ? \`فروشگاه «\${shop.name}» را دنبال کردی.\`
          : \`دنبال کردن «\${shop.name}» لغو شد.\`
      );
    } catch {
      setAppToast("فالو فروشگاه ذخیره نشد.");
    }
  }

`;
  src = src.slice(0, start) + replacement + src.slice(end);
}

{
  const re = /onShopSelect=\{async \(shop, fetchDetails = false\) => \{\n(?:.|\n)*?\n          \}\}/;
  must(re.test(src), "onShopSelect block missing");
  src = src.replace(re, "onShopSelect={selectShop}");
}

fs.writeFileSync(path, src.replace(/\n/g, "\r\n"));
const afterLines = fs.readFileSync(path, "utf8").split(/\r?\n/).length;
console.log("after lines", afterLines);
console.log("delta", afterLines - beforeLines);

must(src.includes("useShopWorkspace"), "hook missing after write");
must(!src.includes("async function refreshShopDirectory"), "refreshShopDirectory still defined");
must(!src.includes("async function refreshShopWorkspace"), "refreshShopWorkspace still defined");
must(!src.includes("function addToShopCart"), "addToShopCart still defined");
must(src.includes("function getOwnerInbox"), "getOwnerInbox accidentally removed");
must(src.includes("function openShopOwnerChat"), "openShopOwnerChat accidentally removed");
must(!/\bmapShopCard\b/.test(src), "mapShopCard still referenced");
console.log("sanity ok");
