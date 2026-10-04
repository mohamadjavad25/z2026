-- Up Migration
-- Thumbnails are stored as data URLs (like the full picture). Earlier ones were raw base64 WebP.
UPDATE posts SET thumb = 'data:image/webp;base64,' || thumb WHERE thumb <> '' AND thumb NOT LIKE 'data:%';

-- Down Migration
UPDATE posts SET thumb = substring(thumb from 24) WHERE thumb LIKE 'data:image/webp;base64,%';
