"use client";

import { useEffect, useRef } from "react";

export type VideoStatus = "loading" | "playing" | "paused" | "blocked" | "error";

/**
 * One muted, looping, inline <video> — the single hero decoder.
 * Client-only: call from a module loaded with `dynamic(..., { ssr: false })`.
 *
 * The element is created in an effect and held in a ref; cleanup fully releases
 * it (pause → remove src → load()), which also makes React Strict Mode's
 * mount/unmount/remount safe. Read `ref.current` only in effects or frames.
 */
export function useVideoSource(
  src: string,
  {
    playing,
    playbackRate = 1,
    onStatus,
  }: { playing: boolean; playbackRate?: number; onStatus?: (s: VideoStatus) => void },
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  });

  // Create, attach and release the element.
  useEffect(() => {
    const report = (s: VideoStatus) => onStatusRef.current?.(s);
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "metadata";

    // crossOrigin must be set before src for remote (CORS-enabled) sources.
    try {
      const url = new URL(src, window.location.href);
      if (url.origin !== window.location.origin && url.protocol !== "blob:") {
        video.crossOrigin = "anonymous";
      }
    } catch {
      // Malformed URL: let the element report the error.
    }

    const onPlaying = () => report("playing");
    const onError = () => report("error");
    const onLoadStart = () => report("loading");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    video.addEventListener("loadstart", onLoadStart);

    video.src = src;
    videoRef.current = video;

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadstart", onLoadStart);
      video.pause();
      video.removeAttribute("src");
      video.load(); // releases the decoder
      videoRef.current = null;
    };
  }, [src]);

  // Speed. defaultPlaybackRate keeps it across `loop` restarts and reloads.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const rate = Math.min(Math.max(playbackRate, 0.0625), 4);
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
  }, [src, playbackRate]);

  // Play / pause with the visibility + user pause state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      onStatusRef.current?.("paused");
      return;
    }
    video.play().catch((err: unknown) => {
      // AbortError = a newer pause()/src change interrupted play(); not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      const blocked = err instanceof DOMException && err.name === "NotAllowedError";
      onStatusRef.current?.(blocked ? "blocked" : "error");
    });
  }, [src, playing]);

  return videoRef;
}
