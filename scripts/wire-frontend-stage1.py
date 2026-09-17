# -*- coding: utf-8 -*-
"""Wire page.jsx to multi-user APIs and strip demo content."""
from pathlib import Path
import re

path = Path(r"C:\Users\novin\Desktop\zibaban\app\page.jsx")
text = path.read_text(encoding="utf-8")
original = text


def replace_const_array(name, replacement):
    global text
    pattern = rf"const {name} = \["
    m = re.search(pattern, text)
    if not m:
        print("MISS array", name)
        return
    start = m.start()
    i = m.end() - 1  # at '['
    depth = 0
    while i < len(text):
        ch = text[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                # include trailing semicolon if present
                if end < len(text) and text[end] == ";":
                    end += 1
                text = text[:start] + replacement + text[end:]
                print("emptied", name)
                return
        i += 1
    print("FAIL bracket", name)


def replace_const_object(name, replacement):
    global text
    pattern = rf"const {name} = \{{"
    m = re.search(pattern, text)
    if not m:
        print("MISS object", name)
        return
    start = m.start()
    i = m.end() - 1
    depth = 0
    while i < len(text):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(text) and text[end] == ";":
                    end += 1
                text = text[:start] + replacement + text[end:]
                print("emptied obj", name)
                return
        i += 1
    print("FAIL obj", name)


# Empty demo content arrays/objects
for name in [
    "initialArtistServices",
    "initialArtistPortfolioItems",
    "initialArtistBookings",
    "artistReviews",
    "initialShopProducts",
    "shopOrders",
    "shopSalesInsights",
    "salonDetailTeam",
    "salonDetailPortfolio",
    "explorePosts",
    "shopStorefrontCatalog",
    "shopOwnerInbox",
    "artistOwnerInbox",
    "shopStorefrontReviews",
    "cosmeticShops",
    "reservationRequests",
]:
    replace_const_array(name, f"const {name} = [];")

replace_const_object("exploreArtistCatalog", "const exploreArtistCatalog = {};")
replace_const_object("publicArtistServicePresets", "const publicArtistServicePresets = {};")

# Prefer live services from API artist payload
old_gps = """function getPublicArtistServices(artist) {
  const role = String(artist?.role || "");
  return publicArtistServicePresets[role] || publicArtistServiceFallback;
}"""
new_gps = """function getPublicArtistServices(artist) {
  if (Array.isArray(artist?.services) && artist.services.length) {
    return artist.services.map((service) => ({
      ...service,
      id: service.id || `svc-${service.name}`,
      tone: service.tone || "soft"
    }));
  }
  const role = String(artist?.role || "");
  return publicArtistServicePresets[role] || publicArtistServiceFallback;
}"""
if old_gps in text:
    text = text.replace(old_gps, new_gps)
    print("patched getPublicArtistServices")
else:
    print("MISS getPublicArtistServices")

# Helper mappers after AUTH_SESSION_KEY
helpers = '''
function mapExplorePost(post) {
  if (!post) return null;
  return {
    id: post.id,
    title: post.title,
    salon: post.salon || post.ownerName || "",
    area: post.ownerArea || post.area || "",
    tag: post.tag || "",
    meta: post.caption || post.meta || "",
    saves: post.saves || "۰",
    views: post.views || "۰",
    rating: post.rating || "",
    comments: post.comments || "۰",
    color: post.color || "teal",
    badge: post.badge || (post.featured ? "ویترین" : ""),
    tile: post.tile || "tile4",
    image: post.image || "",
    ownerUserId: post.ownerUserId,
    ownerType: post.ownerType || "",
    caption: post.caption || "",
    inExplore: post.inExplore !== false,
    featured: Boolean(post.featured)
  };
}

function mapPortfolioItem(post) {
  if (!post) return null;
  return {
    id: post.id,
    title: post.title || "",
    tag: post.tag || "",
    saves: post.saves || "۰",
    views: post.views || "۰",
    rating: post.rating || "",
    image: post.image || "",
    caption: post.caption || "",
    inExplore: Boolean(post.inExplore),
    featured: Boolean(post.featured)
  };
}

function mapShopCard(shop) {
  if (!shop) return null;
  return {
    id: shop.id,
    name: shop.name || "",
    area: shop.area || "",
    category: shop.category || "ترکیبی",
    rating: shop.rating || "",
    products: shop.productCount ? String(shop.productCount) : "۰",
    delivery: shop.delivery || "ارسال هماهنگ",
    badge: shop.badge || "",
    image: shop.avatar || shop.image || "/ad-rose-velvet.png",
    tone: shop.tone || "shopRose",
    about: shop.bio || shop.about || "",
    followers: shop.followers || "۰",
    orders: shop.orders || "۰",
    eta: shop.eta || "",
    phone: shop.phone || "",
    email: shop.email || ""
  };
}

function mapShopProduct(product) {
  if (!product) return null;
  const stock = Number(product.stock || 0);
  return {
    id: product.id,
    name: product.name || "",
    category: product.category || "میکاپ",
    price: product.price || "",
    priceNum: Number(product.priceNum || 0),
    stock,
    sold: product.sold || 0,
    badge: product.badge || "",
    image: product.image || "",
    description: product.description || "",
    featured: Boolean(product.featured),
    tone: product.tone || getShopProductTone(stock)
  };
}

function mapArtistBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    time: row.time || "",
    date: row.booking_date || row.date || "",
    client: row.client_name || row.client || "",
    phone: row.client_phone || row.phone || "",
    service: row.service || "",
    status: row.status || "تایید",
    history: row.history || "day",
    visits: Array.isArray(row.visits) ? row.visits : [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
  };
}
'''

anchor = 'const AUTH_SESSION_KEY = "zibaban_session";'
if anchor in text and "function mapExplorePost" not in text:
    text = text.replace(anchor, helpers + "\n" + anchor, 1)
    print("inserted helpers")
else:
    print("helpers skip")

# State: replace initial values and add new state vars near shopCatalog
text = text.replace(
    "const [shopCatalog, setShopCatalog] = useState(initialShopProducts);",
    """const [shopCatalog, setShopCatalog] = useState([]);
  const [shopOrderList, setShopOrderList] = useState([]);
  const [shopDirectory, setShopDirectory] = useState([]);
  const [explorePostList, setExplorePostList] = useState([]);
  const [artistReviewList, setArtistReviewList] = useState([]);"""
)

text = text.replace(
    "const [savedPostTitles, setSavedPostTitles] = useState([\n    \"فرنچ کروم صورتی کوتاه\",\n    \"بالیاژ کاراملی نرم\",\n    \"میکاپ نود گلوئی\"\n  ]);",
    "const [savedPostTitles, setSavedPostTitles] = useState([]);"
)

text = text.replace(
    "const [artistPortfolioItems, setArtistPortfolioItems] = useState(initialArtistPortfolioItems);",
    "const [artistPortfolioItems, setArtistPortfolioItems] = useState([]);"
)
text = text.replace(
    "const [artistBookingList, setArtistBookingList] = useState(initialArtistBookings);",
    "const [artistBookingList, setArtistBookingList] = useState([]);"
)
text = text.replace(
    "const [artistServiceList, setArtistServiceList] = useState(initialArtistServices);",
    "const [artistServiceList, setArtistServiceList] = useState([]);"
)

# Memos using explorePosts / cosmeticShops / shopOrders
text = text.replace(
    "const all = [...publishedAiPosts, ...explorePosts];\n    return all.filter((post) => savedPostTitles.includes(post.title));\n  }, [savedPostTitles, publishedAiPosts]);",
    "const all = [...publishedAiPosts, ...explorePostList];\n    return all.filter((post) => savedPostTitles.includes(post.title) || (post.id && savedPostTitles.includes(String(post.id))));\n  }, [savedPostTitles, publishedAiPosts, explorePostList]);"
)
text = text.replace(
    "const all = [...publishedAiPosts, ...explorePosts];\n    if (exploreCategory === \"همه\") return all;\n    return all.filter((post) => post.tag === exploreCategory);\n  }, [exploreCategory, publishedAiPosts]);",
    "const all = [...publishedAiPosts, ...explorePostList];\n    if (exploreCategory === \"همه\") return all;\n    return all.filter((post) => post.tag === exploreCategory);\n  }, [exploreCategory, publishedAiPosts, explorePostList]);"
)
text = text.replace(
    "const all = [...publishedAiPosts, ...explorePosts];\n    return all.filter((post) => post.salon === selectedPublicArtist.name);\n  }, [selectedPublicArtist, publishedAiPosts]);",
    """const fromArtist = Array.isArray(selectedPublicArtist.posts)
      ? selectedPublicArtist.posts.map(mapExplorePost)
      : [];
    if (fromArtist.length) return fromArtist;
    const all = [...publishedAiPosts, ...explorePostList];
    return all.filter((post) => post.salon === selectedPublicArtist.name || post.ownerUserId === selectedPublicArtist.id);
  }, [selectedPublicArtist, publishedAiPosts, explorePostList]);"""
)
text = text.replace(
    """const visibleShops = useMemo(() => {
    if (shopCategory === "همه") return cosmeticShops;
    return cosmeticShops.filter((shop) => shop.category === shopCategory);
  }, [shopCategory]);""",
    """const visibleShops = useMemo(() => {
    if (shopCategory === "همه") return shopDirectory;
    return shopDirectory.filter((shop) => shop.category === shopCategory);
  }, [shopCategory, shopDirectory]);"""
)

# selectedShopCatalog should use shop products from selected shop or storefront empty
text = text.replace(
    """const selectedShopCatalog = useMemo(() => {
    if (!selectedShop) return shopStorefrontCatalog;
    const preferred = shopStorefrontCatalog.filter((item) => item.category === selectedShop.category);
    const rest = shopStorefrontCatalog.filter((item) => item.category !== selectedShop.category);
    const catalog = preferred.length ? [...preferred, ...rest] : shopStorefrontCatalog;
    if (shopStoreFilter === "همه") return catalog;
    return catalog.filter((item) => item.category === shopStoreFilter);
  }, [selectedShop, shopStoreFilter]);""",
    """const selectedShopCatalog = useMemo(() => {
    const catalog = Array.isArray(selectedShop?.products) && selectedShop.products.length
      ? selectedShop.products.map(mapShopProduct)
      : shopCatalog.filter((item) => !selectedShop || true);
    const scoped = selectedShop?.products
      ? selectedShop.products.map(mapShopProduct)
      : [];
    const list = scoped.length ? scoped : [];
    if (shopStoreFilter === "همه") return list;
    return list.filter((item) => item.category === shopStoreFilter);
  }, [selectedShop, shopStoreFilter, shopCatalog]);"""
)

# Replace shopOrders references with shopOrderList
text = text.replace("shopOrders.", "shopOrderList.")
text = text.replace("shopOrders)", "shopOrderList)")
text = text.replace("{shopOrders.", "{shopOrderList.")
# artistReviews -> artistReviewList
text = text.replace("artistReviews.map", "artistReviewList.map")
text = text.replace("artistReviews.length", "artistReviewList.length")

# Fix saveAiCreation explorePosts reference
text = text.replace(
    "!explorePosts.some((item) => item.title === title)",
    "!explorePostList.some((item) => item.title === title)"
)

path.write_text(text, encoding="utf-8")
print("wrote stage1", "changed" if text != original else "NO CHANGE")
print("len", len(text))
