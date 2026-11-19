"use client";
import { BlogChoices, BlogConfirm } from "./BlogControls";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Article,
  auth,
  uploadBlogImage,
  cleanHtml,
  organizationEmail,
  Role,
  validLinkedin,
} from "@/lib/blog";
import { useBlogToast } from "./BlogToast";
import BlogCover from "./BlogCover";
import BlogEditor from "./BlogEditor";

const statusLabel = (status: string) => status.replaceAll("_", " ");
type RequiredField = "title" | "authorName" | "linkedin" | "html";
type FieldErrors = Partial<Record<RequiredField, string>>;

function FieldError({
  field,
  errors,
}: {
  field: RequiredField;
  errors: FieldErrors;
}) {
  return errors[field] ? (
    <span
      id={`article-error-${field}`}
      className="block text-sm font-normal text-red-700"
    >
      {errors[field]}
    </span>
  ) : null;
}

const articleStatus = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  review: { label: "Awaiting review", color: "bg-blue-50 text-blue-800" },
  changes_requested: {
    label: "Changes requested",
    color: "bg-amber-50 text-amber-900",
  },
  published: { label: "Published", color: "bg-emerald-50 text-emerald-800" },
};
const articleDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default function BlogDashboard({
  creating = false,
  editing = false,
}: {
  creating?: boolean;
  editing?: boolean;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<{
    message: string;
    run: () => void;
  } | null>(null);
  function confirm(message: string, run: () => void) {
    setConfirmation({ message, run });
  }
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("member");
  const [ready, setReady] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [current, setCurrent] = useState<Article | null>(null);
  const [working, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = working || uploading;
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const notify = useBlogToast();
  const [savedArticle, setSavedArticle] = useState<Article | null>(null);
  const dirty =
    current !== null &&
    (savedArticle === null ||
      current.title !== savedArticle.title ||
      current.authorName !== savedArticle.authorName ||
      current.linkedin !== savedArticle.linkedin ||
      current.html !== savedArticle.html ||
      (current.coverUrl ?? "") !== (savedArticle.coverUrl ?? "") ||
      (current.coverAlt ?? "") !== (savedArticle.coverAlt ?? "") ||
      current.feedback !== savedArticle.feedback);
  const [members, setMembers] = useState<
    { id: string; email: string; role: Role }[]
  >([]);
  const editorPage = creating || editing;
  const [articleLoading, setArticleLoading] = useState(editing);
  const reviewer = !creating && (role === "content" || role === "admin");
  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        setReady(false);
        try {
          if (
            next &&
            (!next.emailVerified || !organizationEmail(next.email || ""))
          ) {
            await signOut(auth);
            setMessage(
              "Please use a verified @yeti-dresden.org or @yeti-leipzig.org Google account.",
            );
            return;
          }
          setUser(next);
          setCurrent(
            creating && next
              ? {
                  id: crypto.randomUUID(),
                  authorId: next.uid,
                  authorName: next.displayName || "",
                  linkedin: "",
                  title: "",
                  html: "",
                  status: "draft",
                  feedback: "",
                  updatedAt: 0,
                }
              : null,
          );
          setSavedArticle(null);
          setRole("member");
          if (next) {
            const target = doc(db, "blogUsers", next.uid);
            const existing = await getDoc(target);
            if (!existing.exists()) {
              const invitation = await getDoc(
                doc(db, "blogInvitations", next.email!),
              );
              const assignedRole = invitation.exists()
                ? invitation.data().role
                : "member";
              await setDoc(target, { email: next.email, role: assignedRole });
            }
          }
        } catch (e) {
          setMessage(describe(e));
        } finally {
          setReady(true);
        }
      }),
    [creating],
  );
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, "blogUsers", user.uid),
      (snapshot) => setRole(snapshot.data()?.role || "member"),
      (e) => setMessage(describe(e)),
    );
  }, [user]);
  useEffect(() => {
    if (!editing || !ready || !user) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^[\w-]+$/.test(id)) {
      setMessage("Article not found.");
      setArticleLoading(false);
      return;
    }
    let active = true;
    setArticleLoading(true);
    getDoc(doc(db, "blogDrafts", id))
      .then((snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          const article = { ...snapshot.data(), id: snapshot.id } as Article;
          setSavedArticle(article);
          setCurrent(article);
        } else {
          setMessage("Article not found.");
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "This article could not be opened. Check your access or try again.",
          );
      })
      .finally(() => {
        if (active) setArticleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editing, ready, user]);

  useEffect(() => {
    if (editorPage || !user) {
      setArticles([]);
      return;
    }
    const source = reviewer
      ? query(collection(db, "blogDrafts"))
      : query(collection(db, "blogDrafts"), where("authorId", "==", user.uid));
    return onSnapshot(
      source,
      (snapshot) =>
        setArticles(
          snapshot.docs
            .map((d) => ({ ...d.data(), id: d.id }) as Article)
            .sort((a, b) => b.updatedAt - a.updatedAt),
        ),
      (e) => setMessage(describe(e)),
    );
  }, [editorPage, user, reviewer]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (editorPage || role !== "admin") {
      setMembers([]);
      return;
    }
    return onSnapshot(
      collection(db, "blogUsers"),
      (snapshot) =>
        setMembers(
          snapshot.docs.map(
            (d) =>
              ({ id: d.id, ...d.data() }) as {
                id: string;
                email: string;
                role: Role;
              },
          ),
        ),
      (e) => setMessage(describe(e)),
    );
  }, [editorPage, role]);
  function describe(e: unknown) {
    return e instanceof Error
      ? e.message
      : "Something went wrong. Please try again.";
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      notify({ kind: "error", text: describe(e) });
    } finally {
      setBusy(false);
    }
  }
  function change(patch: Partial<Article>) {
    setCurrent((a) => (a ? { ...a, ...patch } : a));
    setErrors((previous) => {
      const next = { ...previous };
      for (const field of [
        "title",
        "authorName",
        "linkedin",
        "html",
      ] as const) {
        if (field in patch) delete next[field];
      }
      return next;
    });
  }
  async function save(status: Article["status"]) {
    if (!current || !user) return;
    const html = await cleanHtml(current.html);
    const text =
      new DOMParser().parseFromString(html, "text/html").body.textContent || "";
    const validation: FieldErrors = {};
    if (status === "review" || status === "published") {
      if (!current.title.trim()) validation.title = "Enter a title.";
      if (!current.authorName.trim())
        validation.authorName = "Enter the author’s name.";
      if (!validLinkedin(current.linkedin))
        validation.linkedin =
          "Enter a LinkedIn profile URL, such as https://www.linkedin.com/in/your-name.";
      if (!text.trim())
        validation.html = "Write the article before submitting or publishing.";
    }
    setErrors(validation);
    const firstInvalid = Object.keys(validation)[0];
    if (firstInvalid) {
      requestAnimationFrame(() =>
        (firstInvalid === "html"
          ? (document.getElementById("article-field-markdown") ??
            document.getElementById("article-body-preview") ??
            document.getElementById("article-field-html"))
          : document.getElementById(`article-field-${firstInvalid}`)
        )?.focus(),
      );
      return;
    }
    const updated = { ...current, html, status, updatedAt: Date.now() };
    await runTransaction(db, async (transaction) => {
      const target = doc(db, "blogDrafts", current.id);
      const latest = await transaction.get(target);
      if (!latest.exists() && current.updatedAt !== 0) {
        throw new Error(
          "This article was deleted. Start a new article to continue.",
        );
      }
      if (latest.exists() && latest.data().updatedAt !== current.updatedAt)
        throw new Error(
          "This article changed in another session. Reopen it from the list before saving.",
        );
      transaction.set(target, updated);
      if (status === "published") {
        const publicArticle = {
          id: updated.id,
          authorId: updated.authorId,
          authorName: updated.authorName,
          linkedin: updated.linkedin,
          title: updated.title,
          html: updated.html,
          coverUrl: updated.coverUrl ?? "",
          coverAlt: updated.coverAlt ?? "",
          status: updated.status,
          updatedAt: updated.updatedAt,
        };
        transaction.set(doc(db, "blogPublished", current.id), publicArticle);
      }
    });
    setCurrent(updated);
    setSavedArticle(updated);
    const successMessages = {
      draft: "Draft saved.",
      review: "Submitted to the content team for review.",
      changes_requested:
        "Changes requested. The author can see your feedback in their dashboard.",
      published: "Article published successfully.",
    };
    notify({ kind: "success", text: successMessages[status] });

    if (status === "published") {
      router.replace(`/blogs/article?id=${encodeURIComponent(updated.id)}`);
    } else if (status === "review" || status === "changes_requested") {
      router.replace("/blogs/submit");
    } else if (creating) {
      router.replace(`/blogs/submit/edit?id=${encodeURIComponent(updated.id)}`);
    }
  }
  return (
    <div className="blog-workspace min-h-screen bg-neutral-50 px-6 pb-24 pt-28 sm:pt-32 text-neutral-900">
      <div className="mx-auto max-w-6xl">
        {confirmation && (
          <BlogConfirm
            message={confirmation.message}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => {
              setConfirmation(null);
              confirmation.run();
            }}
          />
        )}
        <Link
          href={editorPage ? "/blogs/submit" : "/blogs"}
          className="text-sm underline"
          onClick={(event) => {
            if (dirty) {
              event.preventDefault();
              confirm("Discard unsaved changes?", () =>
                router.push(editorPage ? "/blogs/submit" : "/blogs"),
              );
            }
          }}
        >
          {editorPage ? "← Writing dashboard" : "← All stories"}
        </Link>
        <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {creating
                ? "New article"
                : editing
                  ? "Edit article"
                  : "Write for YETI"}
            </h1>
            {!editorPage && (
              <p className="mt-2 text-neutral-600">
                Tell the YETI community what you’re building and what you’ve
                learned.
              </p>
            )}
          </div>
          {!editorPage && user && (
            <div>
              <p className="mb-2 text-sm text-neutral-600">
                {user.email} · {role}
              </p>
              <button
                disabled={busy}
                className="rounded-sm text-sm text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4"
                onClick={() => {
                  const leave = () => {
                    void action(() => signOut(auth));
                  };
                  if (dirty)
                    confirm("Discard unsaved changes and sign out?", leave);
                  else leave();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
        {message && (
          <p role="status" className="mb-6 rounded-xl border bg-white p-4">
            {message}
          </p>
        )}
        {!ready ? (
          <p>Loading your workspace…</p>
        ) : !user ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
              <h2 className="text-2xl font-semibold">
                Sign in to submit an article
              </h2>
              <p className="my-5 leading-relaxed text-neutral-600">
                Use your @yeti-dresden.org or @yeti-leipzig.org Google account.
                The content team reviews every article before publication.
              </p>
              <button
                disabled={busy}
                className="w-full rounded-full bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 sm:w-auto"
                onClick={() =>
                  void action(async () => {
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: "select_account" });
                    await signInWithPopup(auth, provider);
                  })
                }
              >
                Continue with Google
              </button>
            </section>
            <Guidelines className="rounded-3xl border border-neutral-200 bg-white p-7 sm:p-9" />
          </div>
        ) : (
          <>
            {!editorPage && (
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">
                  {reviewer ? "Articles & review queue" : "My articles"}
                </h2>
                <Link
                  className="blog-primary"
                  href="/blogs/submit/new"
                  onClick={(event) => {
                    if (dirty) {
                      event.preventDefault();
                      confirm("Discard unsaved changes?", () =>
                        router.push("/blogs/submit/new"),
                      );
                    }
                  }}
                >
                  New article
                </Link>
              </div>
            )}
            <div className={editorPage ? "mx-auto max-w-3xl" : "space-y-6"}>
              {!editorPage && (
                <aside className="space-y-3">
                  {reviewer && (
                    <div className="mb-5 space-y-2">
                      <p className="text-sm font-semibold">Filter articles</p>
                      <BlogChoices
                        label="Filter articles"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                          ["all", "All"],
                          ["review", "Awaiting review"],
                          ["changes_requested", "Changes requested"],
                          ["draft", "Drafts"],
                          ["published", "Published"],
                        ]}
                      />
                    </div>
                  )}

                  {!articles.length && (
                    <p className="text-neutral-500">
                      {reviewer
                        ? "New submissions will appear here for review."
                        : "Your drafts and submissions will appear here."}
                    </p>
                  )}
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {articles
                      .filter(
                        (article) =>
                          statusFilter === "all" ||
                          article.status === statusFilter,
                      )
                      .map((article) => {
                        const status = articleStatus[article.status];
                        return (
                          <li key={article.id}>
                            <Link
                              href={`/blogs/submit/edit?id=${encodeURIComponent(article.id)}`}
                              className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                            >
                              <BlogCover
                                url={article.coverUrl}
                                alt={article.coverAlt}
                                className="mb-4 aspect-video rounded-xl"
                              />
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                  <FileText size={18} aria-hidden="true" />
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}
                                >
                                  {status.label}
                                </span>
                              </div>
                              <h3 className="mt-4 break-words text-lg font-semibold leading-snug text-slate-950">
                                {article.title.trim() || "Untitled article"}
                              </h3>
                              {reviewer && article.authorName && (
                                <p className="mt-1 break-words text-sm text-slate-600">
                                  {article.authorName}
                                </p>
                              )}
                              <div className="mt-auto pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                                  <time
                                    className="text-slate-600"
                                    dateTime={new Date(
                                      article.updatedAt,
                                    ).toISOString()}
                                  >
                                    Updated{" "}
                                    {articleDate.format(article.updatedAt)}
                                  </time>
                                  <span className="inline-flex items-center gap-1 font-semibold text-blue-700 group-hover:underline">
                                    Open article{" "}
                                    <ArrowUpRight
                                      size={15}
                                      aria-hidden="true"
                                    />
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </aside>
              )}
              <section>
                {current ? (
                  <fieldset disabled={busy} className="space-y-5">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="capitalize">
                        {statusLabel(current.status)}
                        {dirty && " · Unsaved changes"}
                      </p>
                    </div>
                    <label className="blog-field">
                      <span>
                        Title{" "}
                        <span className="text-red-700" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <input
                        id="article-field-title"
                        aria-required="true"
                        aria-invalid={!!errors.title}
                        aria-describedby={
                          errors.title ? "article-error-title" : undefined
                        }
                        maxLength={180}
                        value={current.title}
                        onChange={(e) => change({ title: e.target.value })}
                      />
                      <FieldError field="title" errors={errors} />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="blog-field">
                        <span>
                          Author name{" "}
                          <span className="text-red-700" aria-hidden="true">
                            *
                          </span>
                        </span>
                        <input
                          id="article-field-authorName"
                          aria-required="true"
                          aria-invalid={!!errors.authorName}
                          aria-describedby={
                            errors.authorName
                              ? "article-error-authorName"
                              : undefined
                          }
                          maxLength={120}
                          value={current.authorName}
                          onChange={(e) =>
                            change({ authorName: e.target.value })
                          }
                        />
                        <FieldError field="authorName" errors={errors} />
                      </label>
                      <label className="blog-field">
                        <span>
                          Author’s LinkedIn profile{" "}
                          <span className="text-red-700" aria-hidden="true">
                            *
                          </span>
                        </span>
                        <input
                          id="article-field-linkedin"
                          aria-required="true"
                          aria-invalid={!!errors.linkedin}
                          aria-describedby={
                            errors.linkedin
                              ? "article-error-linkedin"
                              : undefined
                          }
                          type="url"
                          placeholder="https://www.linkedin.com/in/your-name"
                          value={current.linkedin}
                          onChange={(e) =>
                            change({ linkedin: e.target.value.trim() })
                          }
                        />
                        <FieldError field="linkedin" errors={errors} />
                      </label>
                    </div>
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                      <BlogCover
                        url={current.coverUrl}
                        alt={current.coverAlt}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="blog-secondary cursor-pointer focus-within:outline-2">
                          {current.coverUrl
                            ? "Replace cover"
                            : "Add cover image"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = "";
                              if (file)
                                void action(async () => {
                                  const coverUrl = await uploadBlogImage(
                                    file,
                                    user.uid,
                                  );
                                  change({ coverUrl, coverAlt: "" });
                                  notify({
                                    kind: "success",
                                    text: "Cover added. Save the article to keep it.",
                                  });
                                });
                            }}
                          />
                        </label>
                        {current.coverUrl && (
                          <button
                            type="button"
                            className="blog-secondary"
                            onClick={() => {
                              change({ coverUrl: "", coverAlt: "" });
                              notify({
                                kind: "info",
                                text: "Cover removed. Save the article to keep the change.",
                              });
                            }}
                          >
                            Remove cover
                          </button>
                        )}
                      </div>
                      {current.coverUrl && (
                        <label className="blog-field">
                          Image description
                          <input
                            value={current.coverAlt ?? ""}
                            maxLength={200}
                            onChange={(event) =>
                              change({ coverAlt: event.target.value })
                            }
                          />
                        </label>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium" id="article-body-label">
                        Article body{" "}
                        <span className="text-red-700" aria-hidden="true">
                          *
                        </span>
                      </p>
                      <BlogEditor
                        coverUrl={current.coverUrl}
                        coverAlt={current.coverAlt}
                        invalid={!!errors.html}
                        key={`${current.id}:${current.updatedAt}`}
                        html={current.html}
                        userId={user.uid}
                        disabled={working}
                        onUploading={setUploading}
                        onChange={(html) => change({ html })}
                      />
                      <FieldError field="html" errors={errors} />
                    </div>
                    <p className="text-sm text-neutral-500">
                      {
                        current.html
                          .replace(/<[^>]*>/g, " ")
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean).length
                      }{" "}
                      words. Save before leaving. Aim for 200–400 words in
                      English. Insert images wherever they belong in your story.
                    </p>
                    {(current.feedback || reviewer) && (
                      <label className="blog-field">
                        Content team feedback
                        <textarea
                          disabled={!reviewer}
                          value={current.feedback}
                          onChange={(e) => change({ feedback: e.target.value })}
                        />
                      </label>
                    )}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="blog-secondary"
                          onClick={() => void action(() => save("draft"))}
                        >
                          Save draft
                        </button>
                        <button
                          className={
                            reviewer ? "blog-secondary" : "blog-primary"
                          }
                          onClick={() => void action(() => save("review"))}
                        >
                          Submit for review
                        </button>
                        {reviewer && (
                          <>
                            <button
                              className="blog-secondary"
                              onClick={() =>
                                void action(() => save("changes_requested"))
                              }
                            >
                              Request changes
                            </button>
                            <button
                              className="blog-primary"
                              onClick={() =>
                                void action(() => save("published"))
                              }
                            >
                              Publish
                            </button>
                          </>
                        )}
                      </div>
                      {(reviewer || (editing && role === "admin")) && (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                          <button
                            className="blog-secondary"
                            onClick={() =>
                              void action(async () => {
                                const batch = writeBatch(db);
                                batch.delete(
                                  doc(db, "blogPublished", current.id),
                                );
                                batch.update(
                                  doc(db, "blogDrafts", current.id),
                                  { status: "draft", updatedAt: Date.now() },
                                );
                                await batch.commit();
                                notify({
                                  kind: "success",
                                  text: "Article unpublished.",
                                });
                                setCurrent(null);
                                router.replace("/blogs/submit");
                              })
                            }
                          >
                            Unpublish
                          </button>
                          {editing && role === "admin" && (
                            <button
                              className="blog-secondary text-red-700"
                              onClick={() => {
                                confirm(
                                  "Permanently delete this article and its public version?",
                                  () => {
                                    void action(async () => {
                                      const batch = writeBatch(db);
                                      batch.delete(
                                        doc(db, "blogDrafts", current.id),
                                      );
                                      batch.delete(
                                        doc(db, "blogPublished", current.id),
                                      );
                                      await batch.commit();
                                      notify({
                                        kind: "success",
                                        text: "Article deleted.",
                                      });
                                      setCurrent(null);
                                      router.replace("/blogs/submit");
                                    });
                                  },
                                );
                              }}
                            >
                              Delete article
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {editorPage ? (
                      <details className="rounded-xl border border-neutral-200 bg-white p-4">
                        <summary className="cursor-pointer font-medium">
                          Writing guidelines
                        </summary>
                        <Guidelines className="pt-4" />
                      </details>
                    ) : (
                      <Guidelines />
                    )}
                  </fieldset>
                ) : editing && articleLoading ? (
                  <p role="status">Loading article…</p>
                ) : null}
              </section>
            </div>
            {!editorPage && role === "admin" && (
              <section className="mt-16 rounded-xl border bg-white p-6">
                <h2 className="text-2xl font-semibold">Manage roles</h2>
                <p className="my-3 text-neutral-600">
                  Members write articles. Content reviewers review and publish.
                  Administrators also manage access.
                </p>
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
                  >
                    {member.email}
                    <BlogChoices
                      label={`Role for ${member.email}`}
                      disabled={busy || member.id === user.uid}
                      value={member.role}
                      onChange={(nextRole) => {
                        void action(async () => {
                          await setDoc(
                            doc(db, "blogUsers", member.id),
                            { role: nextRole },
                            { merge: true },
                          );
                          notify({ kind: "success", text: "Role updated." });
                        });
                      }}
                      options={[
                        ["member", "Member"],
                        ["content", "Content team"],
                        ["admin", "Admin"],
                      ]}
                    />
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
function Guidelines({
  className = "mt-8 rounded-2xl border border-neutral-200 bg-white p-6",
}: {
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="text-2xl font-semibold tracking-tight">
        Member article guidelines
      </h2>
      <p className="mt-4 leading-relaxed text-neutral-600">
        Write 200–400 words in English with short paragraphs. Introduce a
        project, startup, workshop or idea connected to YETI.
      </p>
      <ul className="my-5 list-disc space-y-2 border-y border-neutral-200 py-5 pl-5 leading-relaxed marker:text-blue-700">
        <li>What are you building, who is it for, and what does it address?</li>
        <li>Why did you start, and how does it connect to YETI?</li>
        <li>What stage are you at, and what comes next?</li>
        <li>How can others get involved or contact you?</li>
      </ul>
      <p className="leading-relaxed text-neutral-600">
        Include your name and LinkedIn profile. A relevant photo or screenshot
        is recommended. Keep the focus on sharing your work. Direct purchase
        requests and purely promotional articles are outside the scope.
        Participation is voluntary, and every article is reviewed.
      </p>
    </section>
  );
}
