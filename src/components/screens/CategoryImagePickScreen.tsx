"use client";

import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/parts/Sheet";

interface PickResult {
  url: string;
  source: "library" | "upload" | "default";
}

export function CategoryImagePickScreen() {
  const params = useApp((s) => s.params);
  const categories = useApp((s) => s.categories);
  const items = useApp((s) => s.items);
  const categoryImages = useApp((s) => s.categoryImages);
  const uploadImageFile = useApp((s) => s.uploadImageFile);
  const addImageToCategoryLibrary = useApp((s) => s.addImageToCategoryLibrary);
  const setItemPhoto = useApp((s) => s.setItemPhoto);
  const setDraftItemPhoto = useApp((s) => s.setDraftItemPhoto);
  const goBack = useApp((s) => s.goBack);

  const editing = params.pickForItemId
    ? items.find((i) => i.id === params.pickForItemId)
    : null;
  const categoryId = editing?.categoryId || params.categoryId;
  const category = categories.find((c) => c.id === categoryId);
  const images = categoryImages.filter((i) => i.categoryId === categoryId);

  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apply = (result: PickResult | null) => {
    if (params.pickForItemId) {
      setItemPhoto(params.pickForItemId, result?.url);
    } else {
      setDraftItemPhoto(result?.url);
    }
    goBack();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !categoryId) return;
    setErr("");
    setUploading(true);
    try {
      const file = files[0];
      const res = await uploadImageFile(file);
      if (!res.ok || !res.url) {
        setErr(res.error || "Upload failed");
        return;
      }
      // Add to library for reuse + apply to item
      addImageToCategoryLibrary(categoryId, res.url, false);
      apply({ url: res.url, source: "upload" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!category) {
    return (
      <div className="p-6 text-center text-slate-500">
        Category not found. Pick a category first.
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-28">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3">
        <p className="text-sm font-bold text-violet-800">
          🖼️ Image for {category.icon} {category.name}
        </p>
        <p className="text-xs text-violet-700 mt-0.5">
          Pick from library (one tap), upload a new photo, or use the category default. Uploaded
          photos auto-save to this category&apos;s library for future products.
        </p>
      </div>

      {/* Current default */}
      {category.defaultImageUrl && (
        <div className="bg-white rounded-xl p-3 border-2 border-emerald-200 mb-3">
          <p className="text-[11px] font-bold uppercase text-emerald-700 mb-2">
            ✓ Category Default
          </p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-50">
              { }
              <img
                src={category.defaultImageUrl}
                alt="Default"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-600">
                Used automatically by every product in this category that has no own photo.
              </p>
            </div>
            <Button
              onClick={() => apply(null)}
              variant="outline"
              className="border-emerald-300 text-emerald-700 font-bold"
              size="sm"
            >
              Use Default
            </Button>
          </div>
        </div>
      )}

      {/* Upload new */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full bg-violet-600 hover:bg-violet-500 font-bold h-12 mb-3"
      >
        {uploading ? "⏳ Uploading…" : "📤 Upload New Photo"}
      </Button>

      {err && (
        <p className="text-rose-600 text-sm bg-rose-50 p-2 rounded-lg mb-3">{err}</p>
      )}

      {/* Library */}
      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-2">
        Library ({images.length})
      </h3>
      {images.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
          <p className="text-3xl mb-2">📷</p>
          <p className="text-slate-500 text-sm">Library is empty</p>
          <p className="text-slate-400 text-xs mt-1">
            Upload a photo above — it will be saved here for reuse
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => apply({ url: img.url, source: "library" })}
              className={`aspect-square rounded-lg overflow-hidden bg-slate-50 border-2 hover:border-teal-500 transition relative ${
                img.isDefault ? "border-emerald-400" : "border-slate-100"
              }`}
            >
              { }
              <img
                src={img.url}
                alt={`Pick ${img.id}`}
                className="w-full h-full object-cover"
              />
              {img.isDefault && (
                <span className="absolute top-1 left-1 text-[8px] font-bold bg-emerald-500 text-white px-1 py-0.5 rounded">
                  DEFAULT
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Clear / Remove photo (if editing) */}
      {editing?.photoUrl && (
        <Button
          onClick={() => apply(null)}
          variant="outline"
          className="w-full mt-4 border-rose-200 text-rose-700 font-bold h-11"
        >
          🗑 Remove Photo (use category default / emoji)
        </Button>
      )}
    </div>
  );
}
