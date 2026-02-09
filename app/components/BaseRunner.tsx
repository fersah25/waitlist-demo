"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Constants ---
const LANE_COUNT = 3;
const INITIAL_SPEED = 3;  // Slower start as requested
const MAX_SPEED = 18;     // Cap at 18
const LANE_SWITCH_SPEED = 0.15;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const GROUND_Y = 0;

// Colors
const COLOR_BG_TOP = '#05051a';
const COLOR_BG_BOT = '#0a0a2e';
const COLOR_LANE = '#00FFFF';   // Neon Cyan
const COLOR_OBSTACLE_ARCH = '#FF003C'; // Red Arch
const COLOR_OBSTACLE_ETH = '#A020F0'; // Purple ETH
const COLOR_COIN_BASE = '#0052FF'; // Base Blue
const COLOR_COIN_INNER = '#FFFFFF';
const COLOR_PLAYER = '#0052FF';

// --- Types ---
interface Entity {
    id: number;
    lane: number;
    y: number;
    type: 'obstacle' | 'coin';
    subType?: 'ground-eth' | 'air-arch'; // Explicit types
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

    // Game State
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Physics Refs
    const playerLane = useRef(1);
    const playerX = useRef(1); // 0..2 float
    const playerY = useRef(0);
    const playerVy = useRef(0);
    const isDucking = useRef(false);

    const speed = useRef(INITIAL_SPEED);
    const timeAlive = useRef(0); // For speed curve

    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);

    const lastTime = useRef(0);
    const spawnTimer = useRef(0);

    // --- Helpers (All useCallback) ---

    const getLaneX = useCallback((laneIndex: number, y: number, w: number, h: number) => {
        const horizonY = h * 0.35;
        if (y < horizonY) return w / 2;

        const progress = (y - horizonY) / (h - horizonY);

        const topW = w * 0.02;
        const botW = w * 1.2;

        const currentW = topW + (botW - topW) * progress;
        const laneUnit = currentW / LANE_COUNT;

        return (w / 2) + (laneIndex - 1) * laneUnit;
    }, []);

    const spawnEntity = useCallback(() => {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const type = Math.random() > 0.6 ? 'obstacle' : 'coin';
        let subType: 'ground-eth' | 'air-arch' | undefined;

        if (type === 'obstacle') {
            // 50/50 chance for Jump (ETH) vs Duck (Arch)
            subType = Math.random() > 0.5 ? 'ground-eth' : 'air-arch';
        }

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100, // Spawn at horizon
            type,
            subType
        });
    }, []);

    const restartGame = useCallback(() => {
        playerLane.current = 1;
        playerY.current = 0;
        playerVy.current = 0;
        isDucking.current = false;
        playerX.current = 1;

        speed.current = INITIAL_SPEED;
        timeAlive.current = 0;

        entities.current = [];
        particles.current = [];
        floatTexts.current = [];

        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    }, []);

    // --- Init ---
    useEffect(() => {
        try {
            if (sdk?.actions) sdk.actions.ready();
        } catch (e) {
            console.error('Farcaster SDK error:', e);
        }
    }, []);

    // --- Input ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            const k = e.key.toLowerCase();

            if (k === 'a' || k === 'arrowleft') {
                playerLane.current = Math.max(0, playerLane.current - 1);
            }
            if (k === 'd' || k === 'arrowright') {
                playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
            }
            if ((k === 'w' || k === 'arrowup' || k === ' ') && playerY.current === GROUND_Y) {
                playerVy.current = JUMP_FORCE;
            }
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

    // --- Loop ---
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

            // --- Physics ---
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            if (playerY.current < GROUND_Y || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > GROUND_Y) {
                    playerY.current = GROUND_Y;
                    playerVy.current = 0;
                }
            }

            // Speed Curve
            timeAlive.current += dt;
            // Increase speed by 0.5 every 2 seconds roughly, capped at MAX
            const targetSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (timeAlive.current / 2000));
            speed.current = targetSpeed;

            // Spawn
            spawnTimer.current += dt;
            // Spawn interval decreases as speed increases to keep density reasonable
            const interval = 6000 / speed.current;
            if (spawnTimer.current > interval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // --- Render ---
            const w = canvas.width;
            const h = canvas.height;
            const horizonY = h * 0.35;

            // 1. Background
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(1, COLOR_BG_BOT);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // 2. Lanes
            ctx.lineWidth = 6;
            ctx.strokeStyle = COLOR_LANE;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLOR_LANE;

            ctx.beginPath();
            for (let i = -0.5; i <= LANE_COUNT - 0.5; i += 1) {
                const xBot = getLaneX(i, h, w, h);
                const xTop = getLaneX(i, horizonY, w, h);
                ctx.moveTo(xBot, h);
                ctx.lineTo(xTop, horizonY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 3. Entities
            const playerScreenY = h - 180;

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                if (ent.y === -100) ent.y = horizonY;

                const progress = (ent.y - horizonY) / (h - horizonY);
                const scale = 0.1 + (progress * 1.5);
                ent.y += speed.current * scale;

                const ex = getLaneX(ent.lane, ent.y, w, h);
                const size = 90 * scale;

                if (!ent.collected) {
                    if (ent.type === 'coin') {
                        // --- COIN: Base Logo (Blue Sphere + White Center) ---
                        const pulse = 1 + Math.sin(time * 0.005) * 0.1;
                        const pulsSize = size * pulse;

                        ctx.shadowColor = COLOR_COIN_BASE;
                        ctx.shadowBlur = 20;

                        const g = ctx.createRadialGradient(ex, ent.y, pulsSize * 0.1, ex, ent.y, pulsSize * 0.5);
                        g.addColorStop(0, '#5599FF');
                        g.addColorStop(1, COLOR_COIN_BASE);
                        ctx.fillStyle = g;

                        ctx.beginPath();
                        ctx.arc(ex, ent.y, pulsSize / 2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = COLOR_COIN_INNER;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, pulsSize / 3.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;

                    } else if (ent.type === 'obstacle') {
                        // --- OBSTACLES ---
                        if (ent.subType === 'ground-eth') {
                            // PURPLE ETH DIAMOND (JUMP)
                            // Draw Diamond on ground
                            ctx.fillStyle = COLOR_OBSTACLE_ETH; // Purple
                            ctx.shadowColor = COLOR_OBSTACLE_ETH;
                            ctx.shadowBlur = 20;

                            const halfW = (size * 0.6) / 2;
                            const halfH = (size * 1.0) / 2; // Tall diamond

                            // Center is (ex, ent.y)
                            // But usually ground obstacles sit ON the ground line.
                            // Let's shift it up slightly so the bottom touches ground logic (ent.y)
                            const bottomY = ent.y;
                            const topY = ent.y - size;

                            ctx.beginPath();
                            ctx.moveTo(ex, topY); // Top
                            ctx.lineTo(ex + halfW, ent.y - size / 2); // Right
                            ctx.lineTo(ex, bottomY); // Bottom
                            ctx.lineTo(ex - halfW, ent.y - size / 2); // Left
                            ctx.closePath();
                            ctx.fill();
                            ctx.shadowBlur = 0;

                            // Inner detail for ETH logo look
                            ctx.fillStyle = 'rgba(255,255,255,0.3)';
                            ctx.beginPath();
                            ctx.moveTo(ex, topY);
                            ctx.lineTo(ex + halfW * 0.5, ent.y - size / 2);
                            ctx.lineTo(ex, bottomY);
                            ctx.fill();

                        } else {
                            // RED NEON ARCH (DUCK/SLIDE)
                            // Elevated
                            const archW = size * 1.2;
                            const archH = size * 1.0;
                            const lineThick = 10 * scale;

                            // Elevated Base Logic
                            const msgY = ent.y - (140 * scale); // Floating high

                            ctx.strokeStyle = COLOR_OBSTACLE_ARCH;
                            ctx.lineWidth = lineThick;
                            ctx.shadowColor = COLOR_OBSTACLE_ARCH;
                            ctx.shadowBlur = 20;

                            ctx.beginPath();
                            // Left Leg
                            ctx.moveTo(ex - archW / 2, msgY + archH);
                            ctx.lineTo(ex - archW / 2, msgY);
                            // Top
                            ctx.quadraticCurveTo(ex, msgY - (archW * 0.3), ex + archW / 2, msgY);
                            // Right Leg
                            ctx.lineTo(ex + archW / 2, msgY + archH);

                            ctx.stroke();
                            ctx.shadowBlur = 0;

                            // Danger Zone Indicator on Ground
                            ctx.fillStyle = 'rgba(255, 0, 60, 0.2)';
                            ctx.fillRect(ex - archW / 2, ent.y - 10 * scale, archW, 20 * scale);
                        }
                    }
                }

                // Collision
                // 2D Projection Check
                if (!ent.collected && Math.abs(ent.y - playerScreenY) < 50) {
                    const pCx = getLaneX(playerX.current, playerScreenY, w, h);

                    // Horizontal Check: Are we in the same lane visually?
                    if (Math.abs(ex - pCx) < 60) {
                        let hit = false;
                        if (ent.type === 'coin') {
                            hit = true;
                        } else {
                            // Obstacle Logic
                            if (ent.subType === 'ground-eth') {
                                // Must JUMP
                                // If playerY is near 0 (ground), hit.
                                // If playerY < -something (jumping), safe.
                                // Let's simplify: MUST be significantly in air (> 50px visual jump)
                                if (playerY.current > -40) hit = true;
                            } else {
                                // 'air-arch' -> Must DUCK
                                if (!isDucking.current) hit = true;
                            }
                        }

                        if (hit) {
                            if (ent.type === 'coin') {
                                ent.collected = true;
                                setScore(s => s + 10);

                                floatTexts.current.push({
                                    text: '+10', x: ex, y: ent.y - 60,
                                    life: 1, opacity: 1
                                });
                                // Particles
                                for (let p = 0; p < 8; p++) {
                                    particles.current.push({
                                        x: ex, y: ent.y,
                                        vx: (Math.random() - 0.5) * 12,
                                        vy: (Math.random() - 0.5) * 12,
                                        life: 1, color: '#FFF'
                                    });
                                }

                            } else {
                                setGameState('gameover');
                            }
                        }
                    }
                }

                if (ent.y > h + 200) entities.current.splice(i, 1);
            }

            // 4. Player
            const pX = getLaneX(playerX.current, playerScreenY, w, h);
            const pY = playerScreenY + playerY.current;

            // Shadow
            if (playerY.current === GROUND_Y) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(pX, pY + 40, 30, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            const duckS = isDucking.current ? 0.5 : 1;

            // Player Visuals
            ctx.fillStyle = COLOR_BG_TOP;
            ctx.strokeStyle = COLOR_PLAYER;
            ctx.lineWidth = 3;
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(pX, pY - 40 * duckS); // Tip
            ctx.lineTo(pX + 30, pY + 20 * duckS);
            ctx.lineTo(pX, pY + 10 * duckS);
            ctx.lineTo(pX - 30, pY + 20 * duckS);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Engine
            ctx.shadowBlur = 25;
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(pX, pY + 5 * duckS, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 5. FX
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.04;
                if (p.life <= 0) particles.current.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, 3, 3);
                }
            }
            ctx.globalAlpha = 1;

            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 1.5;
                ft.life -= 0.02;
                if (ft.life <= 0) floatTexts.current.splice(i, 1);
                else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${ft.opacity})`;
                    ctx.font = 'bold 24px monospace';
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

    return (
        <div style={{
            position: 'relative', width: '100vw', height: '100vh',
            backgroundColor: COLOR_BG_TOP, overflow: 'hidden',
            fontFamily: 'monospace', userSelect: 'none'
        }}>
            {/* HUD */}
            <div style={{
                position: 'absolute', top: 30, width: '100%',
                textAlign: 'center', pointerEvents: 'none', zIndex: 10
            }}>
                <h1 style={{
                    fontSize: '3rem', margin: 0, color: 'white',
                    textShadow: `0 0 20px ${COLOR_LANE}`
                }}>
                    SCORE: {score}
                </h1>
            </div>

            {/* Touch Input Zone */}
            <div
                style={{ position: 'absolute', inset: 0, zIndex: 5 }}
                onMouseDown={(e) => {
                    if (gameState !== 'playing') return;
                    const x = e.clientX;
                    playerLane.current = x < window.innerWidth / 2
                        ? Math.max(0, playerLane.current - 1)
                        : Math.min(LANE_COUNT - 1, playerLane.current + 1);
                }}
            />

            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 20
                }}>
                    <h2 style={{
                        fontSize: '4rem', color: COLOR_OBSTACLE_ARCH,
                        marginBottom: 20, textShadow: '0 0 30px red'
                    }}>
                        GAME OVER
                    </h2>
                    <button
                        onClick={restartGame}
                        style={{
                            background: 'transparent',
                            color: COLOR_LANE,
                            border: `3px solid ${COLOR_LANE}`,
                            padding: '15px 50px',
                            fontSize: '2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            boxShadow: `0 0 20px ${COLOR_LANE}`,
                            fontFamily: 'monospace',
                            fontWeight: 'bold'
                        }}
                    >
                        RETRY
                    </button>
                </div>
            )}
        </div>
    );
}
