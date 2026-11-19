"use client";

import { useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useBlogToast } from "./BlogToast";
import BlogCover from "./BlogCover";
import { cleanHtml, uploadBlogImage } from "@/lib/blog";

export default function BlogEditor({
  invalid,
  coverUrl,
  coverAlt,
  html,
  userId,
  onChange,
  disabled,
  onUploading,
}: {
  invalid: boolean;
  coverUrl?: string;
  coverAlt?: string;
  html: string;
  userId: string;
  onChange: (html: string) => void;
  disabled: boolean;
  onUploading: (uploading: boolean) => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const notify = useBlogToast();
  const [uploading, setUploading] = useState(false);
  const history = useRef<{ undo: string[]; redo: string[] }>({
    undo: [],
    redo: [],
  });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, Markdown, Image.configure({ allowBase64: false })],
    immediatelyRender: false,
    content: html,
  });
  const locked = !editor || disabled || uploading;

  function update(value: string, recordHistory = true) {
    if (!editor) return;
    const previous = source ?? editor.getMarkdown();
    if (previous === value) return;
    if (recordHistory) {
      history.current.undo.push(previous);
      if (history.current.undo.length > 100) history.current.undo.shift();
      history.current.redo.length = 0;
    }
    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
    });
    setSource(value);
    onChange(editor.getHTML());
  }

  function restoreHistory(direction: "undo" | "redo") {
    if (!editor) return;
    const previous = history.current[direction].pop();
    if (previous === undefined) return;
    history.current[direction === "undo" ? "redo" : "undo"].push(
      source ?? editor.getMarkdown(),
    );
    update(previous, false);
  }

  function replaceSelection(
    format: (selection: string) => string,
    wholeLines = false,
  ) {
    const field = textarea.current;
    if (!field) return;
    const { value, selectionStart, selectionEnd } = field;
    const start = wholeLines
      ? value.lastIndexOf("\n", selectionStart - 1) + 1
      : selectionStart;
    const nextLine = value.indexOf("\n", selectionEnd);
    const end = wholeLines
      ? nextLine === -1
        ? value.length
        : nextLine
      : selectionEnd;
    const replacement = format(value.slice(start, end));
    update(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start, start + replacement.length);
    });
  }

  function heading(level: number) {
    replaceSelection(
      (selected) =>
        selected
          .split("\n")
          .map((line) => {
            const text = line.replace(/^#{1,6}\s+/, "");
            return level ? `${"#".repeat(level)} ${text}` : text;
          })
          .join("\n"),
      true,
    );
  }

  async function upload(file?: File) {
    if (!file || locked || !textarea.current) return;
    setUploading(true);
    onUploading(true);
    try {
      const url = await uploadBlogImage(file, userId);
      const label = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\\]/g, "");
      replaceSelection(() => `\n\n![${label}](${url})\n\n`);
      notify({
        kind: "success",
        text: "Image inserted. Save the article to keep it.",
      });
    } catch (e) {
      notify({
        kind: "error",
        text: e instanceof Error ? e.message : "Image upload failed.",
      });
    } finally {
      setUploading(false);
      onUploading(false);
    }
  }

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      apply: () => replaceSelection((text) => `**${text || "bold text"}**`),
    },
    {
      label: "Italic",
      icon: Italic,
      apply: () => replaceSelection((text) => `*${text || "italic text"}*`),
    },
    {
      label: "Link",
      icon: Link2,
      apply: () =>
        replaceSelection(
          (text) => `[${text || "link text"}](https://example.com)`,
        ),
    },
    {
      label: "Bulleted list",
      icon: List,
      apply: () =>
        replaceSelection(
          (text) =>
            (text || "List item")
              .split("\n")
              .map((line) => `- ${line}`)
              .join("\n"),
          true,
        ),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      apply: () =>
        replaceSelection(
          (text) =>
            (text || "List item")
              .split("\n")
              .map((line, index) => `${index + 1}. ${line}`)
              .join("\n"),
          true,
        ),
    },
    {
      label: "Quote",
      icon: Quote,
      apply: () =>
        replaceSelection(
          (text) =>
            (text || "Quote")
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n"),
          true,
        ),
    },
  ];
  const toolClass =
    "grid size-8 place-items-center rounded-md text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700";
  return (
    <div
      className={`rounded-xl border bg-white ${invalid ? "border-red-600" : "border-slate-300"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-2 pt-2">
        <div role="group" aria-label="Editor view" className="flex">
          <button
            type="button"
            aria-pressed={preview === null}
            className="rounded-t-md border border-transparent px-4 py-2 text-sm font-semibold aria-pressed:border-slate-200 aria-pressed:bg-white"
            disabled={locked}
            onClick={() => setPreview(null)}
          >
            Write
          </button>
          <button
            type="button"
            aria-pressed={preview !== null}
            className="rounded-t-md border border-transparent px-4 py-2 text-sm font-semibold aria-pressed:border-slate-200 aria-pressed:bg-white"
            disabled={locked}
            onClick={async () => {
              if (!editor) return;
              setPreview(await cleanHtml(editor.getHTML()));
            }}
          >
            Preview
          </button>
        </div>
        {preview === null && (
          <div
            role="group"
            aria-label="Markdown formatting"
            className="flex flex-wrap items-center gap-1 pb-2"
          >
            {!locked && (
              <details
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    event.currentTarget.open = false;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-slate-200 [&::-webkit-details-marker]:hidden">
                  Heading <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className="absolute left-0 top-full z-20 mt-1 grid w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="rounded px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        heading(level);
                      }}
                    >
                      {level ? `Heading ${level}` : "Paragraph"}
                    </button>
                  ))}
                </div>
              </details>
            )}
            {tools.map(({ label, icon: Icon, apply }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                className={toolClass}
                disabled={locked}
                onClick={apply}
              >
                <Icon size={17} aria-hidden="true" />
              </button>
            ))}
            <label
              className={`${toolClass} relative cursor-pointer`}
              title="Insert image"
            >
              <ImagePlus size={17} aria-hidden="true" />
              <input
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Insert image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={locked}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void upload(file);
                }}
              />
            </label>
          </div>
        )}
      </div>
      {uploading && (
        <p role="status" className="px-5 pt-3 text-sm text-slate-600">
          Uploading image…
        </p>
      )}
      {preview === null ? (
        <textarea
          ref={textarea}
          id="article-field-markdown"
          aria-labelledby="article-body-label"
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={invalid ? "article-error-html" : undefined}
          className="block min-h-[28rem] sm:min-h-[34rem] w-full resize-y rounded-b-xl p-5 font-mono text-base leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
          placeholder="Write your story…"
          value={source ?? editor?.getMarkdown() ?? ""}
          disabled={locked}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (
              (!event.ctrlKey && !event.metaKey) ||
              event.altKey ||
              event.nativeEvent.isComposing
            )
              return;
            const key = event.key.toLowerCase();
            if (key !== "z" && key !== "y") return;
            event.preventDefault();
            restoreHistory(key === "y" || event.shiftKey ? "redo" : "undo");
          }}
          onPaste={(event) => {
            const file = Array.from(event.clipboardData.files).find((item) =>
              item.type.startsWith("image/"),
            );
            if (file) {
              event.preventDefault();
              void upload(file);
            }
          }}
          onDrop={(event) => {
            const file = Array.from(event.dataTransfer.files).find((item) =>
              item.type.startsWith("image/"),
            );
            if (file) {
              event.preventDefault();
              void upload(file);
            }
          }}
        />
      ) : (
        <div
          id="article-body-preview"
          tabIndex={-1}
          className="blog-rich min-h-[28rem] sm:min-h-[34rem] p-5"
          aria-label="Article preview"
        >
          <BlogCover url={coverUrl} alt={coverAlt} />
          {editor?.isEmpty ? (
            <p className="text-slate-500">
              Your article preview will appear here.
            </p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          )}
        </div>
      )}
    </div>
  );
}
