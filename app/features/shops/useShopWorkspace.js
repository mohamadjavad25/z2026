"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createShopCategory,
  createShopOrder,
  createShopProduct,
  deleteShopCategory as apiDeleteShopCategory,
  deleteShopProduct,
  getShop,
  getShopCategories,
  getShopMe,
  getShops,
  moveShopCategory as apiMoveShopCategory,
  renameShopCategory as apiRenameShopCategory,
  activateShopPromoCard as apiActivateShopPromoCard,
  createShopPromoCard as apiCreateShopPromoCard,
  deleteShopPromoCard as apiDeleteShopPromoCard,
  getShopPromoCards,
  updateShopOrderStatus,
  updateShopProduct
} from "../../shared/api/shops";
import { notifyFromResponse } from "../../shared/lib/apiNotify";
import { formatToman, formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import {
  mapShopCard,
  mapShopOrder,
  mapShopProduct,
  resolveShopProductBadge,
  shopProductAspectPresets,
  shopProductEnhancePresets
} from "./mappers";
import { renderShopProductCanvas } from "./productImage";

/**
 * Shop domain workspace: directory, storefront cart, and owner catalog CRUD.
 * Chat (customer↔shop and the owner inbox alike) lives in the app-wide
 * app/features/chat/useChat.js hook, not here — see its own conversations
 * API (app/lib/db/repos/messages.js).
 *
 * @param {{ createdProfile?: { id?: number, type?: string } | null, activeTab?: string, onNotice?: (msg: string) => void }} options
 */
export function useShopWorkspace({
  createdProfile = null,
  activeTab = "profile",
  onNotice
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [shopDirectory, setShopDirectory] = useState([]);
  const [shopCatalog, setShopCatalog] = useState([]);
  const [shopStockMovements, setShopStockMovements] = useState([]);
  const [shopCategories, setShopCategories] = useState([]);
  const [shopCategoryBusy, setShopCategoryBusy] = useState(false);
  const [shopPromoCards, setShopPromoCards] = useState([]);
  const [shopPromoCardBusy, setShopPromoCardBusy] = useState(false);
  const [shopWorkspaceLoading, setShopWorkspaceLoading] = useState(true);
  const [shopStoreLoading, setShopStoreLoading] = useState(false);
  const [shopOrderBusy, setShopOrderBusy] = useState(false);
  const shopOrderBusyRef = useRef(false);
  const [shopOrderList, setShopOrderList] = useState([]);
  const [shopOrderStatusBusyId, setShopOrderStatusBusyId] = useState(null);
  const [shopCategory, setShopCategory] = useState("همه");
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopStoreFilter, setShopStoreFilter] = useState("همه");
  const [shopProductSheetOpen, setShopProductSheetOpen] = useState(false);
  const [editingShopProduct, setEditingShopProduct] = useState(null);
  const [viewingShopProduct, setViewingShopProduct] = useState(null);
  const [shopProductDefaultCategory, setShopProductDefaultCategory] = useState("");
  const [shopProductImage, setShopProductImage] = useState("");
  const [shopProductImageOriginal, setShopProductImageOriginal] = useState("");
  const [shopProductEnhanceTab, setShopProductEnhanceTab] = useState("");
  const [shopProductEnhanceBusy, setShopProductEnhanceBusy] = useState(false);
  const [shopProductActiveEnhance, setShopProductActiveEnhance] = useState("");
  const [shopProductActiveAspect, setShopProductActiveAspect] = useState("");
  const [shopCart, setShopCart] = useState([]);
  const [shopCartOpen, setShopCartOpen] = useState(false);

  const shopProductsRef = useRef(null);
  const shopReviewsRailRef = useRef(null);

  const visibleShops = useMemo(() => {
    if (shopCategory === "همه") return shopDirectory;
    return shopDirectory.filter((shop) => shop.category === shopCategory);
  }, [shopCategory, shopDirectory]);

  const selectedShopCatalog = useMemo(() => {
    // Directory cards use `products` as a count string (mapShopCard). Detail fetch fills `productItems`.
    const productRows = Array.isArray(selectedShop?.productItems) ? selectedShop.productItems : null;
    const list = productRows
      ? productRows.map(mapShopProduct).filter(Boolean)
      : (selectedShop ? [] : shopCatalog);
    if (shopStoreFilter === "همه") return list;
    return list.filter((item) => item.category === shopStoreFilter);
  }, [selectedShop, shopStoreFilter, shopCatalog]);

  const currentShopCart = useMemo(() => {
    if (!selectedShop) return [];
    return shopCart.filter((item) => item.shopName === selectedShop.name);
  }, [shopCart, selectedShop]);

  const shopCartSummary = useMemo(() => {
    const count = currentShopCart.reduce((sum, item) => sum + item.qty, 0);
    const total = currentShopCart.reduce((sum, item) => sum + item.priceNum * item.qty, 0);
    return { count, total };
  }, [currentShopCart]);

  const refreshShopDirectory = useCallback(async () => {
    try {
      const { ok, data, payload } = await getShops();
      if (!ok) return;
      const shops = (data?.shops || payload?.shops || []).map(mapShopCard).filter(Boolean);
      setShopDirectory(shops);
    } catch {
      // keep current shops
    }
  }, []);

  const refreshShopWorkspace = useCallback(async () => {
    try {
      const { ok, data } = await getShopMe();
      if (!ok) return;
      setShopCatalog((data?.products || []).map(mapShopProduct).filter(Boolean));
      setShopOrderList((data?.orders || []).map(mapShopOrder).filter(Boolean));
      setShopStockMovements(Array.isArray(data?.stockMovements) ? data.stockMovements : []);
    } catch {
      // ignore
    } finally {
      setShopWorkspaceLoading(false);
    }
  }, []);

  const refreshShopCategories = useCallback(async () => {
    try {
      const { ok, data } = await getShopCategories();
      if (!ok) return;
      setShopCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch {
      // keep current categories
    }
  }, []);

  /** POST /api/shop/categories — real create; optimistic with rollback on failure. */
  const addShopCategory = useCallback(async (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed || shopCategoryBusy) return false;
    if (shopCategories.some((category) => category.name === trimmed)) {
      notify("این دسته از قبل وجود دارد.");
      return false;
    }
    setShopCategoryBusy(true);
    const tempId = `temp-${Date.now()}`;
    setShopCategories((prev) => [...prev, { id: tempId, name: trimmed }]);
    try {
      const { ok, payload } = await createShopCategory(trimmed);
      if (!ok) {
        setShopCategories((prev) => prev.filter((category) => category.id !== tempId));
        notify(payload?.error || "ایجاد دسته انجام نشد.");
        return false;
      }
      setShopCategories((prev) => prev.map((category) => (
        category.id === tempId ? payload.data.category : category
      )));
      notify(`دسته «${trimmed}» ایجاد شد.`);
      return true;
    } catch {
      setShopCategories((prev) => prev.filter((category) => category.id !== tempId));
      notify("ایجاد دسته انجام نشد.");
      return false;
    } finally {
      setShopCategoryBusy(false);
    }
  }, [shopCategories, shopCategoryBusy, notify]);

  /** PATCH /api/shop/categories (name) — real rename; also relabels every product under it server-side. */
  const renameShopCategory = useCallback(async (id, name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed || shopCategoryBusy) return false;
    const previous = shopCategories;
    setShopCategoryBusy(true);
    setShopCategories((prev) => prev.map((category) => (category.id === id ? { ...category, name: trimmed } : category)));
    try {
      const { ok, payload } = await apiRenameShopCategory(id, trimmed);
      if (!ok) {
        setShopCategories(previous);
        notify(payload?.error || "تغییر نام دسته انجام نشد.");
        return false;
      }
      await refreshShopWorkspace();
      notify("نام دسته به‌روزرسانی شد.");
      return true;
    } catch {
      setShopCategories(previous);
      notify("تغییر نام دسته انجام نشد.");
      return false;
    } finally {
      setShopCategoryBusy(false);
    }
  }, [shopCategories, shopCategoryBusy, notify, refreshShopWorkspace]);

  /** PATCH /api/shop/categories (direction) — one-step reorder; optimistic with rollback on failure. */
  const moveShopCategory = useCallback(async (id, direction) => {
    if (shopCategoryBusy) return;
    const previous = shopCategories;
    const index = previous.findIndex((category) => category.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= previous.length) return;
    const next = [...previous];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setShopCategoryBusy(true);
    setShopCategories(next);
    try {
      const { ok, payload } = await apiMoveShopCategory(id, direction);
      if (!ok) {
        setShopCategories(previous);
        notify(payload?.error || "جابه‌جایی دسته انجام نشد.");
      }
    } catch {
      setShopCategories(previous);
      notify("جابه‌جایی دسته انجام نشد.");
    } finally {
      setShopCategoryBusy(false);
    }
  }, [shopCategories, shopCategoryBusy, notify]);

  /** DELETE /api/shop/categories — server refuses (409) while the category still has products. */
  const removeShopCategory = useCallback(async (id) => {
    if (shopCategoryBusy) return false;
    const target = shopCategories.find((category) => category.id === id);
    if (typeof window !== "undefined" && !window.confirm(target ? `دسته «${target.name}» حذف شود؟` : "این دسته حذف شود؟")) {
      return false;
    }
    const previous = shopCategories;
    setShopCategoryBusy(true);
    setShopCategories((prev) => prev.filter((category) => category.id !== id));
    try {
      const { ok, payload } = await apiDeleteShopCategory(id);
      if (!ok) {
        setShopCategories(previous);
        notify(payload?.error || "حذف دسته انجام نشد.");
        return false;
      }
      notify(target ? `دسته «${target.name}» حذف شد.` : "دسته حذف شد.");
      return true;
    } catch {
      setShopCategories(previous);
      notify("حذف دسته انجام نشد.");
      return false;
    } finally {
      setShopCategoryBusy(false);
    }
  }, [shopCategories, shopCategoryBusy, notify]);

  const refreshShopPromoCards = useCallback(async () => {
    try {
      const { ok, data } = await getShopPromoCards();
      if (!ok) return;
      setShopPromoCards(Array.isArray(data?.cards) ? data.cards : []);
    } catch {
      // keep current list
    }
  }, []);

  /** POST /api/shop/promo-card — adds a new card to the shop's library (auto-active only if it's the first one). */
  const createShopPromoCardEntry = useCallback(async ({ icon, tone, primary, secondary }) => {
    if (shopPromoCardBusy) return false;
    setShopPromoCardBusy(true);
    try {
      const { ok, payload } = await apiCreateShopPromoCard({ icon, tone, primary, secondary });
      if (!ok) {
        notify(payload?.error || "ذخیره کارت انجام نشد.");
        return false;
      }
      await refreshShopPromoCards();
      notify("کارت ویژه ذخیره شد.");
      return true;
    } catch {
      notify("ذخیره کارت انجام نشد.");
      return false;
    } finally {
      setShopPromoCardBusy(false);
    }
  }, [shopPromoCardBusy, notify, refreshShopPromoCards]);

  /** PATCH /api/shop/promo-card — makes one card active; optimistic with rollback on failure. */
  const activateShopPromoCardEntry = useCallback(async (id) => {
    if (shopPromoCardBusy) return false;
    const previous = shopPromoCards;
    setShopPromoCardBusy(true);
    setShopPromoCards((prev) => prev.map((card) => ({ ...card, active: card.id === id })));
    try {
      const { ok, payload } = await apiActivateShopPromoCard(id);
      if (!ok) {
        setShopPromoCards(previous);
        notify(payload?.error || "فعال کردن کارت انجام نشد.");
        return false;
      }
      return true;
    } catch {
      setShopPromoCards(previous);
      notify("فعال کردن کارت انجام نشد.");
      return false;
    } finally {
      setShopPromoCardBusy(false);
    }
  }, [shopPromoCards, shopPromoCardBusy, notify]);

  /** DELETE /api/shop/promo-card — optimistic with rollback on failure. */
  const removeShopPromoCard = useCallback(async (id) => {
    if (shopPromoCardBusy) return false;
    const previous = shopPromoCards;
    setShopPromoCardBusy(true);
    setShopPromoCards((prev) => prev.filter((card) => card.id !== id));
    try {
      const { ok, payload } = await apiDeleteShopPromoCard(id);
      if (!ok) {
        setShopPromoCards(previous);
        notify(payload?.error || "حذف کارت انجام نشد.");
        return false;
      }
      notify("کارت ویژه حذف شد.");
      return true;
    } catch {
      setShopPromoCards(previous);
      notify("حذف کارت انجام نشد.");
      return false;
    } finally {
      setShopPromoCardBusy(false);
    }
  }, [shopPromoCards, shopPromoCardBusy, notify]);

  const resetShopWorkspace = useCallback(() => {
    setShopDirectory([]);
    setShopCatalog([]);
    setShopStockMovements([]);
    setShopCategories([]);
    setShopPromoCards([]);
    setShopWorkspaceLoading(true);
    setShopStoreLoading(false);
    setShopOrderList([]);
    setSelectedShop(null);
    setShopStoreFilter("همه");
    setShopCategory("همه");
    setShopCart([]);
    setShopCartOpen(false);
    setShopProductSheetOpen(false);
    setEditingShopProduct(null);
    setViewingShopProduct(null);
    setShopProductImage("");
    setShopProductImageOriginal("");
  }, []);

  /** Caps at real stock when it's a known finite number — still re-checked atomically server-side at checkout either way. */
  const clampToStock = useCallback((qty, stock) => (
    Number.isFinite(Number(stock)) ? Math.min(qty, Math.max(0, Number(stock))) : qty
  ), []);

  const addToShopCart = useCallback((product) => {
    if (!selectedShop) return;
    setShopCart((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.shopName === selectedShop.name);
      if (existing) {
        const nextQty = clampToStock(existing.qty + 1, product.stock);
        if (nextQty === existing.qty) {
          notify(`موجودی «${product.name}» بیشتر از این نیست.`);
          return prev;
        }
        return prev.map((item) => (
          item.id === product.id && item.shopName === selectedShop.name
            ? { ...item, qty: nextQty }
            : item
        ));
      }
      // clampToStock(1, 0) correctly returns 0 for a sold-out product — must
      // refuse the add here, not fall back to `|| 1`, which would silently
      // treat that legitimate zero as "stock unknown" and add it anyway.
      const initialQty = clampToStock(1, product.stock);
      if (initialQty <= 0) {
        notify(`«${product.name}» موجود نیست.`);
        return prev;
      }
      return [...prev, { id: product.id, product, qty: initialQty, priceNum: product.priceNum, shopName: selectedShop.name }];
    });
  }, [selectedShop, clampToStock, notify]);

  const updateShopCartQty = useCallback((productId, delta) => {
    if (!selectedShop) return;
    setShopCart((prev) => prev
      .map((item) => (
        item.id === productId && item.shopName === selectedShop.name
          ? { ...item, qty: delta > 0 ? clampToStock(item.qty + delta, item.product?.stock) : item.qty + delta }
          : item
      ))
      .filter((item) => item.qty > 0));
  }, [selectedShop, clampToStock]);

  /** POST /api/shop/orders — real checkout; toast only on success. */
  const submitShopOrder = useCallback(async () => {
    if (!selectedShop || !currentShopCart.length) return;
    if (shopOrderBusyRef.current) return;
    shopOrderBusyRef.current = true;
    setShopOrderBusy(true);
    try {
      const overStock = currentShopCart.find((item) => {
        const stock = Number(item.product?.stock);
        return Number.isFinite(stock) && stock >= 0 && item.qty > stock;
      });
      if (overStock) {
        notify(`موجودی «${overStock.product?.name || "محصول"}» کافی نیست.`);
        return;
      }

      const result = await createShopOrder({
        shopUserId: selectedShop.id,
        items: currentShopCart.map((item) => ({
          productId: item.id,
          name: item.product?.name || "",
          quantity: item.qty,
          price: item.product?.price || formatToman(item.priceNum),
          priceNum: item.priceNum
        })),
        total: formatToman(shopCartSummary.total),
        totalNum: shopCartSummary.total,
        // buyerName/buyerPhone come from the server's own session now —
        // the client can't set someone else's identity on an order.
        // Lets the server dedupe this exact checkout attempt if it ever
        // reaches it twice (network retry, or a click that slips past
        // shopOrderBusyRef) instead of placing the order twice.
        idempotencyKey: crypto.randomUUID()
      });

      if (!notifyFromResponse(notify, result, {
        success: `سفارش ${shopCartSummary.count} آیتم از ${selectedShop.name} ثبت شد.`,
        failure: "ثبت سفارش انجام نشد؛ دوباره امتحان کن."
      })) {
        return;
      }

      setShopCart((prev) => prev.filter((item) => item.shopName !== selectedShop.name));
      setShopCartOpen(false);
    } catch {
      notify("ثبت سفارش انجام نشد؛ دوباره امتحان کن.");
    } finally {
      shopOrderBusyRef.current = false;
      setShopOrderBusy(false);
    }
  }, [
    selectedShop,
    currentShopCart,
    shopCartSummary.count,
    shopCartSummary.total,
    notify
  ]);

  const closeShopStorefront = useCallback(() => {
    setSelectedShop(null);
    setShopStoreFilter("همه");
    setShopCartOpen(false);
  }, []);

  const openShopProductSheet = useCallback((product = null, defaultCategory = "") => {
    setEditingShopProduct(product);
    setShopProductDefaultCategory(defaultCategory);
    const image = product?.image || "";
    setShopProductImage(image);
    setShopProductImageOriginal(image);
    setShopProductEnhanceTab("");
    setShopProductActiveEnhance("");
    setShopProductActiveAspect("");
    setShopProductSheetOpen(true);
  }, []);

  const closeShopProductSheet = useCallback(() => {
    setShopProductSheetOpen(false);
    setEditingShopProduct(null);
    setShopProductDefaultCategory("");
    setShopProductImage("");
    setShopProductImageOriginal("");
    setShopProductEnhanceTab("");
    setShopProductActiveEnhance("");
    setShopProductActiveAspect("");
    setShopProductEnhanceBusy(false);
  }, []);

  const handleShopProductImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("فقط فایل تصویری مجاز است.");
      return;
    }
    // Matches the server's ~4MB cap on the base64 data URL (checked early,
    // before reading the whole file and letting the user fill out the rest
    // of the form, only to be rejected at submit).
    if (file.size > 3 * 1024 * 1024) {
      notify("حجم تصویر بیشتر از حد مجاز است؛ عکس سبک‌تری انتخاب کن.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setShopProductImage(result);
      setShopProductImageOriginal(result);
      setShopProductEnhanceTab("quality");
      setShopProductActiveEnhance("");
      setShopProductActiveAspect("");
    };
    reader.readAsDataURL(file);
  }, [notify]);

  const clearShopProductImage = useCallback(() => {
    setShopProductImage("");
    setShopProductImageOriginal("");
    setShopProductEnhanceTab("");
    setShopProductActiveEnhance("");
    setShopProductActiveAspect("");
  }, []);

  const applyShopProductEnhance = useCallback(async (presetId) => {
    if (!shopProductImageOriginal || shopProductEnhanceBusy) return;
    const preset = shopProductEnhancePresets.find((item) => item.id === presetId);
    if (!preset) return;
    setShopProductEnhanceBusy(true);
    try {
      const aspect = shopProductAspectPresets.find((item) => item.id === shopProductActiveAspect)?.value || null;
      const next = await renderShopProductCanvas(shopProductImageOriginal, {
        filter: preset.filter,
        aspect
      });
      setShopProductImage(next);
      setShopProductActiveEnhance(presetId);
    } catch {
      notify("اعمال فیلتر تصویر انجام نشد.");
    } finally {
      setShopProductEnhanceBusy(false);
    }
  }, [shopProductImageOriginal, shopProductEnhanceBusy, shopProductActiveAspect, notify]);

  const applyShopProductAspect = useCallback(async (aspectId) => {
    if (!shopProductImageOriginal || shopProductEnhanceBusy) return;
    const preset = shopProductAspectPresets.find((item) => item.id === aspectId);
    if (!preset) return;
    setShopProductEnhanceBusy(true);
    try {
      const filter = shopProductEnhancePresets.find((item) => item.id === shopProductActiveEnhance)?.filter || "none";
      const next = await renderShopProductCanvas(shopProductImageOriginal, {
        filter,
        aspect: preset.value
      });
      setShopProductImage(next);
      setShopProductActiveAspect(aspectId);
    } catch {
      notify("برش تصویر انجام نشد.");
    } finally {
      setShopProductEnhanceBusy(false);
    }
  }, [shopProductImageOriginal, shopProductEnhanceBusy, shopProductActiveEnhance, notify]);

  const resetShopProductImageEdits = useCallback(async () => {
    if (!shopProductImageOriginal) return;
    setShopProductImage(shopProductImageOriginal);
    setShopProductActiveEnhance("");
    setShopProductActiveAspect("");
  }, [shopProductImageOriginal]);

  const saveShopProduct = useCallback(async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    const priceInput = String(data.price || "").trim();
    const description = String(data.description || "").trim();
    const stock = Math.max(0, Number(data.stock) || 0);
    if (!name || !priceInput) {
      notify("نام و قیمت محصول لازم است.");
      return;
    }
    if (!shopProductImage) {
      notify("برای محصول یک تصویر آپلود کن.");
      return;
    }
    const priceNum = parseTomanAmount(priceInput);
    const badge = resolveShopProductBadge(String(data.badge || ""), stock);
    const body = {
      id: editingShopProduct?.id,
      name,
      category: String(data.category || "میکاپ"),
      // Store the clean formatted display string (e.g. "۷۵,۰۰۰"), never the
      // raw typed input — every product card/detail/cart line renders this
      // field verbatim with no reformatting, so an unformatted "75000" would
      // show up bare (wrong digits, no thousands separator) everywhere.
      price: formatTomanNumber(priceNum),
      priceNum,
      stock,
      badge,
      image: shopProductImage,
      description,
      featured: Boolean(data.featured)
    };
    try {
      const { ok, payload } = editingShopProduct
        ? await updateShopProduct(body)
        : await createShopProduct(body);
      if (!ok) {
        notify(payload.error || "ذخیره محصول انجام نشد.");
        return;
      }
      await refreshShopWorkspace();
      const nextProduct = mapShopProduct(payload.data?.product) || body;
      setViewingShopProduct(nextProduct);
      notify(editingShopProduct ? `${name} به‌روزرسانی شد.` : `${name} به کاتالوگ اضافه شد.`);
      closeShopProductSheet();
    } catch {
      notify("ذخیره محصول انجام نشد.");
    }
  }, [shopProductImage, editingShopProduct, notify, refreshShopWorkspace, closeShopProductSheet]);

  const openShopProductDetail = useCallback((product) => {
    setViewingShopProduct(product);
  }, []);

  const closeShopProductDetail = useCallback(() => {
    setViewingShopProduct(null);
  }, []);

  const editShopProductFromDetail = useCallback((product) => {
    setViewingShopProduct(null);
    openShopProductSheet(product);
  }, [openShopProductSheet]);

  const deleteShopProductById = useCallback(async (productId) => {
    const target = shopCatalog.find((item) => item.id === productId);
    const confirmed = typeof window === "undefined"
      || window.confirm(target ? `«${target.name}» از کاتالوگ حذف شود؟ این کار قابل بازگشت نیست.` : "این محصول حذف شود؟ این کار قابل بازگشت نیست.");
    if (!confirmed) return;
    try {
      const { ok, payload } = await deleteShopProduct(productId);
      if (!ok) {
        notify(payload.error || "حذف محصول انجام نشد.");
        return;
      }
      await refreshShopWorkspace();
      notify(target ? `${target.name} حذف شد.` : "محصول حذف شد.");
      if (editingShopProduct?.id === productId) closeShopProductSheet();
      if (viewingShopProduct?.id === productId) closeShopProductDetail();
    } catch {
      notify("حذف محصول انجام نشد.");
    }
  }, [
    shopCatalog,
    notify,
    refreshShopWorkspace,
    editingShopProduct?.id,
    viewingShopProduct?.id,
    closeShopProductSheet,
    closeShopProductDetail
  ]);

  /** PATCH /api/shop/orders — real status change; optimistic with rollback on failure. */
  const changeShopOrderStatus = useCallback(async (orderId, status) => {
    if (shopOrderStatusBusyId) return;
    if (status === "لغو شده" && typeof window !== "undefined" && !window.confirm("این سفارش لغو شود؟ مشتری دیگر نمی‌تواند آن را دریافت کند.")) {
      return;
    }
    if (status === "مرجوعی شد" && typeof window !== "undefined" && !window.confirm("این سفارش مرجوعی ثبت شود؟ موجودی اقلام آن به انبار برمی‌گردد.")) {
      return;
    }
    const previous = shopOrderList;
    setShopOrderStatusBusyId(orderId);
    setShopOrderList((prev) => prev.map((order) => (
      order.id === orderId ? { ...order, status } : order
    )));
    try {
      const { ok, payload } = await updateShopOrderStatus(orderId, status);
      if (!ok) {
        setShopOrderList(previous);
        notify(payload?.error || "تغییر وضعیت سفارش انجام نشد.");
        return;
      }
      notify(`وضعیت سفارش به «${status}» تغییر کرد.`);
      // Cancel/return restocks the items server-side — pull the fresh catalog
      // and stock-movement trail so the dashboard's numbers match the DB.
      if (status === "لغو شده" || status === "مرجوعی شد") {
        await refreshShopWorkspace();
      }
    } catch {
      setShopOrderList(previous);
      notify("تغییر وضعیت سفارش انجام نشد.");
    } finally {
      setShopOrderStatusBusyId(null);
    }
  }, [shopOrderList, shopOrderStatusBusyId, notify, refreshShopWorkspace]);

  const selectShop = useCallback(async (shop, fetchDetails = false) => {
    setShopStoreFilter("همه");
    const hasPreloadedItems = Array.isArray(shop?.productItems) && shop.productItems.length > 0;
    setSelectedShop(shop ? { ...shop, productItems: Array.isArray(shop.productItems) ? shop.productItems : [] } : null);
    // Directory cards carry only summary fields — every entry path (card click,
    // "مشاهده فروشگاه" button, keyboard) must open the storefront with real data.
    if (shop?.id && (fetchDetails || !hasPreloadedItems)) {
      setShopStoreLoading(true);
      try {
        const { ok, data } = await getShop(shop.id);
        if (ok && data?.shop) {
          const card = mapShopCard(data.shop);
          const productItems = Array.isArray(data.shop.products) ? data.shop.products : [];
          setSelectedShop({
            ...card,
            productItems,
            products: card.products || String(productItems.length),
            categories: Array.isArray(data.shop.categories) ? data.shop.categories : [],
            reviews: Array.isArray(data.shop.reviews) ? data.shop.reviews : [],
            promoCard: data.shop.promoCard || null
          });
        }
      } catch {
        // keep list card
      } finally {
        setShopStoreLoading(false);
      }
    } else {
      setShopStoreLoading(false);
    }
  }, []);

  const applyFollowCount = useCallback((shopId, followerCount) => {
    const key = String(shopId);
    setSelectedShop((current) => (
      current && String(current.id) === key ? { ...current, followers: Number(followerCount) } : current
    ));
    setShopDirectory((items) => items.map((item) => (
      String(item.id) === key ? { ...item, followers: Number(followerCount) } : item
    )));
  }, []);

  const bumpFollowOptimistic = useCallback((shopId, delta) => {
    const key = String(shopId);
    setSelectedShop((current) => {
      if (!current || String(current.id) !== key) return current;
      const currentCount = Number(current.followers || 0);
      return { ...current, followers: Math.max(0, currentCount + delta) };
    });
    setShopDirectory((items) => items.map((item) => {
      if (String(item.id) !== key) return item;
      const currentCount = Number(item.followers || 0);
      return { ...item, followers: Math.max(0, currentCount + delta) };
    }));
  }, []);

  useEffect(() => {
    setShopCartOpen(false);
  }, [selectedShop?.name]);

  useEffect(() => {
    if (activeTab === "shops") return;
    setShopCartOpen(false);
  }, [activeTab]);

  return {
    shopDirectory,
    setShopDirectory,
    shopCatalog,
    setShopCatalog,
    shopStockMovements,
    shopCategories,
    shopCategoryBusy,
    refreshShopCategories,
    addShopCategory,
    renameShopCategory,
    moveShopCategory,
    removeShopCategory,
    shopPromoCards,
    shopPromoCardBusy,
    refreshShopPromoCards,
    createShopPromoCardEntry,
    activateShopPromoCardEntry,
    removeShopPromoCard,
    shopWorkspaceLoading,
    shopStoreLoading,
    shopOrderBusy,
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
    shopProductDefaultCategory,
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
    shopProductsRef,
    shopReviewsRailRef,
    visibleShops,
    selectedShopCatalog,
    currentShopCart,
    shopCartSummary,
    refreshShopDirectory,
    refreshShopWorkspace,
    resetShopWorkspace,
    addToShopCart,
    updateShopCartQty,
    submitShopOrder,
    closeShopStorefront,
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
    deleteShopProduct: deleteShopProductById,
    selectShop,
    applyFollowCount,
    bumpFollowOptimistic,
    changeShopOrderStatus,
    shopOrderStatusBusyId
  };
}
