"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectTo, listConnections, searchConnections } from "../../shared/api/connections";
import { useAppRefresh } from "../../shared/lib/appRefresh";
import { recallSearch, rememberSearch } from "./searchMemory";

const SEARCH_DELAY_MS = 300;

/**
 * State for «سالن و آرتیست من»: the client's connected salons/artists, a
 * debounced search (link, phone or name) and connecting to a result.
 * `load: false` skips loading the list, for a second instance that only searches and connects.
 */
export function useConnections({ onNotify, load = true, memoryOwner = null } = {}) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(load);
  // Coming back from a salon page: the same query and results as when the client left (searchMemory.js).
  const [recalled] = useState(() => (memoryOwner === null ? null : recallSearch(memoryOwner)));
  const [query, setQuery] = useState(recalled?.query || "");
  const [search, setSearch] = useState(recalled?.search?.status === "done" ? recalled.search : { status: "idle", by: "none", results: [] }); // idle | searching | done | error
  const skipSearchFor = useRef(recalled?.search?.status === "done" ? recalled.query : null);
  const [connectingId, setConnectingId] = useState(null);
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const refresh = useCallback(async () => {
    const { ok, data } = await listConnections();
    if (ok) setConnections(Array.isArray(data?.connections) ? data.connections : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (load) refresh(); }, [refresh, load]);
  useAppRefresh(refresh, load);

  // Debounced search; an older request never overwrites a newer one.
  useEffect(() => {
    const text = query.trim();
    if (skipSearchFor.current !== null && skipSearchFor.current === query) {
      skipSearchFor.current = null; // the restored results are already the answer for this text
      return undefined;
    }
    skipSearchFor.current = null;
    if (!text) {
      setSearch({ status: "idle", by: "none", results: [] });
      return undefined;
    }
    setSearch((prev) => ({ ...prev, status: "searching" }));
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { ok, data, payload } = await searchConnections(text, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!ok) {
          setSearch({ status: "error", by: "none", results: [], message: payload?.error || "" });
          return;
        }
        setSearch({ status: "done", by: data.by, results: data.results || [] });
      } catch {
        if (!controller.signal.aborted) setSearch({ status: "error", by: "none", results: [] });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (memoryOwner !== null) rememberSearch(memoryOwner, { query, search: search.status === "done" ? search : null });
  }, [memoryOwner, query, search]);

  /**
   * Connects to a salon/artist card; resolves to the connected profile or null.
   * `silent` skips the success toast when the caller shows the result itself (the scanner).
   */
  const connect = useCallback(async (profile, { silent = false } = {}) => {
    if (!profile?.id) return null;
    setConnectingId(profile.id);
    try {
      const { ok, payload } = await connectTo(profile.id);
      if (!ok) {
        notifyRef.current?.(payload?.error || "وصل نشد؛ دوباره بزن.");
        return null;
      }
      const connected = payload.data.profile;
      setConnections((prev) => [connected, ...prev.filter((item) => item.id !== connected.id)]);
      setSearch((prev) => ({
        ...prev,
        results: prev.results.map((item) => (item.id === connected.id ? { ...item, connected: true } : item))
      }));
      if (!payload.data.alreadyConnected && !silent) notifyRef.current?.(`${connected.name} اضافه شد به سالن و آرتیست‌هات.`);
      return connected;
    } catch {
      notifyRef.current?.("وصل نشد؛ دوباره بزن.");
      return null;
    } finally {
      setConnectingId(null);
    }
  }, []);

  return { connections, loading, query, setQuery, search, connect, connectingId, refresh, restoredScrollY: recalled?.scrollY || 0 };
}
