"use client";
import React, { useRef, useEffect, useState } from "react";
import sdk from '@farcaster/frame-sdk';
import styles from "../page.module.css";

// --- Physics Constants ---
const GRAVITY = 0.4;
const DRAG = 0.99; // Air resistance
const BASE_BLUE = '#0052FF';
const TRAIL_COLOR = '#00F0FF'; // Neon Cyan

// --- Interfaces ---
interface Point {
    x: number;
    y: number;
    life: number;
}

interface Orb {
    type: 'orb';
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    rotation: number;
    rotationSpeed: number;
    color: string;
    isDead: boolean;
}

interface Shard {
    type: 'shard';
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    rotation: number;
    rotationSpeed: number;
    cutAngle: number; // The angle of the slice
    startAngle: number; // Start relative to rotation
    endAngle: number;   // End relative to rotation
    color: string;
    isDead: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    color: string;
}

export default function BaseNinja() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [gameOver] = useState(false);

    // Refs for Game Loop
    const entities = useRef<(Orb | Shard)[]>([]);
    const particles = useRef<Particle[]>([]);
    const trail = useRef<Point[]>([]);

    // Logic Refs
    const scoreRef = useRef(0);
    const lastTime = useRef(0);
    const spawnTimer = useRef(0);
    const isPointerDown = useRef(false);

    // --- Helpers ---
    const spawnOrb = (width: number, height: number) => {
        const radius = 35;
        const x = Math.random() * (width - radius * 2) + radius;
        const y = height + radius;
        const vx = (Math.random() - 0.5) * 6; // Horizontal scatter
        const vy = -(Math.random() * 8 + 14); // Strong vertical launch

        entities.current.push({
            type: 'orb',
            id: Date.now() + Math.random(),
            x,
            y,
            vx,
            vy,
            radius,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            color: BASE_BLUE,
            isDead: false
        });
    };

    const createExplosion = (x: number, y: number, color: string) => {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            particles.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                life: 1.0,
                color
            });
        }
    };

    const splitOrb = (orb: Orb, cutAngle: number) => {
        // Create 2 shards
        // Shard 1: Top/Left half (relative to cut)
        // Shard 2: Bottom/Right half
        // Separate velocity perpendicular to cut

        const sepSpeed = 3;
        const sepX = Math.cos(cutAngle + Math.PI / 2) * sepSpeed;
        const sepY = Math.sin(cutAngle + Math.PI / 2) * sepSpeed;

        const shard1: Shard = {
            type: 'shard',
            id: Date.now() + Math.random(),
            x: orb.x,
            y: orb.y,
            vx: orb.vx + sepX,
            vy: orb.vy + sepY,
            radius: orb.radius,
            rotation: orb.rotation,
            rotationSpeed: orb.rotationSpeed + (Math.random() * 0.2), // Spin faster
            cutAngle: cutAngle,
            startAngle: 0,
            endAngle: Math.PI,
            color: orb.color,
            isDead: false
        };

        const shard2: Shard = {
            type: 'shard',
            id: Date.now() + Math.random(),
            x: orb.x,
            y: orb.y,
            vx: orb.vx - sepX,
            vy: orb.vy - sepY,
            radius: orb.radius,
            rotation: orb.rotation,
            rotationSpeed: orb.rotationSpeed - (Math.random() * 0.2),
            cutAngle: cutAngle,
            startAngle: Math.PI,
            endAngle: Math.PI * 2,
            color: orb.color,
            isDead: false
        };

        entities.current.push(shard1, shard2);
        createExplosion(orb.x, orb.y, BASE_BLUE);
    };

    // --- Effects ---
    useEffect(() => {
        if (sdk && sdk.actions) {
            sdk.actions.ready();
        }

        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;

        const loop = (time: number) => {
            if (gameOver) return;
            const dt = Math.min(time - lastTime.current, 50); // Cap dt
            lastTime.current = time;

            // Update Spawn
            spawnTimer.current += dt;
            if (spawnTimer.current > 700) {
                spawnOrb(canvas.width, canvas.height);
                spawnTimer.current = 0;
            }

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- Update & Draw Entities ---
            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];

                // Physics
                ent.vy += GRAVITY;
                ent.vx *= DRAG;
                ent.vy *= DRAG;
                ent.x += ent.vx;
                ent.y += ent.vy;
                ent.rotation += ent.rotationSpeed;

                // Dead/Bounds check
                if (ent.y > canvas.height + 100) {
                    entities.current.splice(i, 1);
                    continue;
                }

                if (ent.isDead) { // Already sliced
                    entities.current.splice(i, 1);
                    continue;
                }

                // Draw
                ctx.save();
                ctx.translate(ent.x, ent.y);
                ctx.rotate(ent.rotation);

                if (ent.type === 'orb') {
                    // Draw Full Orb (Base Logo Style)
                    ctx.beginPath();
                    ctx.arc(0, 0, ent.radius, 0, Math.PI * 2);
                    ctx.fillStyle = ent.color;
                    ctx.fill();
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();

                    // Inner Circle
                    ctx.beginPath();
                    ctx.arc(0, 0, ent.radius * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                } else {
                    // Draw Shard (Half Circle)
                    // We rotate by cutAngle so that the flat side aligns with the cut
                    // But wait, we are already rotated by `ent.rotation`.
                    // We need to apply the local `cutAngle` rotation relative to the physics rotation?
                    // Implementation: The Cut Angle is absolute in world space at moment of cut.
                    // But the shard spins. So the cut line spins with it.
                    // Let's simplify: `ent.rotation` handles the spin. We just draw the correct arc slice.
                    // The arc is defined by `startAngle` and `endAngle`. 
                    // However, we need to orient the "slice line" correctly. 
                    // Let's rely on the `cutAngle` being the offset.

                    ctx.rotate(ent.cutAngle - ent.rotation); // Offset so flat side is at cutAngle initially? 
                    // Actually simple approach: The arc [0, PI] is effectively a half circle with flat side on X axis.
                    // Then we rotate it.

                    ctx.beginPath();
                    ctx.arc(0, 0, ent.radius, ent.startAngle, ent.endAngle);
                    ctx.lineTo(0, 0); // Close shape to center
                    ctx.fillStyle = ent.color;
                    ctx.fill();
                    ctx.stroke();

                    // Inner detail
                    ctx.beginPath();
                    // We only want the part of the inner circle within this arc
                    ctx.arc(0, 0, ent.radius * 0.35, ent.startAngle, ent.endAngle);
                    ctx.lineTo(0, 0);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
                ctx.restore();
            }

            // --- Update & Draw Particles ---
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.life -= 0.02;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1; // gravity

                if (p.life <= 0) {
                    particles.current.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
                ctx.restore();
            }

            // --- Update & Draw Trail ---
            // Decay
            if (isPointerDown.current) {
                // Keep trail
            } else {
                // Fast decay
                for (let i = 0; i < trail.current.length; i++) trail.current[i].life -= 0.1;
            }
            // Always decay life slightly for motion blur effect
            for (let i = trail.current.length - 1; i >= 0; i--) {
                trail.current[i].life -= 0.08; // Fade speed
                if (trail.current[i].life <= 0) trail.current.splice(i, 1);
            }

            // Draw Trail (Neon Glow)
            if (trail.current.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // Outer Glow
                ctx.shadowColor = TRAIL_COLOR;
                ctx.shadowBlur = 20;
                ctx.strokeStyle = TRAIL_COLOR;
                ctx.lineWidth = 8;

                ctx.beginPath();
                // Draw curve
                ctx.moveTo(trail.current[0].x, trail.current[0].y);
                for (let i = 1; i < trail.current.length; i++) {
                    // Straight lines for performance, curve if needed
                    // Opacity based on life? Canvas stroke is single opacity.
                    // For "Tail" fading, we might need multiple strokes or gradient.
                    // Simple version: just draw the path.
                    ctx.lineTo(trail.current[i].x, trail.current[i].y);
                }
                ctx.stroke();

                // Inner Core (White/Bright)
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.restore();

                // Check Slicing
                const lastIdx = trail.current.length - 1;
                const p2 = trail.current[lastIdx];
                const p1 = trail.current[lastIdx - 1]; // Previous point

                if (p1 && p2) {
                    // Check intersection with orbs
                    entities.current.forEach(ent => {
                        if (ent.type === 'orb' && !ent.isDead) {
                            // Line segment vs Circle collision
                            // Simplify: check if distance to center < radius
                            const dist = pointLineDist(ent.x, ent.y, p1.x, p1.y, p2.x, p2.y);
                            if (dist < ent.radius) {
                                // SLICE!
                                ent.isDead = true;
                                scoreRef.current += 1;
                                setScore(scoreRef.current);

                                // Clean angle calculation
                                const cutAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                                splitOrb(ent, cutAngle);
                            }
                        }
                    });
                }
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [gameOver]); // Dependencies

    // --- Input Handling ---
    const addPoint = (x: number, y: number) => {
        trail.current.push({ x, y, life: 1.0 });
    };

    const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
        isPointerDown.current = true;
        const pt = getPoint(e);
        if (pt) addPoint(pt.x, pt.y);
    };

    const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isPointerDown.current) return;
        const pt = getPoint(e);
        if (pt) addPoint(pt.x, pt.y);
    };

    const handleEnd = () => {
        isPointerDown.current = false;
    };

    const getPoint = (e: React.TouchEvent | React.MouseEvent) => {
        if (!canvasRef.current) return null;
        if ('touches' in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
            return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
        }
    };

    // Helper: Distance from point (px,py) to segment (x1,y1)-(x2,y2)
    function pointLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;

        let xx, yy;
        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    return (
        <div className={styles.container} style={{ overflow: 'hidden', touchAction: 'none' }}>
            <div className={styles.gameHeader} style={{ position: 'absolute', top: 20, zIndex: 10, textAlign: 'center', width: '100%', pointerEvents: 'none' }}>
                <h1 style={{ fontSize: '4rem', fontWeight: 900, textShadow: '0 0 20px #0052FF', fontFamily: 'Inter, sans-serif' }}>{score}</h1>
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
        </div>
    );
}
