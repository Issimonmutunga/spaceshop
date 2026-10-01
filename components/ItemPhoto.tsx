"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Glyph } from "./Glyph";

/**
 * A photo when there is one, a calm glyph when there is not. Photos are Blobs
 * in IndexedDB, so they survive offline and never touch the server.
 */
export default function ItemPhoto({
  photoId,
  name,
  size = 96,
  className = "",
}: {
  photoId?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  if (!photoId) return <Glyph name={name} size={size} className={className} />;
  // Keyed by photo, so a changed photo starts loading rather than showing the
  // previous one.
  return (
    <PhotoBlob key={photoId} photoId={photoId} name={name} size={size} className={className} />
  );
}

function PhotoBlob({
  photoId,
  name,
  size,
  className,
}: {
  photoId: string;
  name: string;
  size: number;
  className: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void db.photos.get(photoId).then((photo) => {
      if (cancelled || !photo) return;
      objectUrl = URL.createObjectURL(photo.thumb);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!url) {
    return (
      <div
        aria-hidden
        className={`shimmer rounded-md bg-surface/60 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // Blobs from IndexedDB: a plain <img>, no optimizer in the way.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className={`object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
