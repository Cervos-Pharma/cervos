"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import WebpPhotoInput from "@/components/WebpPhotoInput";
import type { HqJournalArticleRecord } from "./types";

interface HQJournalSectionProps {
  articles: HqJournalArticleRecord[];
  operatorName: string;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

const COVER_PRESETS = [
  { label: "Counter Station", url: "/cervos-people-counter.jpg" },
  { label: "Dispensary Shelves", url: "/cervos-people-shelves.jpg" },
  { label: "Supply Logistics", url: "/cervos-people-logistics.jpg" },
  { label: "Counter Hardware", url: "/cervos-counter-station.jpg" },
];

export default function HQJournalSection({
  articles,
  operatorName,
  onRunAction,
  isDark,
  busy,
}: HQJournalSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState<"field" | "craft" | "supply">("field");
  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleSw, setTitleSw] = useState("");
  const [deckEn, setDeckEn] = useState("");
  const [deckSw, setDeckSw] = useState("");
  const [quoteEn, setQuoteEn] = useState("");
  const [quoteSw, setQuoteSw] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodySw, setBodySw] = useState("");
  const [author, setAuthor] = useState(operatorName || "Cervos Field Desk");
  const [authorRoleEn, setAuthorRoleEn] = useState("Cervos Editorial Desk");
  const [authorRoleSw, setAuthorRoleSw] = useState("Dawati la Uhariri Cervos");
  const [image, setImage] = useState("/cervos-people-counter.jpg");
  const [status, setStatus] = useState<"draft" | "published">("published");

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const inputCls = isDark
    ? "bg-[#090C12] border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  const resetForm = () => {
    setEditingId(null);
    setTopic("field");
    setSlug("");
    setTitleEn("");
    setTitleSw("");
    setDeckEn("");
    setDeckSw("");
    setQuoteEn("");
    setQuoteSw("");
    setBodyEn("");
    setBodySw("");
    setImage("/cervos-people-counter.jpg");
    setStatus("published");
  };

  const loadForEdit = (art: HqJournalArticleRecord) => {
    setEditingId(art.id);
    setTopic(art.topic);
    setSlug(art.slug);
    setTitleEn(art.titleEn);
    setTitleSw(art.titleSw);
    setDeckEn(art.deckEn);
    setDeckSw(art.deckSw);
    setQuoteEn(art.quoteEn);
    setQuoteSw(art.quoteSw);
    setBodyEn(art.paragraphsEn.join("\n\n"));
    setBodySw(art.paragraphsSw.join("\n\n"));
    setAuthor(art.author);
    setAuthorRoleEn(art.authorRoleEn);
    setAuthorRoleSw(art.authorRoleSw);
    setImage(art.image);
    setStatus(art.status);
  };

  const handleSave = async (e: FormEvent, saveStatus: "draft" | "published") => {
    e.preventDefault();
    if (titleEn.trim().length < 4 || deckEn.trim().length < 8) return;
    const ok = await onRunAction(
      {
        action: "upsert_journal_article",
        id: editingId ?? undefined,
        slug: slug.trim() || undefined,
        topic,
        titleEn: titleEn.trim(),
        titleSw: titleSw.trim() || undefined,
        deckEn: deckEn.trim(),
        deckSw: deckSw.trim() || undefined,
        quoteEn: quoteEn.trim() || undefined,
        quoteSw: quoteSw.trim() || undefined,
        bodyEn: bodyEn.trim() || deckEn.trim(),
        bodySw: bodySw.trim() || undefined,
        author: author.trim(),
        authorRoleEn: authorRoleEn.trim(),
        authorRoleSw: authorRoleSw.trim(),
        image,
        status: saveStatus,
      },
      saveStatus === "published"
        ? `Published article "${titleEn.trim()}" to The Dispatch`
        : `Saved draft "${titleEn.trim()}"`
    );
    if (ok && !editingId) {
      resetForm();
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Journal Archive Table */}
      <div className={`xl:col-span-5 rounded-xl border overflow-hidden ${cardCls}`}>
        <div className="px-4 py-3 border-b border-slate-500/15 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">The Dispatch Articles ({articles.length})</h2>
            <p className={`text-[11px] ${mutedCls}`}>
              Published essays go live immediately on /dispatch.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 rounded-lg bg-[#1039B9] text-white text-[11px] font-semibold cursor-pointer"
          >
            + New Essay
          </button>
        </div>

        {articles.length === 0 ? (
          <div className={`p-6 text-xs ${mutedCls}`}>
            No custom HQ articles yet. Write your first field essay using the studio on the right.
          </div>
        ) : (
          <div className="divide-y divide-slate-500/15">
            {articles.map((art) => (
              <div
                key={art.id}
                onClick={() => loadForEdit(art)}
                className={`p-3.5 flex items-start justify-between gap-3 text-xs cursor-pointer transition-colors ${
                  editingId === art.id
                    ? isDark
                      ? "bg-[#151D2C]"
                      : "bg-[#F4F7FF]"
                    : isDark
                      ? "hover:bg-slate-900/50"
                      : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                        art.status === "published" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="font-semibold truncate">{art.titleEn}</span>
                  </div>
                  <div className={`text-[11px] font-mono truncate ${mutedCls}`}>
                    /dispatch/{art.slug} &middot; {art.topic}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {art.status === "published" && (
                    <Link
                      href={`/dispatch/${art.slug}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-semibold text-[#1039B9] dark:text-[#38BDF8] hover:underline"
                    >
                      View &rarr;
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onRunAction(
                        { action: "delete_journal_article", id: art.id },
                        `Deleted article ${art.titleEn}`
                      );
                      if (editingId === art.id) resetForm();
                    }}
                    className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Bilingual Journal Studio + 480p WebP Cover Photo */}
      <form
        onSubmit={(e) => void handleSave(e, status)}
        className={`xl:col-span-7 rounded-xl border p-5 space-y-4 ${cardCls}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-500/15">
          <div>
            <h3 className="text-base font-semibold">
              {editingId ? `Editing: ${titleEn || "Untitled"}` : "Compose New Dispatch Essay"}
            </h3>
            <p className={`text-xs ${mutedCls}`}>
              Separate paragraphs with a blank line. Upload any cover photo (auto-compressed to 480p WebP).
            </p>
          </div>
          <Link href="/dispatch" target="_blank" className="text-xs font-semibold text-[#1039B9] dark:text-[#38BDF8] hover:underline">
            Open Live Journal &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Topic</span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as "field" | "craft" | "supply")}
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            >
              <option value="field">Field Notes</option>
              <option value="craft">Craft &amp; Practice</option>
              <option value="supply">Supply Notes</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>URL Slug (Optional)</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated-from-title"
              disabled={Boolean(editingId)}
              className={`w-full h-9 px-3 rounded-lg border font-mono ${inputCls} disabled:opacity-60`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Author</span>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            />
          </label>
        </div>

        <div className="space-y-2">
          <WebpPhotoInput
            value={image}
            onChange={setImage}
            label="Cover Photo (Auto-compressed 480p WebP)"
            maxEdge={480}
            isDark={isDark}
          />
          <div className="flex flex-wrap gap-1.5">
            {COVER_PRESETS.map((p) => (
              <button
                key={p.url}
                type="button"
                onClick={() => setImage(p.url)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer ${
                  image === p.url ? "border-[#1039B9] text-[#1039B9] dark:text-[#38BDF8]" : mutedCls
                }`}
              >
                Preset: {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Headline (English) *</span>
            <input
              type="text"
              required
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Why quiet stock audits protect rural clinics..."
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Kichwa cha Habari (Kiswahili)</span>
            <input
              type="text"
              value={titleSw}
              onChange={(e) => setTitleSw(e.target.value)}
              placeholder="Kwa nini ukaguzi wa stoo hulinda vituo..."
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Deck / Summary (English) *</span>
            <textarea
              required
              rows={2}
              value={deckEn}
              onChange={(e) => setDeckEn(e.target.value)}
              placeholder="2-sentence editorial summary..."
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Muhtasari (Kiswahili)</span>
            <textarea
              rows={2}
              value={deckSw}
              onChange={(e) => setDeckSw(e.target.value)}
              placeholder="Muhtasari mfupi kwa Kiswahili..."
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Body Paragraphs (English)</span>
            <textarea
              rows={6}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              placeholder="Paragraph 1...\n\nParagraph 2..."
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Maelezo Kamili (Kiswahili)</span>
            <textarea
              rows={6}
              value={bodySw}
              onChange={(e) => setBodySw(e.target.value)}
              placeholder="Aya ya kwanza...\n\nAya ya pili..."
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Pull Quote (EN)</span>
            <input
              type="text"
              value={quoteEn}
              onChange={(e) => setQuoteEn(e.target.value)}
              placeholder="Key takeaway quote highlighted in the essay..."
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            />
          </label>
          <label className="space-y-1">
            <span className={`font-semibold ${mutedCls}`}>Nukuu Kuu (SW)</span>
            <input
              type="text"
              value={quoteSw}
              onChange={(e) => setQuoteSw(e.target.value)}
              className={`w-full h-9 px-3 rounded-lg border ${inputCls}`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={busy || titleEn.trim().length < 4 || deckEn.trim().length < 8}
            onClick={(e) => {
              setStatus("draft");
              void handleSave(e, "draft");
            }}
            className="px-4 py-2 rounded-lg border border-slate-500/30 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={busy || titleEn.trim().length < 4 || deckEn.trim().length < 8}
            onClick={() => setStatus("published")}
            className="px-5 py-2 rounded-lg bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {busy && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            <span>{busy ? "Publishing..." : "Publish to /dispatch"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
