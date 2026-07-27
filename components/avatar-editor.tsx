"use client";

import { upload } from "@vercel/blob/client";
import { Camera, Eye, Trash, X } from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
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
  const image = new window.Image();
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
  canEdit?: boolean;
  presentation?: "inline" | "profile";
}

export function AvatarEditor({
  avatarUrl,
  name,
  targetUserId,
  compact = false,
  canEdit = true,
  presentation = "inline",
}: AvatarEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const viewerCloseRef = useRef<HTMLButtonElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    setMenuOpen(false);
    setViewerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !avatarButtonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        avatarButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!viewerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    viewerCloseRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setViewerOpen(false);
        avatarButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !viewerRef.current) return;

      const focusable = Array.from(
        viewerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

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

  function openFilePicker() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  function openViewer() {
    setMenuOpen(false);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
    avatarButtonRef.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    } else if (event.key === "Tab") {
      setMenuOpen(false);
    }
  }

  const photoDialogs = (
    <>
      {viewerOpen && avatarUrl ? (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-ink/90 p-4">
          <button
            aria-label="Close enlarged profile photo"
            className="absolute inset-0 cursor-default"
            onClick={closeViewer}
            type="button"
          />
          <section
            ref={viewerRef}
            aria-label={`${name}'s profile photo`}
            aria-modal="true"
            className="relative z-10 flex w-full max-w-xl flex-col items-end"
            role="dialog"
          >
            <button
              ref={viewerCloseRef}
              aria-label="Close enlarged profile photo"
              className="icon-button mb-3 border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={closeViewer}
              type="button"
            >
              <X aria-hidden size={22} weight="bold" />
            </button>
            <Image
              alt={`${name}'s enlarged profile photo`}
              className="aspect-square h-auto max-h-[78svh] w-full rounded-[28px] object-cover shadow-2xl"
              height={512}
              priority
              src={avatarUrl}
              width={512}
            />
          </section>
        </div>
      ) : null}

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
    </>
  );

  if (presentation === "profile") {
    const interactive = canEdit || Boolean(avatarUrl);

    return (
      <div className="relative shrink-0">
        <input
          ref={fileInputRef}
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={(event) => void selectFile(event.target.files?.[0])}
          type="file"
        />
        {interactive ? (
          <button
            ref={avatarButtonRef}
            aria-controls="profile-avatar-menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Open ${name}'s profile photo actions`}
            className="block min-h-20 min-w-20 rounded-full outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
            disabled={busy}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <ParticipantAvatar avatarUrl={avatarUrl} name={name} size="lg" />
          </button>
        ) : (
          <ParticipantAvatar avatarUrl={null} name={name} size="lg" />
        )}
        {menuOpen ? (
          <div
            ref={menuRef}
            aria-label="Profile photo actions"
            className="absolute left-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-black/10 bg-cream p-1.5 shadow-[0_16px_40px_rgba(32,51,38,0.18)]"
            id="profile-avatar-menu"
            onKeyDown={handleMenuKeyDown}
            role="menu"
          >
            {avatarUrl ? (
              <button className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-ink hover:bg-sand" onClick={openViewer} role="menuitem" type="button">
                <Eye aria-hidden size={18} weight="bold" />
                View photo
              </button>
            ) : null}
            {canEdit ? (
              <button className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-ink hover:bg-sand" onClick={openFilePicker} role="menuitem" type="button">
                <Camera aria-hidden size={18} weight="bold" />
                {avatarUrl ? "Change photo" : "Add photo"}
              </button>
            ) : null}
            {canEdit && avatarUrl ? (
              <button className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[#9B3F2D] hover:bg-[#F8E6E1]" onClick={() => { setMenuOpen(false); void removePhoto(); }} role="menuitem" type="button">
                <Trash aria-hidden size={18} weight="bold" />
                Remove photo
              </button>
            ) : null}
          </div>
        ) : null}
        {error && !sourceUrl ? (
          <p className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl bg-cream p-2 text-sm font-medium text-[#9B3F2D] shadow-md" role="alert">{error}</p>
        ) : null}
        {photoDialogs}
      </div>
    );
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
        <button className="secondary-button min-h-11" disabled={busy} onClick={openFilePicker} type="button">
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
      {photoDialogs}
    </div>
  );
}
