"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-provider";
import { FIELD_COUNT, fieldPoint } from "@/lib/skill-field";
import styles from "./passport-showcase.module.css";

const colors = [
  ["109, 66, 197", "187, 83, 223", "132, 74, 208"],
  ["98, 76, 190", "148, 90, 204", "94, 106, 188"],
  ["154, 62, 169", "114, 65, 189", "177, 75, 190"],
];

export function SkillField({ format, mood, paused }: { format: number; mood: number; paused: boolean }) {
  const {t} = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const config = useRef({ format, mood, paused });
  const redraw = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { config.current = { format, mood, paused }; redraw.current?.(); }, [format, mood, paused]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    const particles = Array.from({ length: FIELD_COUNT }, (_, i) => ({ ...fieldPoint(i, config.current.format), dx: 0, dy: 0, vx: 0, vy: 0 }));
    let width = 0, height = 0, frame: number | null = null, last = 0, time = 0;
    let visible = true, disposed = false;
    let pointer = { x: -9999, y: -9999 };
    let currentMood = config.current.mood;
    const tint = colors[currentMood].map(rgb => rgb.split(", ").map(Number));
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = 0; };
    function draw(now: number) {
      frame = null;
      if (disposed) return;
      const state = config.current;
      const still = state.paused;
      const dt = Math.min(last ? (now - last) / 16.667 : 1, 2);
      last = now;
      if (!still) time += dt / 60;
      context!.clearRect(0, 0, width, height);
      currentMood = state.mood;
      for (let c = 0; c < 3; c++) {
        const target = colors[currentMood][c].split(", ").map(Number);
        for (let k = 0; k < 3; k++) tint[c][k] += (target[k] - tint[c][k]) * (still ? 1 : .065 * dt);
      }
      // Rotate in world space, then project through a perspective camera.
      // Sorting by depth draws the closest points over the distant connections.
      const yaw = .35 + time * .24;
      const pitch = .22 + Math.sin(time * .3) * .28;
      const roll = time * .055;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cx = Math.cos(pitch), sx = Math.sin(pitch);
      const cz = Math.cos(roll), sz = Math.sin(roll);
      const project = (x: number, y: number, z: number) => {
        const turnX = x * cy + z * sy, turnZ = z * cy - x * sy;
        const tiltY = y * cx - turnZ * sx, depth = y * sx + turnZ * cx;
        const perspective = 1.9 / (1.9 - depth);
        return {
          x: width * (.5 + (turnX * cz - tiltY * sz) * .84 * perspective),
          y: height * (.5 + (turnX * sz + tiltY * cz) * .84 * perspective),
          depth,
          perspective,
        };
      };
      const scene = particles.map((p, i) => {

        const target = fieldPoint(i, state.format);
        const blend = still ? 1 : 1 - Math.pow(.94, dt);
        p.x += (target.x - p.x) * blend; p.y += (target.y - p.y) * blend;
        p.z += (target.z - p.z) * blend; p.rootX += (target.rootX - p.rootX) * blend; p.rootY += (target.rootY - p.rootY) * blend;
        const breath = 1 + Math.sin(time * Math.PI * 2 / 5.4) * .075;
        const ripple = Math.sin(time * 1.8 - i * .07) * .012;
        const scale = breath + ripple;
        const root = project(p.rootX, p.rootY, 0);
        const point = project(p.rootX + (p.x - p.rootX) * scale, p.rootY + (p.y - p.rootY) * scale, p.z * scale);
        return { p, i, root, point };
      }).sort((a, b) => a.point.depth - b.point.depth);
      scene.forEach(({ p, i, root, point }) => {
        const { x, y, perspective } = point;
        const rx = root.x, ry = root.y;
        const visibility = Math.max(.18, Math.min(.9, .55 + point.depth * .75));
        if (!still) {
          const ox = x + p.dx - pointer.x, oy = y + p.dy - pointer.y;
          const distance = Math.hypot(ox, oy);
          const reach = Math.min(width * .24, 115);
          if (distance < reach) {
            const force = Math.pow(1 - distance / reach, 2) * 2.4 * dt;
            p.vx += ox / Math.max(distance, 1) * force;
            p.vy += oy / Math.max(distance, 1) * force;
          }
          p.vx += -p.dx * .025 * dt; p.vy += -p.dy * .025 * dt;
          p.vx *= Math.pow(.88, dt); p.vy *= Math.pow(.88, dt);
          p.dx += p.vx * dt; p.dy += p.vy * dt;
        }
        const rgb = tint[i % 3].map(Math.round).join(",");
        const endX = x + p.dx, endY = y + p.dy;
        const gradient = context!.createLinearGradient(rx, ry, endX + .01, endY + .01);
        gradient.addColorStop(0, `rgba(${rgb},0.12)`);
        gradient.addColorStop(1, `rgba(${rgb},${visibility * .7})`);
        context!.strokeStyle = gradient; context!.lineWidth = .5 + perspective * .25;
        context!.beginPath(); context!.moveTo(rx, ry);
        context!.quadraticCurveTo((rx + endX) / 2 + p.dx * .3, ry + (endY - ry) * .65, endX, endY);
        context!.stroke();
        context!.fillStyle = `rgba(${rgb},${visibility})`;
        context!.beginPath(); context!.arc(endX, endY, 1 + perspective * .95, 0, Math.PI * 2); context!.fill();
      });
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function start() { stop(); if (visible && !document.hidden && !disposed) draw(performance.now()); }
    function resize() {
      const rect = element!.getBoundingClientRect(); width = rect.width; height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element!.width = Math.round(width * dpr); element!.height = Math.round(height * dpr);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0); start();
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || config.current.paused) return;
      const rect = element.getBoundingClientRect(); pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const leave = () => { pointer = { x: -9999, y: -9999 }; };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }); intersection.observe(element);
    element.addEventListener("pointermove", move); element.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", start);
    redraw.current = start; resize(); setReady(true);
    return () => { disposed = true; stop(); redraw.current = null; resizeObserver.disconnect(); intersection.disconnect(); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave); document.removeEventListener("visibilitychange", start); };
  }, []);

  return (
    <div className={styles.field} data-mood={mood}>
      <svg viewBox="0 0 600 400" className={styles.fallback} aria-hidden="true" style={{ opacity: ready ? 0 : 1 }}>
        {Array.from({ length: 65 }, (_, i) => { const p = fieldPoint(i * 2, format); return <g key={i} stroke="#8c91c8" strokeWidth=".7"><path opacity=".3" d={`M${300 + p.rootX * 500},${188 + p.rootY * 364} Q300,240 ${300 + p.x * 500},${188 + p.y * 364}`} fill="none" /><circle cx={300 + p.x * 500} cy={188 + p.y * 364} r="1.5" fill="#8c91c8" /></g>; })}
      </svg>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <span className="sr-only">{t("skillfield.sr")}</span>
    </div>
  );
}
