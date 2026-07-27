"use client";

import { upload } from "@vercel/blob/client";
import { Camera, Trash, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { ParticipantAvatar } from "@/components/participant-avatar";
import { removeAvatarAction } from "@/lib/actions/avatar-actions";

const ORIGINAL_LIMIT = 20 * 1024 * 1024;
const FINAL_LIMIT = 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

async function decodeOriginal(file: File) {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);

  if (!isHeic) {
    return file;
  }

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });

  return Array.isArray(converted) ? converted[0] : converted;
}

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function exportAvatar(sourceUrl: string, crop: Area) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot process the photo.");
  }

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    512,
    512,
  );

  for (let quality = 0.85; quality >= 0.45; quality -= 0.08) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );

    if (blob && blob.size <= FINAL_LIMIT) {
      return blob;
    }
  }

  throw new Error("The cropped photo could not be compressed below 1 MB.");
}

interface AvatarEditorProps {
  avatarUrl: string | null;
  name: string;
  targetUserId: string;
  compact?: boolean;
}

export function AvatarEditor({
  avatarUrl,
  name,
  targetUserId,
  compact = false,
}: AvatarEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  function closeEditor() {
    if (busy) return;
    setSourceUrl(null);
    setError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function selectFile(file: File | undefined) {
    setError("");
    if (!file) return;

    if (file.size > ORIGINAL_LIMIT) {
      setError("Choose a photo smaller than 20 MB.");
      return;
    }

    if (!ALLOWED_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      setError("Use a JPEG, PNG, WebP, HEIC or HEIF photo.");
      return;
    }

    setBusy(true);
    try {
      const decoded = await decodeOriginal(file);
      setSourceUrl(URL.createObjectURL(decoded));
    } catch {
      setError("This photo could not be opened. Try another image.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function savePhoto() {
    if (!sourceUrl || !croppedArea) return;
    setBusy(true);
    setError("");

    try {
      const avatar = await exportAvatar(sourceUrl, croppedArea);
      await upload(`avatars/${targetUserId}/avatar.webp`, avatar, {
        access: "public",
        contentType: "image/webp",
        handleUploadUrl: "/api/avatar/upload",
        clientPayload: JSON.stringify({ targetUserId }),
      });
      setBusy(false);
      closeEditor();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Photo upload failed. Please try again.",
      );
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setError("");
    const result = await removeAvatarAction(targetUserId);
    setBusy(false);

    if (result.status === "error") {
      setError(result.message ?? "Profile photo could not be removed.");
      return;
    }

    router.refresh();
  }

  return (
    <div className={compact ? "flex items-center gap-3" : "space-y-3"}>
      <ParticipantAvatar avatarUrl={avatarUrl} name={name} size={compact ? "lg" : "md"} />
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={(event) => void selectFile(event.target.files?.[0])}
          type="file"
        />
        <button
          className="secondary-button min-h-11"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Camera aria-hidden size={19} weight="bold" />
          {avatarUrl ? "Change photo" : "Add photo"}
        </button>
        {avatarUrl ? (
          <button className="secondary-button min-h-11" disabled={busy} onClick={() => void removePhoto()} type="button">
            <Trash aria-hidden size={19} weight="bold" />
            Remove
          </button>
        ) : null}
      </div>
      {error && !sourceUrl ? <p className="text-sm font-medium text-[#9B3F2D]" role="alert">{error}</p> : null}

      {sourceUrl ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/55 p-3">
          <section aria-labelledby="avatar-editor-title" aria-modal="true" className="panel relative w-full max-w-lg overflow-hidden p-4 sm:p-5" role="dialog">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Profile photo</p>
                <h2 className="mt-1 text-xl font-semibold" id="avatar-editor-title">Adjust crop</h2>
              </div>
              <button aria-label="Close photo editor" className="icon-button" disabled={busy} onClick={closeEditor} type="button">
                <X aria-hidden size={20} weight="bold" />
              </button>
            </div>

            <div className="relative mt-4 aspect-square overflow-hidden rounded-[22px] bg-ink">
              <Cropper
                aspect={1}
                crop={crop}
                cropShape="round"
                image={sourceUrl}
                onCropChange={setCrop}
                onCropComplete={(_, pixels) => setCroppedArea(pixels)}
                onZoomChange={setZoom}
                showGrid={false}
                zoom={zoom}
              />
            </div>
            <label className="mt-4 block text-sm font-medium">
              <span>Zoom</span>
              <input
                aria-label="Photo zoom"
                className="mt-2 w-full accent-moss"
                max={3}
                min={1}
                onChange={(event) => setZoom(Number(event.target.value))}
                step={0.05}
                type="range"
                value={zoom}
              />
            </label>
            {error ? <p className="mt-3 text-sm font-medium text-[#9B3F2D]" role="alert">{error}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="secondary-button justify-center" disabled={busy} onClick={closeEditor} type="button">Cancel</button>
              <button className="primary-button justify-center" disabled={busy} onClick={() => void savePhoto()} type="button">Save photo</button>
            </div>

            {busy ? (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-cream/85 backdrop-blur-sm">
                <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-4 border-moss/20 border-t-moss" />
                <span className="sr-only" role="status">Uploading profile photo</span>
              </div>
            ) : null}
          </section>
        </div>
      ) : busy ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-cream/85 backdrop-blur-sm">
          <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-4 border-moss/20 border-t-moss" />
          <span className="sr-only" role="status">Processing profile photo</span>
        </div>
      ) : null}
    </div>
  );
}
