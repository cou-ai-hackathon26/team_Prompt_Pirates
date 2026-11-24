"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Long enough to tell the whole day in one message (the app sends it as compressed MP3). */
export const MAX_RECORD_SECONDS = 120;
/** Show a "time almost up" warning for the last few seconds. */
export const RECORD_WARN_SECONDS = 15;
/** Number of bars in the live voice visualizer. */
export const BAR_COUNT = 32;

/**
 * MediaRecorder wrapper: start/stop, elapsed seconds, live input level (0..1) for the meter,
 * auto-stop at MAX_RECORD_SECONDS. Mic access requires HTTPS (or localhost).
 */
export function useRecorder() {
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [bars, setBars] = useState<number[]>(() =>
    Array<number>(BAR_COUNT).fill(0),
  );
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);
  const ctx = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    setLevel(0);
    setBars(Array<number>(BAR_COUNT).fill(0));
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError(
        "এই ব্রাউজারে মাইক্রোফোন চালু করা যাচ্ছে না। Chrome ব্যবহার করুন, অথবা নিচের ফর্ম দিন।",
      );
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = s;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        cleanup();
        setBlob(new Blob(chunks, { type: r.mimeType }));
        setState("done");
      };
      rec.current = r;

      // input level meter
      const ac = new AudioContext();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 512;
      ac.createMediaStreamSource(s).connect(an);
      an.smoothingTimeConstant = 0.7;
      const buf = new Uint8Array(an.fftSize);
      const freq = new Uint8Array(an.frequencyBinCount);
      // Speech energy sits roughly in the lowest ~40% of bins at this FFT size; spread it over the bars.
      const usable = Math.floor(freq.length * 0.4);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        an.getByteFrequencyData(freq);
        const per = Math.max(1, Math.floor(usable / BAR_COUNT));
        setBars(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            let m = 0;
            for (let k = i * per; k < (i + 1) * per; k++)
              m = Math.max(m, freq[k] ?? 0);
            return m / 255;
          }),
        );
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      const t0 = Date.now();
      setElapsed(0);
      timer.current = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setElapsed(sec);
        if (sec >= MAX_RECORD_SECONDS) r.stop();
      }, 250);

      r.start();
      setState("recording");
    } catch (e) {
      cleanup();
      setState("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "মাইক্রোফোনের অনুমতি দেওয়া হয়নি। ব্রাউজারের ঠিকানা-বারে 🔒 চাপে অনুমতি দিন, অথবা নিচের ফর্ম ব্যবহার করুন।"
          : "মাইক্রোফোন চালু হয়নি। নিচের ফর্ম ব্যবহার করুন।",
      );
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    setBlob(null);
    setElapsed(0);
    setState("idle");
  }, []);

  return { state, elapsed, level, bars, error, blob, start, stop, reset };
}
