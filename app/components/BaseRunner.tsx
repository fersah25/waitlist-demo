"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Global Constants ---
const LANE_COUNT = 3;
const INITIAL_SPEED = 10;
const MAX_SPEED = 40;
const LANE_SWITCH_SPEED = 0.2; // Smooth transition factor
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const GROUND_Y = 0;

// Odyssey / Base Palette
const COLOR_BG_TOP = '#05051a';
const COLOR_BG_BOT = '#121245';
const COLOR_LANE_BORDER = '#00F0FF'; // Neon Cyan
const COLOR_PLAYER = '#0052FF'; // Base Blue
const COLOR_OBSTACLE = '#FF003C'; // Neon Red for Arches
const COLOR_COIN_BASE = '#0052FF'; // Base Blue
const COLOR_COIN_INNER = '#FFFFFF'; // White Center

// --- Interfaces ---
interface Entity {
    id: number;
    lane: number;
    y: number;
    type: 'obstacle' | 'coin';
    subType?: 'ground' | 'air';
    collected?: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface FloatingText {
    text: string;
    x: number;
    y: number;
    life: number;
    opacity: number;
}

export default function BaseRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // React State (HUD)
    const [score, setScore] = useState(0); // Coins collected * 10
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Game State (Refs)
    const playerLane = useRef(1);
    const playerX = useRef(1); // Visual X position (0, 1, 2 interpolated)
    const playerY = useRef(0);
    const playerVy = useRef(0);
    const isDucking = useRef(false);

    const speed = useRef(INITIAL_SPEED);
    const coinsRef = useRef(0); // Internal counter for speed scaling

    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);

    const lastTime = useRef(0);
    const spawnTimer = useRef(0);

    // --- Helpers ---

    // Projection Helper: Maps (Lane, Y) -> Screen X
    const getLaneX = useCallback((laneIndex: number, y: number, w: number, h: number) => {
        const horizonY = h * 0.35;
        // Clamp Y to horizon
        if (y < horizonY) return w / 2;

        const progress = (y - horizonY) / (h - horizonY); // 0 at horizon, 1 at bottom

        // Perspective widths
        const topW = w * 0.1;
        const botW = w * 1.0;

        // Lane Width at current Y
        const currentW = topW + (botW - topW) * progress;
        const laneUnit = currentW / LANE_COUNT;

        // Center offset: (laneIndex - 1) * laneUnit
        // Lane 0 -> -1 * unit
        // Lane 1 -> 0
        // Lane 2 -> +1 * unit
        return (w / 2) + (laneIndex - 1) * laneUnit;
    }, []);

    // --- Core Actions ---

    const restartGame = useCallback(() => {
        playerLane.current = 1;
        playerX.current = 1;
        playerY.current = 0;
        playerVy.current = 0;
        isDucking.current = false;

        speed.current = INITIAL_SPEED;
        coinsRef.current = 0;

        entities.current = [];
        particles.current = [];
        floatTexts.current = [];

        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    }, []);

    const spawnEntity = useCallback(() => {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const type = Math.random() > 0.6 ? 'obstacle' : 'coin';
        let subType: 'ground' | 'air' | undefined;

        if (type === 'obstacle') {
            subType = Math.random() > 0.5 ? 'ground' : 'air';
        }

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100, // Spawn just above horizon logic
            type,
            subType
        });
    }, []);

    // --- Init ---
    useEffect(() => {
        try {
            if (sdk && sdk.actions) sdk.actions.ready();
        } catch (e) {
            console.error(e);
        }
    }, []);

    // --- Input (WASD + Arrows) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            const k = e.key.toLowerCase();

            // Lane Switch
            if (k === 'a' || k === 'arrowleft') {
                playerLane.current = Math.max(0, playerLane.current - 1);
            }
            if (k === 'd' || k === 'arrowright') {
                playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
            }

            // Jump
            if ((k === 'w' || k === 'arrowup' || k === ' ') && playerY.current === GROUND_Y) {
                playerVy.current = JUMP_FORCE;
            }

            // Duck
            if (k === 's' || k === 'arrowdown') {
                isDucking.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 's' || k === 'arrowdown') {
                isDucking.current = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // --- Game Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        let frameId: number;

        const loop = (time: number) => {
            if (gameState !== 'playing') return;

            const dt = Math.min(time - lastTime.current, 50);
            lastTime.current = time;

            // 1. Physics Update
            // Smooth lane switching
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            // Gravity / Jump
            if (playerY.current < GROUND_Y || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > GROUND_Y) {
                    playerY.current = GROUND_Y;
                    playerVy.current = 0;
                }
            }

            // Spawning
            spawnTimer.current += dt;
            const interval = 6000 / speed.current; // Spawn faster as speed increases
            if (spawnTimer.current > interval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // 2. Render
            const w = canvas.width;
            const h = canvas.height;
            const horizonY = h * 0.35;

            // Background: Vertical Gradient (Dark Blue -> Deep Purple/Blue)
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(1, COLOR_BG_BOT);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Draw Road Divider Lines (Neon Cyan)
            // Only vertical lines, no horizontal grid
            ctx.lineWidth = 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = COLOR_LANE_BORDER;
            ctx.strokeStyle = COLOR_LANE_BORDER;

            ctx.beginPath();
            // We draw lines at -0.5, 0.5, 1.5, 2.5 relative to lane centers
            for (let i = -0.5; i <= LANE_COUNT - 0.5; i += 1) {
                const xBot = getLaneX(i, h, w, h);
                const xTop = getLaneX(i, horizonY, w, h);
                ctx.moveTo(xBot, h);
                ctx.lineTo(xTop, horizonY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Entities Update & Draw
            const playerScreenY = h - 150; // Fixed player Y on screen

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];

                // Initialize Y if new spawn
                if (ent.y === -100) ent.y = horizonY;

                // Move Entity
                const progress = (ent.y - horizonY) / (h - horizonY);
                // Non-linear scale for perspective speed effect
                const scale = 0.1 + (progress * 1.5);
                ent.y += speed.current * scale;

                const ex = getLaneX(ent.lane, ent.y, w, h);
                const size = 80 * scale; // Base size

                if (!ent.collected) {
                    if (ent.type === 'coin') {
                        // --- COIN: Base Logo (Blue Sphere + White Center) ---
                        // Outer Glow
                        ctx.shadowColor = COLOR_COIN_BASE;
                        ctx.shadowBlur = 20;

                        // Blue Sphere
                        const g = ctx.createRadialGradient(ex, ent.y, size * 0.1, ex, ent.y, size * 0.5);
                        g.addColorStop(0, '#4488FF');
                        g.addColorStop(1, COLOR_COIN_BASE);
                        ctx.fillStyle = g;

                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size / 2, 0, Math.PI * 2);
                        ctx.fill();

                        // Inner White Circle
                        ctx.fillStyle = COLOR_COIN_INNER;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size / 4, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.shadowBlur = 0;

                        // Sparkle Effect
                        if (Math.random() > 0.9) {
                            ctx.fillStyle = '#FFF';
                            ctx.globalAlpha = Math.random();
                            const sx = ex + (Math.random() - 0.5) * size;
                            const sy = ent.y + (Math.random() - 0.5) * size;
                            ctx.fillRect(sx, sy, 3, 3);
                            ctx.globalAlpha = 1.0;
                        }

                    } else {
                        // --- OBSTACLE: Neon Arch ---
                        // Gate-like structure: Two pillars + Top Bar
                        const pillarW = size * 0.15;
                        const archH = size * 1.2;
                        const archW = size * 0.8;

                        // Y position depends on if it's Ground or Air obstacle
                        // Ground: Base is at ent.y
                        // Air: Base is higher up
                        const baseY = ent.subType === 'air' ? ent.y - (140 * scale) : ent.y;

                        ctx.fillStyle = COLOR_OBSTACLE;
                        ctx.shadowColor = COLOR_OBSTACLE;
                        ctx.shadowBlur = 15 + Math.random() * 5; // Pulsing glow

                        // Draw Pillars
                        // Left
                        ctx.fillRect(ex - archW / 2, baseY - archH, pillarW, archH);
                        // Right
                        ctx.fillRect(ex + archW / 2 - pillarW, baseY - archH, pillarW, archH);
                        // Top Bar
                        ctx.fillRect(ex - archW / 2, baseY - archH, archW, pillarW);

                        ctx.shadowBlur = 0;
                    }
                }

                // Collision Detection
                // Simple box distance check in 2D projection
                if (!ent.collected && Math.abs(ent.y - playerScreenY) < 40) {
                    const pCx = getLaneX(playerX.current, playerScreenY, w, h);

                    // Horizontal hit check
                    if (Math.abs(ex - pCx) < 50) {
                        let hit = false;
                        if (ent.type === 'coin') {
                            hit = true; // Always collect coins if touched
                        } else {
                            // Obstacle Logic
                            if (ent.subType === 'air') {
                                // Must duck
                                if (!isDucking.current) hit = true;
                            } else {
                                // Must jump (ground obstacle)
                                if (playerY.current > -50) hit = true;
                            }
                        }

                        if (hit) {
                            if (ent.type === 'coin') {
                                ent.collected = true;
                                const newCoins = coinsRef.current + 1;
                                coinsRef.current = newCoins;

                                // Score increases by 10 per coin
                                setScore(s => s + 10);

                                // Speed Up every 5 coins
                                if (newCoins % 5 === 0) {
                                    speed.current = Math.min(MAX_SPEED, speed.current + 0.5);
                                }

                                // Floating Text +10
                                floatTexts.current.push({
                                    text: '+10',
                                    x: ex,
                                    y: ent.y - 50,
                                    life: 1,
                                    opacity: 1
                                });

                                // Particles explosion
                                for (let p = 0; p < 8; p++) {
                                    particles.current.push({
                                        x: ex, y: ent.y,
                                        vx: (Math.random() - 0.5) * 15,
                                        vy: (Math.random() - 0.5) * 15,
                                        life: 1,
                                        color: COLOR_COIN_INNER // White sparkles
                                    });
                                }
                            } else {
                                // Hit Obstacle -> Game Over
                                setGameState('gameover');
                            }
                        }
                    }
                }

                // Cleanup if off-screen
                if (ent.y > h + 200) {
                    entities.current.splice(i, 1);
                }
            }

            // 3. Draw Player
            const pX = getLaneX(playerX.current, playerScreenY, w, h);
            const pY = playerScreenY + playerY.current;

            // Shadow
            if (playerY.current === GROUND_Y) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(pX, pY + 30, 25, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Player Ship / Character
            const duckS = isDucking.current ? 0.6 : 1;
            ctx.fillStyle = COLOR_PLAYER;
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 20;

            ctx.beginPath();
            // Simple sleek ship shape
            ctx.moveTo(pX, pY - 30 * duckS);
            ctx.lineTo(pX + 25, pY + 20 * duckS);
            ctx.lineTo(pX, pY + 10 * duckS); // Tail indent
            ctx.lineTo(pX - 25, pY + 20 * duckS);
            ctx.closePath();
            ctx.fill();

            // Engine Glow
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(pX, pY + 15 * duckS, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;


            // 4. FX (Particles & Floating Text)
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.05;

                if (p.life <= 0) particles.current.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, 4, 4);
                }
            }
            ctx.globalAlpha = 1;

            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 2;
                ft.life -= 0.02;

                if (ft.life <= 0) floatTexts.current.splice(i, 1);
                else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${ft.opacity})`;
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText(ft.text, ft.x, ft.y);
                }
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, [gameState, getLaneX, spawnEntity]);

    // --- Render Rendering ---
    return (
        <div style={{
            position: 'relative', width: '100vw', height: '100vh',
            backgroundColor: COLOR_BG_BOT, overflow: 'hidden',
            fontFamily: 'sans-serif', userSelect: 'none'
        }}>
            {/* HUD */}
            <div style={{
                position: 'absolute', top: 20, width: '100%',
                display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 10
            }}>
                <div style={{
                    background: 'rgba(0,0,0,0.6)', padding: '10px 40px',
                    borderRadius: '30px', border: `2px solid ${COLOR_LANE_BORDER}`,
                    boxShadow: `0 0 15px ${COLOR_LANE_BORDER}`
                }}>
                    <h1 style={{
                        fontSize: '2.5rem', margin: 0, color: 'white',
                        textShadow: `0 0 10px ${COLOR_PLAYER}`, fontFamily: 'monospace'
                    }}>
                        SCORE: {score}
                    </h1>
                </div>
            </div>

            {/* Input Overlay (Mobile Touch Zones) */}
            <div
                style={{ position: 'absolute', inset: 0, zIndex: 5 }}
                onMouseDown={(e) => {
                    const x = e.clientX;
                    if (gameState !== 'playing') return;
                    playerLane.current = x < window.innerWidth / 2
                        ? Math.max(0, playerLane.current - 1)
                        : Math.min(LANE_COUNT - 1, playerLane.current + 1);
                }}
            />

            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 20
                }}>
                    <h2 style={{
                        fontSize: '4rem', color: COLOR_OBSTACLE,
                        textShadow: `0 0 20px ${COLOR_OBSTACLE}`,
                        marginBottom: '10px', fontFamily: 'monospace'
                    }}>
                        MISSION FAILED
                    </h2>
                    <p style={{ color: 'white', fontSize: '2rem', marginBottom: 40 }}>FINAL SCORE: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            background: COLOR_PLAYER, color: 'white',
                            border: `2px solid ${COLOR_LANE_BORDER}`,
                            padding: '15px 60px',
                            fontSize: '1.5rem', borderRadius: '50px',
                            cursor: 'pointer', textTransform: 'uppercase',
                            letterSpacing: '2px', fontWeight: 'bold',
                            boxShadow: `0 0 20px ${COLOR_PLAYER}`
                        }}
                    >
                        Retry Mission
                    </button>
                </div>
            )}
        </div>
    );
}
