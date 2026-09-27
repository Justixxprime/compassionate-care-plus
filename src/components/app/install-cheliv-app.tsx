"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallChelivApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(appleMobile);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  if (prompt) {
    return <Button type="button" variant="secondary" onClick={install}><Download className="h-4 w-4" aria-hidden="true" />Install Cheliv app</Button>;
  }

  if (isIos) {
    return (
      <div className="rounded-md border border-border bg-sage px-4 py-3 text-body-sm text-ink">
        <p className="font-medium">Install on iPhone or iPad</p>
        <p className="mt-1">In Safari, tap <Share className="inline h-4 w-4" aria-label="Share" />, then choose <strong>Add to Home Screen</strong>.</p>
      </div>
    );
  }

  return <p className="text-body-sm text-slate">To install, open your browser menu and choose <strong>Install Cheliv</strong> or <strong>Add to dock</strong>. Chrome and Edge on Android, Windows, Mac, and ChromeOS support this when the site is opened over HTTPS.</p>;
}
