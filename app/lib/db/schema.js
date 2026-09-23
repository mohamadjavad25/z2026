export function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('client', 'artist', 'salon', 'shop')),
      name TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      experience_years TEXT NOT NULL DEFAULT '',
      manager_name TEXT NOT NULL DEFAULT '',
      last_seen_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    -- sessions.expires_at stores epoch milliseconds as a decimal string (e.g. "1788249600000").

    CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
      pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'shell' CHECK (currency IN ('shell', 'toman')),
      type TEXT NOT NULL DEFAULT 'adjustment',
      status TEXT NOT NULL DEFAULT 'posted',
      note TEXT NOT NULL DEFAULT '',
      ref_type TEXT NOT NULL DEFAULT '',
      ref_id TEXT NOT NULL DEFAULT '',
      balance_after INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallet_bank_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      sheba TEXT NOT NULL DEFAULT '',
      holder_name TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallet_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      fee INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL,
      sheba TEXT NOT NULL DEFAULT '',
      holder_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'paid', 'rejected', 'failed')),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawals(user_id, id DESC);

    -- De-dupes a client-supplied key per user+kind so a retried/duplicated
    -- wallet mutation (demo_credit, withdraw) returns the first response
    -- instead of re-applying its effect. See withIdempotentWalletCall.
    CREATE TABLE IF NOT EXISTS wallet_idempotency_keys (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, kind, key)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      in_explore INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_saves (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS post_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_user_id, target_user_id),
      CHECK (follower_user_id != target_user_id)
    );

    -- Real (server-side) "save" for a salon or independent artist's public
    -- profile — the bookmark button on their page. Same shape/conventions as
    -- follows: both salons and artists are just rows in users
    -- (salons.user_id / users.id with type='artist'), so one table with a
    -- target_user_id covers both kinds; the target's users.type tells a
    -- reader which kind it is. Mirrors post_saves for the composite-PK /
    -- idempotent-toggle convention. Not reused for posts -- that's post_saves.
    CREATE TABLE IF NOT EXISTS saved_profiles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, target_user_id),
      CHECK (user_id != target_user_id)
    );

    -- One row per browser/device a user granted Web Push permission on (see
    -- app/lib/push.js). A user can have several (phone + desktop, two
    -- browsers). endpoint is globally unique — it's the push service's own
    -- per-registration URL, never reused across users/devices.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS artist_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      hint TEXT NOT NULL DEFAULT '',
      badge TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'soft',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artist_breaks (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL DEFAULT '',
      end_time TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artist_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      open_time TEXT NOT NULL DEFAULT '',
      close_time TEXT NOT NULL DEFAULT '',
      capacity INTEGER NOT NULL DEFAULT 8,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(artist_user_id, day)
    );

    CREATE TABLE IF NOT EXISTS artist_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL DEFAULT '',
      client_phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'تازه',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artist_collabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      salon_name TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      days TEXT NOT NULL DEFAULT '',
      from_time TEXT NOT NULL DEFAULT '',
      to_time TEXT NOT NULL DEFAULT '',
      share_percent TEXT NOT NULL DEFAULT '',
      capacity TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'آماده ارسال',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL DEFAULT '',
      rating REAL NOT NULL DEFAULT 5,
      text TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      reply_text TEXT NOT NULL DEFAULT '',
      replied_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(review_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS profile_stories (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      video TEXT NOT NULL DEFAULT '',
      poster TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Real persistence for the profile settings toggles (public/private
    -- storefront, order alerts, etc.) — one JSON blob per user, merged with
    -- defaults in app/lib/db/repos/userSettings.js. Some keys (shop's
    -- publicPortfolio/shippingReady) are read back by shops.js to actually
    -- gate storefront visibility and checkout, not just store a UI toggle.
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shops (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      rating REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL DEFAULT '',
      price_num REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      badge TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Real, ownable categories (not just whatever string sits on a product) —
    -- lets an owner create a category before any product uses it yet, and
    -- keeps a stable creation order for the dashboard/storefront row layout.
    CREATE TABLE IF NOT EXISTS shop_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_user_id, name)
    );

    -- A shop's own library of promo cards (own icon + color, free text) —
    -- owner builds up a list and picks which one is active; only the active
    -- one renders, on both the owner dashboard and the public storefront.
    CREATE TABLE IF NOT EXISTS shop_promo_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      icon_key TEXT NOT NULL,
      tone TEXT NOT NULL,
      primary_text TEXT NOT NULL DEFAULT '',
      secondary_text TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      buyer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      buyer_name TEXT NOT NULL DEFAULT '',
      buyer_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'جدید',
      total TEXT NOT NULL DEFAULT '',
      total_num REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES shop_products(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      price TEXT NOT NULL DEFAULT '',
      price_num REAL NOT NULL DEFAULT 0
    );

    -- Every stock change on a product, with why it happened — sale (order
    -- placed), cancel_restock / return_restock (order cancelled or returned,
    -- stock given back), manual_adjust (owner edited the number by hand), or
    -- product_deleted (remaining stock written off when the product is
    -- removed). Read-only audit trail; nothing here is ever updated in place.
    CREATE TABLE IF NOT EXISTS shop_stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES shop_products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL DEFAULT '',
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      order_id INTEGER REFERENCES shop_orders(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- De-dupes a client-supplied key per buyer so a retried/duplicated
    -- POST /api/shop/orders (network retry, a double-submit that slips past
    -- the client busy-gate, two truly-parallel requests) returns the first
    -- order instead of placing (and stock-decrementing) a second one. Same
    -- pattern as wallet_idempotency_keys — see createOrder in repos/shops.js.
    CREATE TABLE IF NOT EXISTS shop_order_idempotency_keys (
      buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (buyer_user_id, key)
    );

    CREATE TABLE IF NOT EXISTS salons (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL DEFAULT '',
      open TEXT NOT NULL DEFAULT '',
      rating TEXT NOT NULL DEFAULT '',
      match_score TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      post_count INTEGER NOT NULL DEFAULT 0,
      follower_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      hint TEXT NOT NULL DEFAULT '',
      staff_id INTEGER,
      staff_ids TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      tile TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'تازه',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      booked TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      access_level TEXT NOT NULL DEFAULT 'آرتیست',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salon_artist_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      access_level TEXT NOT NULL DEFAULT 'همکار',
      status TEXT NOT NULL DEFAULT 'در انتظار تایید',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(salon_user_id, artist_user_id)
    );

    CREATE TABLE IF NOT EXISTS salon_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      open_time TEXT NOT NULL DEFAULT '',
      close_time TEXT NOT NULL DEFAULT '',
      capacity INTEGER NOT NULL DEFAULT 8,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(salon_user_id, day)
    );

    CREATE TABLE IF NOT EXISTS beauty_passports (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active INTEGER NOT NULL DEFAULT 0,
      skin_tone TEXT NOT NULL DEFAULT '',
      undertone TEXT NOT NULL DEFAULT '',
      face_shape TEXT NOT NULL DEFAULT '',
      hair_type TEXT NOT NULL DEFAULT '',
      signature TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Unified messaging: a conversation is "direct" (exactly 2 members, the
    -- old a_user_id/b_user_id model) or "group" (named, N members) — same
    -- tables serve both, membership lives in conversation_members so a group
    -- can grow/shrink without reshaping the conversation row itself.
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'direct',
      title TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL DEFAULT '',
      attachment_url TEXT NOT NULL DEFAULT '',
      attachment_type TEXT NOT NULL DEFAULT '',
      order_ref_id INTEGER REFERENCES shop_orders(id) ON DELETE SET NULL,
      -- Booking-card message. attachment_type distinguishes which table this
      -- points into ('salon-booking' -> salon_bookings.id, 'artist-booking'
      -- -> artist_bookings.id) — the two source tables have separate id
      -- spaces, so this is NOT a real FK the same way order_ref_id is (SQLite
      -- can't express "FK into table A or table B depending on a sibling
      -- column"); the app layer enforces the pairing. See sendSalonBookingCardMessage
      -- / sendArtistBookingCardMessage in repos/messages.js.
      booking_ref_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_posts_owner ON posts(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_explore ON posts(in_explore, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_review_likes_review ON review_likes(review_id);
    CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_user_id);
    CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON shop_orders(shop_user_id);
    CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_shop_order_items_product ON shop_order_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_shop_stock_movements_shop ON shop_stock_movements(shop_user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_artist_services_user ON artist_services(user_id);
    CREATE INDEX IF NOT EXISTS idx_artist_collabs_artist ON artist_collabs(artist_user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_salon_artist_invites_artist ON salon_artist_invites(artist_user_id, status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_salon_artist_invites_salon ON salon_artist_invites(salon_user_id, status, id DESC);

    -- Backs the booking-conflict/day-listing hot path (listActiveDayBookings
    -- in repos/salons/bookings.js). This index was originally only added via
    -- migrateSalonBookingConflictColumns (migrations.js v12), which never
    -- runs on a brand-new database — ensureSchemaVersion takes the
    -- applySchema-only path when current===0, skipping every migration step.
    -- Mirrored here so a fresh install gets the same index an upgraded DB
    -- already has, instead of silently missing it.
    CREATE INDEX IF NOT EXISTS idx_salon_bookings_day ON salon_bookings (salon_user_id, booking_date, status);
  `);
}
