"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type Notice = { kind: "success" | "error" | "info"; text: string };
const ToastContext = createContext<(notice: Notice) => void>(() => {});

export const useBlogToast = () => useContext(ToastContext);

const styles = {
  success: { Icon: CheckCircle2, color: "text-emerald-700" },
  error: { Icon: CircleAlert, color: "text-red-700" },
  info: { Icon: Info, color: "text-blue-700" },
};

export default function BlogToast({ children }: { children: ReactNode }) {
  const [notice, notify] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice || notice.kind === "error") return;
    const timer = window.setTimeout(() => notify(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const { Icon, color } = styles[notice?.kind ?? "info"];
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {notice && (
        <div className="fixed inset-x-4 bottom-4 z-[70] flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-950 shadow-xl sm:left-auto sm:right-6 sm:w-96">
          <Icon size={20} aria-hidden="true" className={`shrink-0 ${color}`} />
          <p
            className="flex-1 self-center break-words"
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="rounded p-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-2"
            onClick={() => notify(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
