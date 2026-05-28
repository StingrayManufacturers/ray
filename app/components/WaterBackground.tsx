"use client";

import { useEffect, useRef } from "react";

type Ripple = {
  x: number; // 0..1
  y: number; // 0..1
  t0: number; // ms
};

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

    let w = 0;
    let h = 0;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      // cap ripple count
      if (ripplesRef.current.length > 14) ripplesRef.current.shift();
    };

    const drawWater = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Base black
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      // Top blue shine
      const topGrad = ctx.createRadialGradient(
        w * 0.5,
        -h * 0.1,
        0,
        w * 0.5,
        -h * 0.1,
        Math.max(w, h) * 1.05
      );
      topGrad.addColorStop(0.0, "rgba(56,189,248,0.42)");
      topGrad.addColorStop(0.35, "rgba(56,189,248,0.16)");
      topGrad.addColorStop(0.75, "rgba(0,0,0,0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, h);

      // Static soft rays (cheap)
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.55;
      ctx.translate(0, -18);
      const rays = ctx.createLinearGradient(0, 0, w, 0);
      rays.addColorStop(0.0, "rgba(0,0,0,0)");
      rays.addColorStop(0.35, "rgba(56,189,248,0.08)");
      rays.addColorStop(0.5, "rgba(56,189,248,0.12)");
      rays.addColorStop(0.65, "rgba(56,189,248,0.08)");
      rays.addColorStop(1.0, "rgba(0,0,0,0)");
      ctx.fillStyle = rays;
      ctx.fillRect(0, 0, w, Math.floor(h * 0.45));
      ctx.restore();

      if (prefersReducedMotion) return;

      // Moving water field (fast sine noise)
      const t = time * 0.001;
      const cell = 28; // bigger = faster
      const amp = 0.18; // intensity

      for (let yy = 0; yy < h; yy += cell) {
        const ny = yy / h;
        for (let xx = 0; xx < w; xx += cell) {
          const nx = xx / w;

          const v =
            Math.sin((nx * 7.0 + t * 0.55) * Math.PI * 2) * 0.55 +
            Math.sin((ny * 6.0 - t * 0.42) * Math.PI * 2) * 0.45 +
            Math.sin(((nx + ny) * 5.0 + t * 0.35) * Math.PI * 2) * 0.35;

          const vv = (v * 0.5 + 0.5) * amp;
          ctx.fillStyle = `rgba(56,189,248,${vv})`;
          ctx.fillRect(xx, yy, cell, cell);
        }
      }

      // Vignette
      const vg = ctx.createRadialGradient(
        w * 0.5,
        h * 0.35,
        0,
        w * 0.5,
        h * 0.35,
        Math.max(w, h) * 0.95
      );
      vg.addColorStop(0.0, "rgba(0,0,0,0)");
      vg.addColorStop(0.7, "rgba(0,0,0,0.55)");
      vg.addColorStop(1.0, "rgba(0,0,0,0.85)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
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

      // cleanup
      ripplesRef.current = ripples.filter((r) => (time - r.t0) / 1000 <= 1.9);
    };

    const frame = (time: number) => {
      drawWater(time);
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