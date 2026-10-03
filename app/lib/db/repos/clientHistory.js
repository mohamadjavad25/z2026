/**
 * Group rows into "same client" histories without comparing every pair.
 *
 * Two rows are the same client when ANY of user id / phone / name matches
 * (the rule the per-pair `sameXClient` helpers expressed). Indexing rows by
 * each key once makes building every row's history O(n * matches) instead of
 * O(n^2) -- which mattered for salons with thousands of bookings.
 *
 * `keysOf(row)` returns { userId, phone, name } (any may be falsy).
 * Returns a function row -> array of all rows that are the same client
 * (including the row itself), de-duplicated, in the original row order.
 */
export function buildClientHistoryLookup(rows, keysOf) {
  const byUser = new Map();
  const byPhone = new Map();
  const byName = new Map();
  const add = (map, key, index) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(index);
  };
  const keys = rows.map((row) => keysOf(row));
  keys.forEach((key, index) => {
    add(byUser, key.userId ? String(key.userId) : "", index);
    add(byPhone, key.phone, index);
    add(byName, key.name, index);
  });
  return (index) => {
    const key = keys[index];
    const seen = new Set();
    for (const [map, value] of [
      [byUser, key.userId ? String(key.userId) : ""],
      [byPhone, key.phone],
      [byName, key.name]
    ]) {
      if (!value) continue;
      for (const i of map.get(value) || []) seen.add(i);
    }
    return [...seen].sort((a, b) => a - b).map((i) => rows[i]);
  };
}
