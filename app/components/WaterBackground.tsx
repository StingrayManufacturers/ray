"use client";

import { useEffect, useRef } from "react";

type Ripple = { x: number; y: number; t0: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function WaterBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Offscreen canvas to avoid blocky look (render low-res, scale up smoothly)
    const low = document.createElement("canvas");
    const lctx = low.getContext("2d", { alpha: true });
    if (!lctx) return;

    let w = 0;
    let h = 0;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.floor(window.innerWidth));
      h = Math.max(1, Math.floor(window.innerHeight));

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Low-res scale: smaller = faster, bigger = smoother
      const scale = 0.38; // try 0.33 for more FPS, 0.45 for more smoothness
      low.width = Math.max(1, Math.floor(w * scale));
      low.height = Math.max(1, Math.floor(h * scale));
    };

    const isNoRippleTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('[data-no-ripple="true"]'));
    };

    const addRipple = (ev: PointerEvent) => {
      if (isNoRippleTarget(ev.target)) return;
      const x = clamp01((ev.clientX || 0) / Math.max(1, w));
      const y = clamp01((ev.clientY || 0) / Math.max(1, h));
      ripplesRef.current.push({ x, y, t0: performance.now() });
      if (ripplesRef.current.length > 14) ripplesRef.current.shift();
    };

    const drawWaterLowRes = (time: number) => {
      // base black
      lctx.clearRect(0, 0, low.width, low.height);
      lctx.fillStyle = "#000";
      lctx.fillRect(0, 0, low.width, low.height);

      // top blue “underwater shine”
      const top = lctx.createRadialGradient(
        low.width * 0.5,
        -low.height * 0.1,
        0,
        low.width * 0.5,
        -low.height * 0.1,
        Math.max(low.width, low.height) * 1.1
      );
      top.addColorStop(0.0, "rgba(56,189,248,0.45)");
      top.addColorStop(0.35, "rgba(56,189,248,0.16)");
      top.addColorStop(0.75, "rgba(0,0,0,0)");
      lctx.fillStyle = top;
      lctx.fillRect(0, 0, low.width, low.height);

      if (prefersReducedMotion) return;

      // smooth flow field (small step, not big blocks)
      const t = time * 0.001;
      const step = 3; // smaller = smoother (2), larger = faster (4)
      const amp = 0.18;

      for (let yy = 0; yy < low.height; yy += step) {
        const ny = yy / low.height;
        for (let xx = 0; xx < low.width; xx += step) {
          const nx = xx / low.width;

          const v =
            Math.sin((nx * 7.0 + t * 0.55) * Math.PI * 2) * 0.55 +
            Math.sin((ny * 6.0 - t * 0.42) * Math.PI * 2) * 0.45 +
            Math.sin(((nx + ny) * 5.0 + t * 0.35) * Math.PI * 2) * 0.35;

          const a = (v * 0.5 + 0.5) * amp;
          lctx.fillStyle = `rgba(56,189,248,${a})`;
          lctx.fillRect(xx, yy, step, step);
        }
      }

      // vignette (keeps focus)
      const vg = lctx.createRadialGradient(
        low.width * 0.5,
        low.height * 0.35,
        0,
        low.width * 0.5,
        low.height * 0.35,
        Math.max(low.width, low.height) * 1.0
      );
      vg.addColorStop(0.0, "rgba(0,0,0,0)");
      vg.addColorStop(0.7, "rgba(0,0,0,0.55)");
      vg.addColorStop(1.0, "rgba(0,0,0,0.85)");
      lctx.fillStyle = vg;
      lctx.fillRect(0, 0, low.width, low.height);
    };

    const drawRipples = (time: number) => {
      const ripples = ripplesRef.current;
      if (!ripples.length) return;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 2;

      for (const r of ripples) {
        const age = (time - r.t0) / 1000;
        const maxAge = 1.9;
        if (age < 0 || age > maxAge) continue;

        const cx = r.x * w;
        const cy = r.y * h;
        const radius = age * 420;
        const fade = 1 - age / maxAge;

        for (let k = 0; k < 3; k++) {
          const rr = radius + k * 16;
          const alpha = fade * (0.24 - k * 0.06);
          ctx.strokeStyle = `rgba(56,189,248,${Math.max(0, alpha)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
      ripplesRef.current = ripples.filter((r) => (time - r.t0) / 1000 <= 1.9);
    };

    const frame = (time: number) => {
      drawWaterLowRes(time);

      // draw low-res water scaled up smoothly
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(low, 0, 0, low.width, low.height, 0, 0, w, h);

      // full-res ripples on top
      drawRipples(time);

      rafRef.current = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", addRipple, { passive: true });

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", addRipple as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}