"use client";
import React, { useRef, useEffect } from "react";

/**
 * A centered, cropped, zoomed geometry video that sits BEHIND the Scope UI.
 * - It reuses the main page blend/filters (copy the same classes!)
 * - Only a middle "spotlight" area is visible (container crops the rest)
 * - Pointer-events: none so it never blocks clicks
 * - Tune `scale`, `offsetX`, `offsetY`, and `sizeVmin` to frame the geometry
 */
export default function GeometrySpotlight({
  src = "/video/geometry.webm",          // <-- use the same file as main page
  scale = 2.6,                            // zoom in
  offsetX = 0,                            // px shift to center the motif horizontally
  offsetY = 0,                            // px shift to center the motif vertically
  sizeVmin = 110,                         // spotlight diameter in vmin (e.g. 90–140)
  opacity = 0.22,                         // keep in sync with main page look
  startAt = 0,                            // optional: jump to a timecode where motif is visible
  className = "",                         // put the SAME blend/filters as main page here
}: {
  src?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  sizeVmin?: number;
  opacity?: number;
  startAt?: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () => {
      try {
        if (startAt > 0 && startAt < (v.duration || 1e9)) v.currentTime = startAt;
      } catch {}
      v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [startAt]);

  const size = `${sizeVmin}vmin`;

  return (
    <div
      className={[
        "pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        "z-0",                 // BEHIND everything; keep your dim overlay above this
        "overflow-hidden",     // crop to spotlight
        "rounded-full",        // soft circular crop (remove if you want square)
      ].join(" ")}
      style={{
        width: size,
        height: size,
        // soft feather at the edge (mask works in modern browsers)
        WebkitMaskImage: "radial-gradient(closest-side, black 92%, transparent 100%)",
        maskImage: "radial-gradient(closest-side, black 92%, transparent 100%)",
        opacity,
      } as React.CSSProperties}
    >
      <video
        ref={ref}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={[
          // Position the video center, then move/zoom it to frame the geometry
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "will-change-transform object-cover",
          // IMPORTANT: copy the SAME blend/filters from main page here:
          // e.g. "mix-blend-screen" OR whatever the landing uses
          className,
        ].join(" ")}
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          // If main page uses filters, copy EXACTLY:
          // filter: "contrast(var(--geo-contrast)) saturate(var(--geo-sat))",
        } as React.CSSProperties}
      />
    </div>
  );
}
