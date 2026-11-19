import BlogDashboard from "@/components/BlogDashboard";

export const metadata = {
  title: "New article | YETI",
  robots: { index: false, follow: false },
};

export default function NewArticlePage() {
  return <BlogDashboard creating />;
}
