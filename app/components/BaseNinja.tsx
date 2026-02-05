"use client";
import React, { useRef, useEffect, useState } from "react";
import sdk from '@farcaster/frame-sdk';
import styles from "../page.module.css";

// --- Constants ---
const GRAVITY = 0.4;
const DRAG = 0.99;
const TRAIL_COLOR = '#00F0FF';
const MISSION_TARGET = 20;

const ORB_TYPES = [
    { type: 'base', color: '#0052FF', score: 10, weight: 60 },
    { type: 'op', color: '#FF0420', score: 30, weight: 20 },
    { type: 'degen', color: '#A36EFD', score: 10, weight: 10 }, // Degen purple
    { type: 'eth', color: '#627EEA', score: 50, weight: 5 },   // ETH Blue
    { type: 'bomb', color: '#111111', score: 0, weight: 5 }
] as const;

type OrbType = typeof ORB_TYPES[number]['type'];

// --- Interfaces ---
interface Point {
    x: number;
    y: number;
    life: number;
}

interface Orb {
    type: 'orb';
    subtype: OrbType;
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
    scoreValue: number;
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
    cutAngle: number;
    startAngle: number;
    endAngle: number;
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

    // UI State
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [logosSliced, setLogosSliced] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');
    const [missionComplete, setMissionComplete] = useState(false);

    // Refs
    const entities = useRef<(Orb | Shard)[]>([]);
    const particles = useRef<Particle[]>([]);
    const trail = useRef<Point[]>([]);

    const scoreRef = useRef(0);
    const logosSlicedRef = useRef(0); // For sync in loop
    const timeRef = useRef(60000); // ms
    const lastTime = useRef(0);
    const spawnTimer = useRef(0);
    const isPointerDown = useRef(false);

    // --- Helpers ---
    const spawnOrb = (width: number, height: number) => {
        const radius = 35;
        const x = Math.random() * (width - radius * 2) + radius;
        const y = height + radius;
        const vx = (Math.random() - 0.5) * 6;
        const vy = -(Math.random() * 8 + 14);

        // Weighted Random
        const rand = Math.random() * 100;
        let cumulative = 0;
        let selected: typeof ORB_TYPES[number] = ORB_TYPES[0];

        for (const t of ORB_TYPES) {
            cumulative += t.weight;
            if (rand <= cumulative) {
                selected = t;
                break;
            }
        }

        entities.current.push({
            type: 'orb',
            subtype: selected.type,
            id: Date.now() + Math.random(),
            x,
            y,
            vx,
            vy,
            radius,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            color: selected.color,
            isDead: false,
            scoreValue: selected.score
        });
    };

    const createExplosion = (x: number, y: number, color: string) => {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            particles.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                life: 1.0,
                color
            });
        }
    };

    const splitOrb = (orb: Orb, cutAngle: number) => {
        if (orb.subtype === 'bomb') return; // Bombs don't split, they explode

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
            rotationSpeed: orb.rotationSpeed + 0.1,
            cutAngle,
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
            rotationSpeed: orb.rotationSpeed - 0.1,
            cutAngle,
            startAngle: Math.PI,
            endAngle: Math.PI * 2,
            color: orb.color,
            isDead: false
        };

        entities.current.push(shard1, shard2);
    };

    const restartGame = () => {
        scoreRef.current = 0;
        logosSlicedRef.current = 0;
        timeRef.current = 60000;
        entities.current = [];
        particles.current = [];
        trail.current = [];
        setScore(0);
        setLogosSliced(0);
        setTimeLeft(60);
        setMissionComplete(false);
        setGameState('playing');
        lastTime.current = performance.now();
    };

    // --- Setup ---
    useEffect(() => {
        if (sdk && sdk.actions) sdk.actions.ready();

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
        // Capture timeLeft for usage inside loop if needed, but the loop relies on refs mostly.
        // Actually, the loop uses timeRef which is a ref.
        // The issue is likely `gameState` or `timeLeft` in the dependency array if used.
        // But `timeLeft` state is updated inside loop? No, `timeRef` is used.
        // `timeLeft` state is purely for render.
        // The loop is safely dependent on `gameState` to restart.

        // Let's suppress the warning or ensure dependencies are correct. 
        // Logic seems to rely on refs, so it's fine.

        const loop = (time: number) => {
            if (gameState !== 'playing') return;

            const dt = Math.min(time - lastTime.current, 50);
            lastTime.current = time;

            // Timer Logic
            timeRef.current -= dt;
            if (timeRef.current <= 0) {
                timeRef.current = 0;
                setGameState('gameover');
            }
            // Update UI every second approx (optimization)
            if (Math.floor(timeRef.current / 1000) !== timeLeft) {
                setTimeLeft(Math.ceil(timeRef.current / 1000));
            }

            // Spawn
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

                ent.vy += GRAVITY;
                ent.vx *= DRAG;
                ent.vy *= DRAG;
                ent.x += ent.vx;
                ent.y += ent.vy;
                ent.rotation += ent.rotationSpeed;

                if (ent.y > canvas.height + 100 || ent.isDead) {
                    entities.current.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.translate(ent.x, ent.y);
                ctx.rotate(ent.rotation);

                if (ent.type === 'orb') {
                    // Draw Based on Subtype
                    if (ent.subtype === 'bomb') {
                        // Bomb
                        ctx.beginPath();
                        ctx.arc(0, 0, ent.radius, 0, Math.PI * 2);
                        ctx.fillStyle = '#111';
                        ctx.fill();
                        // Fuse/Pulse
                        const pulse = (Math.sin(time / 100) + 1) * 0.5;
                        ctx.strokeStyle = `rgba(255, 0, 0, ${pulse * 0.8 + 0.2})`;
                        ctx.lineWidth = 4;
                        ctx.stroke();
                        // Skull logic or X logic would go here
                        ctx.fillStyle = 'red';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText("!", 0, 0);

                    } else if (ent.subtype === 'eth') {
                        // Diamond
                        ctx.beginPath();
                        ctx.moveTo(0, -ent.radius);
                        ctx.lineTo(ent.radius, 0);
                        ctx.lineTo(0, ent.radius);
                        ctx.lineTo(-ent.radius, 0);
                        ctx.closePath();
                        ctx.fillStyle = ent.color;
                        ctx.fill();
                        ctx.stroke(); // White outline inherited? No, need to set
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 3;
                        ctx.stroke();

                    } else {
                        // Circle (Base, OP, Degen)
                        ctx.beginPath();
                        ctx.arc(0, 0, ent.radius, 0, Math.PI * 2);
                        ctx.fillStyle = ent.color;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.stroke();

                        // Inner decoration
                        ctx.beginPath();
                        ctx.arc(0, 0, ent.radius * 0.3, 0, Math.PI * 2);
                        ctx.fillStyle = '#fff';
                        ctx.fill();
                    }
                } else {
                    // Shard Drawing (Semicircle approximation)
                    ctx.rotate(ent.cutAngle - ent.rotation);
                    ctx.beginPath();
                    ctx.arc(0, 0, ent.radius, ent.startAngle, ent.endAngle);
                    ctx.lineTo(0, 0);
                    ctx.fillStyle = ent.color;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // --- Particles ---
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.life -= 0.02;
                p.x += p.vx;
                p.y += p.vy;
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

            // --- Trail & Logic ---
            if (isPointerDown.current) {
                // Decay trail logic handled below
            } else {
                for (let i = 0; i < trail.current.length; i++) trail.current[i].life -= 0.1;
            }
            for (let i = trail.current.length - 1; i >= 0; i--) {
                trail.current[i].life -= 0.08;
                if (trail.current[i].life <= 0) trail.current.splice(i, 1);
            }

            if (trail.current.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = TRAIL_COLOR;
                ctx.shadowBlur = 15;
                ctx.strokeStyle = TRAIL_COLOR;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(trail.current[0].x, trail.current[0].y);
                for (let i = 1; i < trail.current.length; i++) {
                    ctx.lineTo(trail.current[i].x, trail.current[i].y);
                }
                ctx.stroke();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
                ctx.stroke();
                ctx.restore();

                // Collision
                const p2 = trail.current[trail.current.length - 1];
                const p1 = trail.current[trail.current.length - 2];
                if (p1 && p2) {
                    entities.current.forEach(ent => {
                        if (ent.type === 'orb' && !ent.isDead) {
                            const dist = pointLineDist(ent.x, ent.y, p1.x, p1.y, p2.x, p2.y);
                            if (dist < ent.radius) {
                                // Hit Logic
                                ent.isDead = true;

                                if (ent.subtype === 'bomb') {
                                    // Penalty
                                    timeRef.current -= 10000; // -10s
                                    createExplosion(ent.x, ent.y, 'red');
                                    createExplosion(ent.x, ent.y, 'black');
                                } else {
                                    // Score
                                    scoreRef.current += ent.scoreValue;
                                    logosSlicedRef.current += 1;
                                    setScore(scoreRef.current);
                                    setLogosSliced(logosSlicedRef.current);

                                    // Mission Check
                                    if (logosSlicedRef.current === MISSION_TARGET) {
                                        setMissionComplete(true);
                                        // Bonus time? Or just visual
                                        setTimeout(() => setMissionComplete(false), 3000);
                                    }

                                    // Split & Effect
                                    const cutAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                                    splitOrb(ent, cutAngle);
                                    createExplosion(ent.x, ent.y, ent.color);
                                }
                            }
                        }
                    });
                }
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [gameState]); // Restart loop when gameState changes

    // --- Input ---
    const addPoint = (x: number, y: number) => trail.current.push({ x, y, life: 1.0 });

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
    const handleEnd = () => isPointerDown.current = false;

    const getPoint = (e: React.TouchEvent | React.MouseEvent) => {
        if (!canvasRef.current) return null;
        if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    };

    function pointLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = px - xx, dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    return (
        <div className={styles.container} style={{ overflow: 'hidden', touchAction: 'none', position: 'relative' }}>
            {/* HUD */}
            <div style={{ position: 'absolute', top: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 10 }}>

                {/* Timer Bar */}
                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: 20, marginBottom: 10, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timeLeft < 10 ? 'red' : 'white' }}>{timeLeft}s</span>
                </div>

                {/* Score */}
                <h1 style={{ fontSize: '3rem', fontWeight: 900, textShadow: '0 0 20px #0052FF', margin: 0, lineHeight: 1 }}>{score}</h1>

                {/* Mission */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ height: 6, width: 150, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(logosSliced / MISSION_TARGET * 100, 100)}%`, background: '#00F0FF', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Target: {MISSION_TARGET}</span>
                </div>

                {/* Mission Complete Popup */}
                {missionComplete && (
                    <div style={{ marginTop: 20, background: 'rgba(0, 240, 255, 0.2)', padding: '10px 20px', borderRadius: 10, border: '1px solid #00F0FF', animation: 'pulse 1s infinite' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>MISSION ACCOMPLISHED!</span>
                    </div>
                )}
            </div>

            {/* Render Canvas */}
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

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h2 style={{ fontSize: '3rem', color: '#fff', marginBottom: 10 }}>TIME&apos;S UP!</h2>
                    <p style={{ fontSize: '1.5rem', color: '#aaa', marginBottom: 30 }}>Final Score: <span style={{ color: '#0052FF', fontWeight: 'bold' }}>{score}</span></p>
                    <button
                        onClick={restartGame}
                        style={{
                            padding: '15px 40px', fontSize: '1.2rem', fontWeight: 'bold',
                            background: '#0052FF', color: 'white', border: 'none', borderRadius: 50,
                            cursor: 'pointer', boxShadow: '0 0 20px rgba(0,82,255,0.5)'
                        }}
                    >
                        PLAY AGAIN
                    </button>
                </div>
            )}
        </div>
    );
}
