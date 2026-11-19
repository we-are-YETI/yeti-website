"use client";
import { useEffect, useState } from "react";
import BlogCover from "./BlogCover";
import BlogShare from "./BlogShare";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Article, cleanHtml, validLinkedin } from "@/lib/blog";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
const linkFocus =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700";

function AuthorLinkedIn({ name, url }: { name: string; url: string }) {
  if (!validLinkedin(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} on LinkedIn`}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded text-neutral-700 transition hover:bg-neutral-100 ${linkFocus}`}
    >
      <span
        aria-hidden="true"
        className="grid size-4 place-items-center rounded-[3px] bg-neutral-800 text-[11px] font-bold leading-none text-white"
      >
        in
      </span>
    </a>
  );
}

function storySummary(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll("script, style")
    .forEach((node) => node.remove());
  const text = Array.from(
    template.content.childNodes,
    (node) => node.textContent ?? "",
  )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 155
    ? text.slice(0, 156).replace(/\s+\S*$/, "") + "…"
    : text;
}

export default function BlogPublic({ detail = false }: { detail?: boolean }) {
  const [articles, setArticles] = useState<(Article & { summary?: string })[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (detail) {
          const id = new URLSearchParams(window.location.search).get("id");
          if (!id || !/^[\w-]+$/.test(id))
            throw new Error("Article not found.");
          const snapshot = await getDoc(doc(db, "blogPublished", id));
          if (!snapshot.exists())
            throw new Error("Article not found or no longer published.");
          const article = { ...snapshot.data(), id: snapshot.id } as Article;
          article.html = await cleanHtml(article.html);
          const articleDocument = new DOMParser().parseFromString(
            article.html,
            "text/html",
          );
          articleDocument.querySelectorAll("img").forEach((image) => {
            image.loading = "lazy";
            image.decoding = "async";
          });
          article.html = articleDocument.body.innerHTML;
          if (!active) return;
          document.title = `${article.title} | YETI Blog`;
          setArticles([article]);
        } else {
          const snapshot = await getDocs(collection(db, "blogPublished"));
          if (!active) return;
          setArticles(
            snapshot.docs
              .map((d) => ({ ...d.data(), id: d.id }) as Article)
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((article) => ({
                ...article,
                summary: storySummary(article.html),
              })),
          );
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error && e.message.startsWith("Article not found")
              ? "This story is unavailable."
              : "We couldn’t load the stories right now.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [detail, retry]);

  const story = articles[0];
  const empty = !detail && !loading && !error && articles.length === 0;

  return (
    <div
      className={`min-h-screen bg-white pb-20 text-slate-950 ${detail ? "pt-28 sm:pt-32" : "pt-24 sm:pt-28"}`}
    >
      <div
        className={`mx-auto px-5 sm:px-8 ${detail ? "max-w-[46rem]" : "max-w-6xl"}`}
      >
        {detail ? (
          <Link
            href="/blogs"
            className={`mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700 ${linkFocus}`}
          >
            <ArrowLeft size={16} aria-hidden="true" /> All stories
          </Link>
        ) : (
          <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-8 sm:mb-11 sm:pb-10">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Stories from YETI
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
                Meet the people behind YETI projects and learn what they’re
                building, testing, and discovering along the way.
              </p>
            </div>
            {!empty && (
              <Link
                href="/blogs/submit"
                className={`inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline ${linkFocus}`}
              >
                Share your story <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            )}
          </header>
        )}
        {loading && (
          <p
            role="status"
            className="rounded-2xl bg-slate-50 p-6 text-slate-600"
          >
            {detail ? "Loading story…" : "Loading stories…"}
          </p>
        )}
        {error && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p role="alert">{error}</p>
            {error !== "This story is unavailable." && (
              <button
                type="button"
                className={`mt-3 font-semibold text-blue-700 hover:underline ${linkFocus}`}
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
          </section>
        )}
        {empty && (
          <section className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-12 sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              No stories published yet
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-slate-700">
              If you’re part of YETI, you can share a project or a lesson from
              your time in the community.
            </p>
            <Link
              href="/blogs/submit"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              Share your story <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        )}
        {detail && story && (
          <article>
            <header className="mb-6 border-t border-neutral-200 pt-5 sm:mb-8 sm:pt-7">
              <h1 className="break-words text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-neutral-950">
                {story.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="break-words font-semibold text-neutral-900">
                    {story.authorName}
                  </span>
                  <AuthorLinkedIn
                    name={story.authorName}
                    url={story.linkedin}
                  />
                </div>
                <span aria-hidden="true">·</span>
                <time dateTime={new Date(story.updatedAt).toISOString()}>
                  {dateFormat.format(story.updatedAt)}
                </time>
              </div>
            </header>
            <BlogCover
              url={story.coverUrl}
              alt={story.coverAlt}
              className="aspect-[16/10] rounded-xl sm:aspect-[2/1]"
            />
            <div className="mt-6 sm:mt-9">
              <div
                className="blog-rich text-[1.0625rem] text-neutral-800 sm:text-lg [&_a]:underline [&_img]:mx-auto"
                dangerouslySetInnerHTML={{ __html: story.html }}
              />
              <footer className="mt-12">
                <section
                  aria-label="Article author"
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-neutral-200 py-4"
                >
                  <p className="min-w-0 break-words text-sm text-neutral-600">
                    Written by{" "}
                    <span className="font-semibold text-neutral-950">
                      {story.authorName}
                    </span>
                  </p>
                  <AuthorLinkedIn
                    name={story.authorName}
                    url={story.linkedin}
                  />
                </section>
                <BlogShare title={story.title} />
                <Link
                  href="/blogs"
                  className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:underline ${linkFocus}`}
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Browse all stories
                </Link>
              </footer>
            </div>
          </article>
        )}
        {!detail && articles.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/blogs/article?id=${encodeURIComponent(article.id)}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                >
                  <BlogCover
                    url={article.coverUrl}
                    alt={article.coverAlt}
                    className="aspect-video border-b border-slate-100"
                  />
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <p className="text-sm font-medium text-slate-600">
                      {article.authorName}
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-semibold leading-tight tracking-tight">
                      {article.title}
                    </h2>
                    {article.summary && (
                      <p className="mt-3 line-clamp-3 break-words leading-relaxed text-slate-600">
                        {article.summary}
                      </p>
                    )}
                    <p className="mt-auto flex items-end justify-between gap-3 pt-6 text-sm">
                      <time
                        className="text-slate-600"
                        dateTime={new Date(article.updatedAt).toISOString()}
                      >
                        {dateFormat.format(article.updatedAt)}
                      </time>
                      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-blue-700">
                        Read story <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
