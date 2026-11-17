"use client";

import { useState } from "react";
import {
  createNewsPost,
  updateNewsPost,
  deleteNewsPost,
  toggleNewsPostPublish,
} from "@/lib/actions/hq";
import Toast from "@/components/Toast";

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  category: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ["Product Updates", "Industry News", "Regulatory", "Company"] as const;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PostFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  author_name: string;
  category: string;
  tags: string;
  published: boolean;
}

const emptyForm: PostFormData = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  author_name: "",
  category: "Company",
  tags: "",
  published: false,
};

export default function HQNewsClient({ posts }: { posts: NewsPost[] }) {
  const [filter, setFilter] = useState<"all" | "published" | "drafts">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [formData, setFormData] = useState<PostFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [optimisticPublished, setOptimisticPublished] = useState<Record<string, boolean>>({});

  const filtered = posts.filter((p) => {
    if (filter === "published") return p.published;
    if (filter === "drafts") return !p.published;
    return true;
  });

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
  }

  function openCreateModal() {
    setEditingPost(null);
    setFormData(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(post: NewsPost) {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url ?? "",
      author_name: post.author_name,
      category: post.category,
      tags: post.tags.join(", "),
      published: post.published,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPost(null);
    setFormData(emptyForm);
  }

  function handleTitleChange(value: string) {
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug === generateSlug(prev.title) || !prev.slug ? generateSlug(value) : prev.slug,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!formData.slug.trim()) {
      showToast("Slug is required.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim(),
        content: formData.content,
        cover_image_url: formData.cover_image_url.trim() || null,
        author_name: formData.author_name.trim() || "Cervos Team",
        category: formData.category,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        published: formData.published,
      };

      const result = editingPost
        ? await updateNewsPost(editingPost.id, payload)
        : await createNewsPost(payload);

      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast(editingPost ? "Post updated." : "Post created.", "success");
        closeModal();
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeletingId(postId);
    try {
      const result = await deleteNewsPost(postId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Post deleted.", "success");
        window.location.reload();
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePublish(post: NewsPost) {
    const newPublished = !post.published;
    setOptimisticPublished((prev) => ({ ...prev, [post.id]: newPublished }));
    setTogglingId(post.id);
    try {
      const result = await toggleNewsPostPublish(post.id, newPublished);
      if (result.error) {
        setOptimisticPublished((prev) => ({ ...prev, [post.id]: post.published }));
        showToast(result.error, "error");
      } else {
        showToast(newPublished ? "Post published." : "Post unpublished.", "success");
        window.location.reload();
      }
    } finally {
      setTogglingId(null);
    }
  }

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.filter((p) => !p.published).length;

  return (
    <>
      <div className="flex gap-2 mb-6 items-center">
        {(["all", "published", "drafts"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-label-md text-label-md capitalize transition-colors ${
              filter === f
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f}
            {f === "published" && publishedCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-on-primary/20 text-on-primary rounded-full font-mono">
                {publishedCount}
              </span>
            )}
            {f === "drafts" && draftCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full font-mono">
                {draftCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={openCreateModal}
          className="ml-auto inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Post
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-base border border-outline-variant p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">newspaper</span>
          <p className="font-body-md text-on-surface-variant">
            {filter === "all" ? "No posts yet. Create your first article." : `No ${filter} posts.`}
          </p>
        </div>
      ) : (
        <div className="bg-surface-base border border-outline-variant overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                  Author
                </th>
                <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">
                  Date
                </th>
                <th className="text-right px-4 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {filtered.map((post) => {
                const isPublished = optimisticPublished[post.id] ?? post.published;
                const isToggling = togglingId === post.id;
                const isDeleting = deletingId === post.id;

                return (
                  <tr key={post.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-body-md text-body-md text-ink-deep font-medium truncate max-w-xs">
                        {post.title}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-xs">
                        /{post.slug}
                      </p>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {post.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {post.author_name}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <button
                        onClick={() => handleTogglePublish(post)}
                        disabled={isToggling}
                        className={`inline-flex items-center gap-1.5 font-label-md text-label-md px-2.5 py-1 rounded transition-colors ${
                          isPublished
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isToggling ? (
                          <div className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? "bg-green-600" : "bg-gray-400"}`} />
                        )}
                        {isPublished ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {formatDate(post.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(post)}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isDeleting}
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded transition-colors"
                          title="Delete"
                        >
                          {isDeleting ? (
                            <div className="w-[18px] h-[18px] border border-error/40 border-t-error rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-surface-base border border-outline-variant rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-base border-b border-outline-variant px-6 py-4 flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-ink-deep">
                {editingPost ? "Edit Post" : "New Post"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Post title"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Excerpt
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Brief description shown in cards..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Content (HTML)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="<p>Article content...</p>"
                  rows={10}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Cover Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, author_name: e.target.value }))}
                    placeholder="Cervos Team"
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3"
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="published-check"
                  checked={formData.published}
                  onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="published-check" className="font-body-md text-body-md text-on-surface cursor-pointer">
                  Published (visible to public)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-outline-variant rounded font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded font-label-md text-label-md hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {saving && (
                    <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                  )}
                  {editingPost ? "Save Changes" : "Create Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
