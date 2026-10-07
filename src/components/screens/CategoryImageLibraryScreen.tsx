"use client";

import { useState, useRef } from "react";
import { useApp, fmtDate } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";
import { CategoryImage } from "@/lib/types";

export function CategoryImageLibraryScreen() {
  const params = useApp((s) => s.params);
  const categories = useApp((s) => s.categories);
  const categoryImages = useApp((s) => s.categoryImages);
  const navigate = useApp((s) => s.navigate);
  const uploadImageFile = useApp((s) => s.uploadImageFile);
  const addImageToCategoryLibrary = useApp((s) => s.addImageToCategoryLibrary);
  const setCategoryDefaultImage = useApp((s) => s.setCategoryDefaultImage);
  const deleteCategoryImage = useApp((s) => s.deleteCategoryImage);

  const [activeCat, setActiveCat] = useState<number | null>(
    params.categoryId || categories[0]?.id || null
  );
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CategoryImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => c.id === activeCat);
  const images = categoryImages.filter((i) => i.categoryId === activeCat);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeCat) return;
    setErr("");
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await uploadImageFile(file);
        if (!res.ok || !res.url) {
          setErr(res.error || "Upload failed");
          break;
        }
        addImageToCategoryLibrary(activeCat, res.url, false);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="px-3 pt-3 pb-28">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3">
        <p className="text-sm font-bold text-violet-800">🖼️ Category Image Library</p>
        <p className="text-xs text-violet-700 mt-0.5">
          Upload product photos once per category. The first image becomes the default — every
          product in this category automatically uses it unless overridden.
        </p>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
              activeCat === c.id
                ? "bg-teal-50 border-teal-500 text-teal-700"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Active category panel */}
      {category && (
        <div className="mt-3">
          <div className="bg-white rounded-xl p-3 border border-slate-100 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center text-2xl overflow-hidden">
                {category.defaultImageUrl ? (
                   
                  <img
                    src={category.defaultImageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{category.icon}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{category.icon} {category.name}</p>
                <p className="text-[11px] text-slate-500">
                  {images.length} {images.length === 1 ? "image" : "images"} in library
                </p>
                {category.defaultImageUrl ? (
                  <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                    ✓ Default set — new products auto-use this
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 font-bold mt-0.5">
                    ⚠ No default — emoji fallback used
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-violet-600 hover:bg-violet-500 font-bold h-12 mb-3"
          >
            {uploading ? "⏳ Uploading…" : "📤 Upload Image(s)"}
          </Button>

          {err && (
            <p className="text-rose-600 text-sm bg-rose-50 p-2 rounded-lg mb-3">{err}</p>
          )}

          {/* Images grid */}
          {images.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <p className="text-4xl mb-2">📷</p>
              <p className="text-slate-500 text-sm">No images yet</p>
              <p className="text-slate-400 text-xs mt-1">
                Upload the first image — it becomes the default automatically
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`bg-white rounded-xl p-2 shadow-sm border-2 ${
                    img.isDefault ? "border-emerald-400" : "border-slate-100"
                  }`}
                >
                  <div className="aspect-square bg-slate-50 rounded-lg overflow-hidden relative">
                    { }
                    <img
                      src={img.url}
                      alt={`Library image ${img.id}`}
                      className="w-full h-full object-cover"
                    />
                    {img.isDefault && (
                      <span className="absolute top-1 left-1 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {!img.isDefault && (
                      <button
                        onClick={() => setCategoryDefaultImage(category.id, img.id)}
                        className="flex-1 py-1.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(img)}
                      className="flex-1 py-1.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center mt-1">
                    {fmtDate(img.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      <Sheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete image?"
      >
        {confirmDelete && (
          <div>
            <div className="bg-slate-50 rounded-lg p-2 mb-3 flex items-center justify-center">
              { }
              <img
                src={confirmDelete.url}
                alt="To delete"
                className="max-h-40 rounded-lg object-cover"
              />
            </div>
            <p className="text-sm text-slate-600 mb-3">
              {confirmDelete.isDefault ? (
                <>
                  This is the <b>default</b> image for this category. Deleting it will promote the
                  next available image as default (or revert to emoji fallback if none left).
                </>
              ) : (
                <>This image will be removed from the library.</>
              )}
              Products that were using this image directly will keep their photo reference.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  deleteCategoryImage(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="bg-rose-600 hover:bg-rose-500 font-bold"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
