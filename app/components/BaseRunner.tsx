"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Global Constants ---
const LANE_COUNT = 3;
const INITIAL_SPEED = 10;
const MAX_SPEED = 40;
const LANE_SWITCH_SPEED = 0.2;
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const GROUND_Y = 0;

// Odyssey Palette
const COLOR_BG_TOP = '#05051a';
const COLOR_BG_BOT = '#121245';
const COLOR_LANE_BORDER = '#00F0FF';
const COLOR_PLAYER = '#0052FF';
const COLOR_OBSTACLE = '#FF003C';
const COLOR_COIN_INNER = '#FFD700'; // Gold
const COLOR_COIN_OUTER = '#00FFFF'; // Blue Cyan Glow

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
    const [score, setScore] = useState(0); // Coins collected
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Game State (Refs)
    const playerLane = useRef(1);
    const playerX = useRef(1);
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
    // Defined inside component to access constants if needed, but pure logic preferred.
    // Wrap in useCallback to strictly follow "no missing dep" rule if used in effects?
    // Actually, distinct helper functions outside effects are fine if they are pure.

    // Projection Helper: Maps (Lane, Y) -> Screen X
    const getLaneX = useCallback((laneIndex: number, y: number, w: number, h: number) => {
        const horizonY = h * 0.35;
        // Clamp Y to horizon
        if (y < horizonY) return w / 2;

        const progress = (y - horizonY) / (h - horizonY); // 0 at horizon, 1 at bottom

        // Perspective: 
        // Top width (at horizon) is narrow (e.g. 10% of screen)
        // Bottom width is wide (e.g. 100% of screen)
        const topW = w * 0.1;
        const botW = w * 1.0;

        // Lane Width at current Y
        const currentW = topW + (botW - topW) * progress;

        // Center of the road is w/2
        // Lane positions relative to center: -1.5, -0.5, 0.5, 1.5 for the 4 lines defining 3 lanes?
        // Lanes are 0, 1, 2. Centers are 0, 1, 2.
        // We want 3 lanes centered.
        // Lane 0 center: -1 unit. Lane 1 center: 0 unit. Lane 2 center: +1 unit?
        // Let's map laneIndex (0..2) to Normalized range (-1..1)?
        // 0 -> -1/3? No.
        // 3 Lanes. Total Width = 3 units.
        // Lane 0: -1.5 to -0.5? Center -1.
        // Lane 1: -0.5 to 0.5? Center 0.
        // Lane 2: 0.5 to 1.5? Center 1.
        // Yes.

        const laneUnit = currentW / LANE_COUNT;

        // Center offset: (laneIndex - 1) * laneUnit
        // If laneIndex is 1, offset is 0.
        // If laneIndex is 0, offset is -laneUnit.
        // If laneIndex is 2, offset is +laneUnit.
        // If laneIndex is a border (e.g. 0 or 3 for drawing lines), we adjust.

        // We generally use this for *centers* of objects (laneIndex 0,1,2).
        // And for *lines* (laneIndex -0.5, 0.5, 1.5, 2.5)?

        // Let's standardise: 
        // Center of screen + (laneIndex - (LANE_COUNT-1)/2) * laneUnit
        // For LANE_COUNT=3: (laneIndex - 1) * laneUnit

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

    // --- Input ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            const k = e.key.toLowerCase();

            if (k === 'a' || k === 'arrowleft') playerLane.current = Math.max(0, playerLane.current - 1);
            if (k === 'd' || k === 'arrowright') playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
            if ((k === 'w' || k === 'arrowup' || k === ' ') && playerY.current === GROUND_Y) playerVy.current = JUMP_FORCE;
            if (k === 's' || k === 'arrowdown') isDucking.current = true;
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 's' || k === 'arrowdown') isDucking.current = false;
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

            // 1. Physics
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            if (playerY.current < GROUND_Y || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > GROUND_Y) {
                    playerY.current = GROUND_Y;
                    playerVy.current = 0;
                }
            }

            spawnTimer.current += dt;
            const interval = 6000 / speed.current;
            if (spawnTimer.current > interval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // 2. Draw
            const w = canvas.width;
            const h = canvas.height;
            const horizonY = h * 0.35;

            // Background (Gradient)
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(1, COLOR_BG_BOT);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Road Lines (Neon Borders)
            ctx.lineWidth = 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = COLOR_LANE_BORDER;
            ctx.strokeStyle = COLOR_LANE_BORDER;

            // Draw 4 lines defining 3 lanes
            // Lanes are 0,1,2.
            // Borders are: -0.5, 0.5, 1.5, 2.5 relative to lane centers?
            // getLaneX(0) returns center of lane 0. 
            // We need getLaneX(0 - 0.5) etc.

            ctx.beginPath();
            for (let i = -0.5; i <= LANE_COUNT - 0.5; i += 1) {
                const xBot = getLaneX(i, h, w, h);
                const xTop = getLaneX(i, horizonY, w, h);
                ctx.moveTo(xBot, h);
                ctx.lineTo(xTop, horizonY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;


            // Entities
            const playerScreenY = h - 150;

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                if (ent.y === -100) ent.y = horizonY;

                // Move
                const progress = (ent.y - horizonY) / (h - horizonY);
                const scale = 0.1 + (progress * 1.2);
                ent.y += speed.current * scale;

                const ex = getLaneX(ent.lane, ent.y, w, h);
                const size = 70 * scale;

                if (!ent.collected) {
                    if (ent.type === 'coin') {
                        // Coin: Gold/Blue Gradient
                        const g = ctx.createRadialGradient(ex, ent.y, size * 0.1, ex, ent.y, size * 0.5);
                        g.addColorStop(0, '#FFFFFF');
                        g.addColorStop(0.3, COLOR_COIN_INNER);
                        g.addColorStop(1, COLOR_COIN_OUTER);
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size / 2, 0, Math.PI * 2);
                        ctx.fill();

                        // Sparkle
                        if (Math.random() > 0.9) {
                            ctx.fillStyle = '#FFF';
                            ctx.fillRect(ex + (Math.random() - 0.5) * size, ent.y + (Math.random() - 0.5) * size, 2, 2);
                        }
                    } else {
                        // Obstacle: Red Crystal (Diamond)
                        const boxY = ent.subType === 'air' ? ent.y - (120 * scale) : ent.y - size / 2;

                        ctx.fillStyle = COLOR_OBSTACLE;
                        ctx.shadowColor = COLOR_OBSTACLE;
                        ctx.shadowBlur = 20;

                        ctx.beginPath();
                        // Diamond shape
                        ctx.moveTo(ex, boxY - size / 2); // Top
                        ctx.lineTo(ex + size / 2, boxY); // Right
                        ctx.moveTo(ex + size / 2, boxY);
                        ctx.lineTo(ex, boxY + size / 2); // Bottom
                        ctx.lineTo(ex - size / 2, boxY); // Left
                        ctx.lineTo(ex, boxY - size / 2); // Back to Top
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // Pole for air
                        if (ent.subType === 'air') {
                            ctx.fillStyle = '#AAA';
                            ctx.fillRect(ex - 2, boxY + size / 2, 4, h - boxY);
                        }
                    }
                }

                // Collision
                if (!ent.collected && Math.abs(ent.y - playerScreenY) < 40) {
                    const pCx = getLaneX(playerX.current, playerScreenY, w, h);
                    if (Math.abs(ex - pCx) < 50) {
                        let hit = false;
                        if (ent.type === 'coin') hit = true;
                        else {
                            if (ent.subType === 'air') { if (!isDucking.current) hit = true; }
                            else { if (playerY.current > -50) hit = true; }
                        }

                        if (hit) {
                            if (ent.type === 'coin') {
                                ent.collected = true;
                                const newCoins = coinsRef.current + 1;
                                coinsRef.current = newCoins;
                                setScore(newCoins);

                                // Speed Up every 5 coins
                                if (newCoins % 5 === 0) {
                                    speed.current = Math.min(MAX_SPEED, speed.current + 0.5);
                                }

                                floatTexts.current.push({ text: '+1', x: ex, y: ent.y - 50, life: 1, opacity: 1 });
                                // Particles
                                for (let p = 0; p < 5; p++) {
                                    particles.current.push({
                                        x: ex, y: ent.y,
                                        vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                                        life: 1, color: COLOR_COIN_INNER
                                    });
                                }
                            } else {
                                setGameState('gameover');
                            }
                        }
                    }
                }

                if (ent.y > h + 150) entities.current.splice(i, 1);
            }

            // Player
            const pX = getLaneX(playerX.current, playerScreenY, w, h);
            const pY = playerScreenY + playerY.current;

            // Shadow
            if (playerY.current === GROUND_Y) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(pX, pY + 30, 25, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Player Ship
            const duckS = isDucking.current ? 0.6 : 1;
            ctx.fillStyle = COLOR_PLAYER;
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(pX, pY - 30 * duckS);
            ctx.lineTo(pX + 25, pY + 20 * duckS);
            ctx.lineTo(pX, pY + 10 * duckS); // Indent
            ctx.lineTo(pX - 25, pY + 20 * duckS);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;


            // FX
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx; p.y += p.vy;
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
                ft.y -= 2; ft.life -= 0.02;
                if (ft.life <= 0) floatTexts.current.splice(i, 1);
                else {
                    ctx.fillStyle = 'white';
                    ctx.font = '20px Arial';
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
    }, [gameState, getLaneX, spawnEntity]); // getLaneX is now a dep, but stable via useCallback

    // --- Render ---
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
                    background: 'rgba(0,0,0,0.5)', padding: '10px 30px',
                    borderRadius: '20px', border: `1px solid ${COLOR_LANE_BORDER}`
                }}>
                    <h1 style={{
                        fontSize: '2rem', margin: 0, color: 'white',
                        textShadow: `0 0 10px ${COLOR_PLAYER}`
                    }}>
                        COINS: {score}
                    </h1>
                </div>
            </div>

            {/* Input Layer */}
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

            <canvas ref={canvasRef} style={{ display: 'block' }} />

            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 20
                }}>
                    <h2 style={{ fontSize: '3rem', color: COLOR_OBSTACLE, fontFamily: 'monospace' }}>MISSION FAILED</h2>
                    <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: 20 }}>SCORE: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            background: COLOR_PLAYER, color: 'white',
                            border: 'none', padding: '15px 50px',
                            fontSize: '1.2rem', borderRadius: '5px',
                            cursor: 'pointer', textTransform: 'uppercase',
                            letterSpacing: '2px'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
}
