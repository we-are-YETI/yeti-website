import { getAuth } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "./firebase";

export const auth = getAuth(app);
export const storage = getStorage(app);
export type Role = "member" | "content" | "admin";
export type Article = {
  id: string;
  authorId: string;
  authorName: string;
  linkedin: string;
  title: string;
  html: string;
  coverUrl?: string;
  coverAlt?: string;
  status: "draft" | "review" | "changes_requested" | "published";
  feedback: string;
  updatedAt: number;
};
export const organizationEmail = (email: string) =>
  /^[^@]+@(yeti-dresden\.org|yeti-leipzig\.org)$/i.test(email);
export const validLinkedin = (url: string) =>
  /^https:\/\/(www\.)?linkedin\.com\/in\/[^\s/?#]+\/?(?:\?[^\s]*)?$/.test(url);
export function cleanHtml(html: string) {
  // Imported by client components only. Sanitization also applies to stored content.
  return import("dompurify").then(({ default: purifier }) =>
    purifier.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "s",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
        "img",
        "hr",
        "pre",
        "code",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "width", "height"],
    }),
  );
}

export async function uploadBlogImage(file: File, userId: string) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP image under 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image conversion failed."))),
      "image/webp",
      0.82,
    ),
  );
  const target = ref(
    storage,
    `blog-images/${userId}/${crypto.randomUUID()}.webp`,
  );
  await uploadBytes(target, blob, {
    contentType: "image/webp",
    cacheControl: "public,max-age=31536000,immutable",
  });
  return getDownloadURL(target);
}
