import BlogDashboard from "@/components/BlogDashboard";

export const metadata = {
  title: "Edit article | YETI",
  robots: { index: false, follow: false },
};

export default function EditArticlePage() {
  return <BlogDashboard editing />;
}
