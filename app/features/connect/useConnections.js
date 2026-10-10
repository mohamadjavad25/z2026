"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectTo, listConnections, searchConnections } from "../../shared/api/connections";

const SEARCH_DELAY_MS = 300;

/**
 * State for «سالن و آرتیست من»: the client's connected salons/artists, a
 * debounced search (link, phone or name) and connecting to a result.
 */
export function useConnections({ onNotify } = {}) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ status: "idle", by: "none", results: [] }); // idle | searching | done | error
  const [connectingId, setConnectingId] = useState(null);
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const refresh = useCallback(async () => {
    const { ok, data } = await listConnections();
    if (ok) setConnections(Array.isArray(data?.connections) ? data.connections : []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Debounced search; an older request never overwrites a newer one.
  useEffect(() => {
    const text = query.trim();
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

  /** Connects to a salon/artist card; resolves to the connected profile or null. */
  const connect = useCallback(async (profile) => {
    if (!profile?.id) return null;
    setConnectingId(profile.id);
    try {
      const { ok, payload } = await connectTo(profile.id);
      if (!ok) {
        notifyRef.current?.(payload?.error || "وصل شدن انجام نشد؛ دوباره امتحان کن.");
        return null;
      }
      const connected = payload.data.profile;
      setConnections((prev) => [connected, ...prev.filter((item) => item.id !== connected.id)]);
      setSearch((prev) => ({
        ...prev,
        results: prev.results.map((item) => (item.id === connected.id ? { ...item, connected: true } : item))
      }));
      if (!payload.data.alreadyConnected) notifyRef.current?.(`${connected.name} به لیستت اضافه شد.`);
      return connected;
    } catch {
      notifyRef.current?.("وصل شدن انجام نشد؛ دوباره امتحان کن.");
      return null;
    } finally {
      setConnectingId(null);
    }
  }, []);

  return { connections, loading, query, setQuery, search, connect, connectingId, refresh };
}
