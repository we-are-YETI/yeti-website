"use client";

import { useEffect, useRef } from "react";

export function BlogConfirm({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="Confirm action"
      onCancel={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/45"
    >
      <p className="text-lg font-semibold">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button autoFocus className="blog-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="blog-primary" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </dialog>
  );
}

export function BlogChoices({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-wrap gap-1.5">
      <legend className="sr-only">{label}</legend>
      {options.map(([id, name]) => (
        <label key={id} className="relative">
          <input
            type="radio"
            name={label}
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
            className="peer sr-only"
          />
          <span className="block cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 peer-checked:border-blue-700 peer-checked:bg-blue-50 peer-checked:text-blue-900 peer-focus-visible:outline-2 peer-focus-visible:outline-blue-700 peer-disabled:cursor-default peer-disabled:opacity-60">
            {name}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
