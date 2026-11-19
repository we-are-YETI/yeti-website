import Image from "next/image";

export default function BlogCover({
  url,
  alt,
  className,
}: {
  url?: string;
  alt?: string;
  className?: string;
}) {
  if (
    !url?.startsWith(
      "https://firebasestorage.googleapis.com/v0/b/yeti-dresden.firebasestorage.app/o/blog-images%2F",
    )
  )
    return null;
  return (
    <div
      className={`relative overflow-hidden bg-slate-100 ${className ?? "aspect-video rounded-xl"}`}
    >
      <Image
        src={url}
        alt={alt || ""}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
    </div>
  );
}
