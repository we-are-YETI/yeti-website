import type { ReactNode } from "react";
import BlogToast from "@/components/BlogToast";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <BlogToast>{children}</BlogToast>;
}
