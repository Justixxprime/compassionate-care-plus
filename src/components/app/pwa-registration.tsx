"use client";

import { useEffect } from "react";

// Service workers require HTTPS in production. Vercel provides that, and
// browsers also permit this on localhost for safe development testing.
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation support is progressive. The website still works when
        // a browser, privacy setting, or network blocks a service worker.
      });
    }
  }, []);
  return null;
}
