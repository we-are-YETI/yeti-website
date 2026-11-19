"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  Linkedin,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";

import { useBlogToast } from "./BlogToast";

export default function BlogShare({ title }: { title: string }) {
  const [shareUrl, setShareUrl] = useState("");
  const notify = useBlogToast();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    function position() {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!element || !anchor || !element.matches(":popover-open")) return;
      const gap = 8;
      const inset = 12;
      const availableAbove = anchor.top - gap - inset;
      const availableBelow = window.innerHeight - anchor.bottom - gap - inset;
      const naturalHeight = element.scrollHeight + 2;
      const opensAbove =
        naturalHeight > availableBelow && availableAbove > availableBelow;
      const maxHeight = Math.max(
        0,
        opensAbove ? availableAbove : availableBelow,
      );
      element.style.maxHeight = `${maxHeight}px`;
      element.style.top = `${opensAbove ? anchor.top - gap - Math.min(naturalHeight, maxHeight) : anchor.bottom + gap}px`;
      element.style.left = `${Math.max(inset, Math.min(anchor.left, window.innerWidth - element.offsetWidth - inset))}px`;
    }
    element.addEventListener("toggle", position);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      element.removeEventListener("toggle", position);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, []);

  function articleUrl() {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("id");
    url.search = "";
    url.hash = "";
    if (id) url.searchParams.set("id", id);
    return url.toString();
  }

  async function copyLink() {
    const url = articleUrl();
    try {
      await navigator.clipboard.writeText(url);
      notify({ kind: "success", text: "Article link copied." });
    } catch {
      setShareUrl(url);
      notify({
        kind: "info",
        text: "Clipboard unavailable. Select and copy the article link.",
      });
      panel.current?.showPopover();
    }
  }

  const destinations = [
    {
      label: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: shareUrl })}`,
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?${new URLSearchParams({ text: `${title}\n${shareUrl}` })}`,
    },
    {
      label: "X",
      icon: Share2,
      href: `https://x.com/intent/tweet?${new URLSearchParams({ text: title, url: shareUrl })}`,
    },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`,
    },
  ];

  const buttonClass =
    "inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={copyLink}>
          <Copy size={16} aria-hidden="true" /> Copy link
        </button>
        <button
          type="button"
          className={buttonClass}
          ref={trigger}
          popoverTarget="article-share-options"
          onClick={() => setShareUrl(articleUrl())}
        >
          <Share2 size={16} aria-hidden="true" /> Share{" "}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      <div
        id="article-share-options"
        ref={panel}
        popover="auto"
        aria-label="Share article"
        className="fixed inset-auto m-0 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      >
        <label className="blog-field text-sm">
          Article link
          <input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <ul className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2">
          {destinations.map(({ label, icon: Icon, href }) => (
            <li key={label}>
              <a
                href={href}
                target={label === "Email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                <Icon size={16} aria-hidden="true" />
                {label}
                <ArrowUpRight
                  className="ml-auto text-slate-500"
                  size={13}
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
