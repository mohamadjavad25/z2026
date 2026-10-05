"use client";

import { useEffect } from "react";
import { reportClientError } from "../shared/lib/reportClientError";

/** Mounts once in the root layout: forwards uncaught errors and unhandled promise rejections to the server log. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event) => reportClientError(event.error || event.message, "window.onerror");
    const onRejection = (event) => reportClientError(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
