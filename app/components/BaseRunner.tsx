"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 5;
const MAX_SPEED = 30; // High speed for warp effect
const SPEED_INC = 0.005;
const LANE_SWITCH_SPEED = 0.15;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const GROUND_Y = 0;

// Cyberpunk Palette
const COLOR_BG = '#02020a'; // Deep Void
const COLOR_GRID = '#00F0FF'; // Cyan
const COLOR_PLAYER = '#0052FF'; // Electric Blue
const COLOR_OBSTACLE = '#FF003C'; // Cyber Red
const COLOR_COIN = '#FIEE00'; // Neon Yellow
const COLOR_KRYPTON = '#39FF14'; // Neon Green (Krypton)
const COLOR_HORIZON = '#bc13fe'; // Neon Purple

// --- Interfaces ---
interface Entity {
    id: number;
    lane: number;
    y: number;
    type: 'obstacle' | 'coin';
    subType?: 'ground' | 'air'; // For obstacles
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

// --- Helpers (Pure) ---
function getLineX(lineIndex: number, y: number, w: number, h: number, currentSpeed: number) {
    const horizon = h * 0.3;
    if (y < horizon) return w / 2;

    const progress = (y - horizon) / (h - horizon);

    // Dynamic FOV / Warp Effect
    // As speed increases, the top convergence widens
    const speedFactor = Math.max(0, (currentSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    const convergence = 0.1 + (speedFactor * 0.35); // 0.1 to 0.45 (Wider warp)

    const xBottom = (lineIndex / LANE_COUNT) * w;
    const xTop = w / 2 + (xBottom - w / 2) * convergence;

    return xTop + (xBottom - xTop) * progress;
}

function getLaneCenterX(laneIndex: number, y: number, w: number, h: number, currentSpeed: number) {
    // Center of lane L is average of Line L and Line L+1
    // We treat laneIndex as float (e.g. 1.5)
    return getLineX(laneIndex + 0.5, y, w, h, currentSpeed);
}

export default function BaseRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // React State for UI
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Mutable Game State (Refs)
    const playerLane = useRef(1);
    const playerX = useRef(1); // Visual Lane Index
    const playerY = useRef(0); // Vertical pos (0=ground, negative=up)
    const playerVy = useRef(0);
    const isDucking = useRef(false);

    const speed = useRef(BASE_SPEED);
    const scoreRef = useRef(0);

    // Game Objects
    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);

    const lastTime = useRef(0);
    const spawnTimer = useRef(0);

    // --- Actions ---
    const restartGame = useCallback(() => {
        playerLane.current = 1;
        playerX.current = 1;
        playerY.current = 0;
        playerVy.current = 0;
        isDucking.current = false;

        speed.current = BASE_SPEED;
        scoreRef.current = 0;

        entities.current = [];
        particles.current = [];
        floatTexts.current = [];

        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    }, []);

    const spawnEntity = useCallback(() => {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const rand = Math.random();

        let type: 'obstacle' | 'coin' = 'coin';
        let subType: 'ground' | 'air' | undefined = undefined;

        if (rand > 0.65) {
            type = 'obstacle';
            // 50/50 split for types
            subType = Math.random() > 0.5 ? 'air' : 'ground';
        }

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100, // Spawn above screen
            type,
            subType
        });
    }, []);

    // --- Input Handlers ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;

            const k = e.key.toLowerCase();
            // Move
            if (k === 'a' || k === 'arrowleft') playerLane.current = Math.max(0, playerLane.current - 1);
            if (k === 'd' || k === 'arrowright') playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);

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

    // --- Init Farcaster ---
    useEffect(() => {
        if (sdk && sdk.actions) sdk.actions.ready();
    }, []);

    // --- Game Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
        if (!ctx) return;

        // Resize
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

            // 1. Update Physics / State

            // Speed up
            const scoreMilestone = Math.floor(scoreRef.current / 500);
            const dynamicMax = MAX_SPEED + (scoreMilestone * 2);
            speed.current = Math.min(dynamicMax, speed.current + SPEED_INC);

            // Lane Slide
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
            const visualPlayerY = playerY.current; // height (negative)

            // Spawn
            spawnTimer.current += dt;
            const spawnRate = 8000 / speed.current; // Faster spawn at high speeds
            if (spawnTimer.current > spawnRate) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // 2. Clear Screen
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.3;

            ctx.fillStyle = COLOR_BG;
            ctx.fillRect(0, 0, w, h);

            // 3. Draw Background / Effects

            // Horizon Glow
            const glow = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 150);
            glow.addColorStop(0, 'transparent');
            glow.addColorStop(0.4, COLOR_HORIZON); // Purple
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(0, horizon - 50, w, 200);

            // Neon Pillars (Cyber-Columns)
            // Parallax effect: Multiply speed by 0.5 for smoother background feel
            const pillOffset = (time * speed.current * 0.3) % 400;
            for (let z = -400; z < h; z += 200) {
                const pY = z + pillOffset;
                if (pY > horizon) {
                    // Determine depth 0..1
                    const depth = (pY - horizon) / (h - horizon);
                    const pW = 30 * depth;
                    const pH = 200 * depth; // Tall pillars

                    // X positions: Left of road and Right of road
                    const leftX = getLineX(-1.5, pY, w, h, speed.current) - pW;
                    const rightX = getLineX(LANE_COUNT + 1.5, pY, w, h, speed.current);

                    // Use KRYPTON green and Cyan
                    ctx.fillStyle = depth > 0.8 ? COLOR_KRYPTON : `rgba(57, 255, 20, ${depth * 0.4})`;

                    // Left Pillar
                    ctx.fillRect(leftX, pY - pH, pW, pH);
                    // Right Pillar
                    ctx.fillRect(rightX, pY - pH, pW, pH);

                    // Add subtle line/detail to pillar
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(leftX + pW / 2, pY - pH, 2 * depth, pH);
                    ctx.fillRect(rightX + pW / 2, pY - pH, 2 * depth, pH);
                }
            }

            // Speed Lines (Motion Blur Effect)
            if (speed.current > 12) {
                // Number of lines scales with speed
                const lineCount = Math.floor((speed.current - 10) * 1.5);
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.5, (speed.current - 10) / 40)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < lineCount; i++) {
                    // Random X near edges
                    const lx = Math.random() < 0.5 ? Math.random() * w * 0.3 : w * 0.7 + Math.random() * w * 0.3;
                    const lyStart = Math.random() * (h - horizon); // Random height below horizon logic? No, just screen
                    const length = Math.random() * 50 + (speed.current * 2);

                    ctx.moveTo(lx, lyStart);
                    // Lines radiate from center? Or just fall down?
                    // Let's make them flow OUTWARDS from center
                    const cx = w / 2;
                    const cy = horizon - 50; // vanishing point estimate
                    const ang = Math.atan2(lyStart - cy, lx - cx);

                    const lxEnd = lx + Math.cos(ang) * length;
                    const lyEnd = lyStart + Math.sin(ang) * length;

                    ctx.moveTo(lx, lyStart);
                    ctx.lineTo(lxEnd, lyEnd);
                }
                ctx.stroke();
            }

            // 4. Draw Road Grid
            ctx.strokeStyle = COLOR_GRID;
            ctx.shadowColor = COLOR_GRID;
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2;
            ctx.beginPath();

            // Vertical Lines
            for (let i = 0; i <= LANE_COUNT; i++) {
                const xBot = getLineX(i, h, w, h, speed.current);
                const xTop = getLineX(i, horizon, w, h, speed.current);
                ctx.moveTo(xBot, h);
                ctx.lineTo(xTop, horizon);
            }
            ctx.stroke();

            // Horizontal Ribs
            const gridOffset = (time * speed.current * 0.5) % 100;
            ctx.globalAlpha = 0.5;
            for (let gy = horizon; gy < h; gy += 60) {
                const y = gy + gridOffset;
                if (y < h && y > horizon) {
                    const left = getLineX(0, y, w, h, speed.current);
                    const right = getLineX(LANE_COUNT, y, w, h, speed.current);
                    ctx.moveTo(left, y);
                    ctx.lineTo(right, y);
                }
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;

            // 5. Entities (Update & Draw)
            const playerScreenY = h - 100;

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                if (ent.y === -100) ent.y = horizon; // Init spawn

                // Move
                const progress = (ent.y - horizon) / (h - horizon);
                const distScale = 0.1 + (progress * 0.9);
                ent.y += speed.current * distScale;

                // Calc Screen Pos
                const entX = getLaneCenterX(ent.lane, ent.y, w, h, speed.current);
                const entSize = 60 * distScale;

                // Draw
                if (!ent.collected) {
                    if (ent.type === 'obstacle') {
                        if (ent.subType === 'air') {
                            // Laser Bar (High)
                            const laserY = ent.y - (80 * distScale);
                            ctx.fillStyle = '#ff00ff'; // Hot Pink
                            ctx.shadowColor = '#ff00ff';
                            ctx.shadowBlur = 15;
                            ctx.fillRect(entX - entSize, laserY, entSize * 2, 12 * distScale);
                            ctx.shadowBlur = 0;
                            // Support Poles
                            ctx.fillStyle = '#ccc';
                            ctx.fillRect(entX - entSize, laserY, 5, 100 * distScale);
                            ctx.fillRect(entX + entSize - 5, laserY, 5, 100 * distScale);
                        } else {
                            // Ground Box
                            ctx.fillStyle = COLOR_OBSTACLE;
                            ctx.shadowColor = COLOR_OBSTACLE;
                            ctx.shadowBlur = 10;
                            ctx.fillRect(entX - entSize / 2, ent.y - entSize, entSize, entSize);
                            ctx.shadowBlur = 0;
                            // Top detail
                            ctx.fillStyle = '#ff5555';
                            ctx.fillRect(entX - entSize / 2, ent.y - entSize - 5, entSize, 5);
                        }
                    } else {
                        // Coin
                        const bob = Math.sin(time * 0.005) * 10 * distScale;
                        ctx.fillStyle = COLOR_COIN;
                        ctx.shadowColor = COLOR_COIN;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(entX, ent.y - 30 * distScale + bob, entSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }

                // Collision
                // Check Depth
                if (!ent.collected && Math.abs(ent.y - playerScreenY) < 30) {
                    // Check Lane / X
                    const pX = getLaneCenterX(playerX.current, playerScreenY, w, h, speed.current);
                    if (Math.abs(entX - pX) < 40) {
                        // Check Height (Jump/Duck)
                        let hit = false;

                        if (ent.type === 'coin') {
                            hit = true;
                        } else if (ent.type === 'obstacle') {
                            if (ent.subType === 'air') {
                                // Laser: Hit if !isDucking
                                if (!isDucking.current) hit = true;
                            } else {
                                // Ground Box: Hit if low (playerY > -50)
                                // -10 > -50 ? Yes. -100 > -50? No.
                                if (visualPlayerY > -50) hit = true;
                            }
                        }

                        if (hit) {
                            if (ent.type === 'obstacle') {
                                setGameState('gameover');
                            } else {
                                // Coin
                                ent.collected = true;
                                scoreRef.current += 100;
                                setScore(s => s + 100); // Sync

                                // Spawn FX
                                for (let p = 0; p < 8; p++) {
                                    particles.current.push({
                                        x: entX, y: ent.y,
                                        vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
                                        life: 1, color: COLOR_COIN
                                    });
                                }
                                floatTexts.current.push({
                                    text: '+100', x: entX, y: ent.y - 50, life: 1, opacity: 1
                                });
                            }
                        }
                    }
                }

                // Cleanup
                if (ent.y > h + 100) entities.current.splice(i, 1);
            }

            // 6. Player Draw
            const pX = getLaneCenterX(playerX.current, playerScreenY, w, h, speed.current);
            const pY = playerScreenY + visualPlayerY;

            // Squash for duck
            const duckScale = isDucking.current ? 0.6 : 1;
            const sizeBase = 50;

            // Player Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.ellipse(pX, pY + 25 * duckScale, sizeBase / 2, sizeBase / 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Needs glow
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 20;

            // Player Shape
            ctx.fillStyle = COLOR_PLAYER;
            if (isDucking.current) {
                // Flat disk
                ctx.beginPath();
                ctx.ellipse(pX, pY + 10, sizeBase * 0.6, sizeBase * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Sphere
                ctx.beginPath();
                ctx.arc(pX, pY, sizeBase / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(pX, pY, sizeBase * 0.2, 0, Math.PI * 2);
            ctx.fill();


            // 7. FX Update & Draw
            // Particles
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.04;
                if (p.life <= 0) { particles.current.splice(i, 1); continue; }

                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 5, 5);
                ctx.globalAlpha = 1;
            }
            // Float Text
            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 1.5;
                ft.life -= 0.02;
                if (ft.life <= 0) { floatTexts.current.splice(i, 1); continue; }

                ctx.globalAlpha = ft.life;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 24px Arial';
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.globalAlpha = 1;
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, [gameState, spawnEntity]); // Deps sanitized

    // --- Render ---
    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            overflow: 'hidden',
            fontFamily: 'sans-serif'
        }}>
            {/* HUD */}
            <div style={{
                position: 'absolute', top: 20, width: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 10
            }}>
                <h1 style={{
                    fontSize: '4rem', margin: 0,
                    color: 'white', textShadow: `0 0 20px ${COLOR_GRID}`,
                    fontStyle: 'italic', fontWeight: 900
                }}>
                    {score}
                </h1>
                <div style={{ color: COLOR_KRYPTON, fontSize: '1rem', marginTop: 5 }}>
                    SPEED: {Math.floor(speed.current * 10)} KM/H
                </div>
            </div>

            {/* Input Overlay */}
            <div
                style={{ position: 'absolute', inset: 0, zIndex: 5 }}
                onMouseDown={(e) => {
                    const x = e.clientX;
                    if (gameState !== 'playing') return;
                    if (x < window.innerWidth / 2) playerLane.current = Math.max(0, playerLane.current - 1);
                    else playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
                }}
                onTouchStart={(e) => {
                    // Touch support (replaces old handleTouch)
                    if (gameState !== 'playing') return;
                    const x = e.touches[0].clientX;
                    if (x < window.innerWidth / 2) playerLane.current = Math.max(0, playerLane.current - 1);
                    else playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
                }}
            />

            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 20, backdropFilter: 'blur(5px)'
                }}>
                    <h2 style={{ fontSize: '4rem', color: COLOR_OBSTACLE, textShadow: '0 0 20px red', margin: 0 }}>CRASHED</h2>
                    <p style={{ color: 'white', fontSize: '1.5rem', margin: '20px 0' }}>FINAL SCORE: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            background: COLOR_PLAYER,
                            color: 'white',
                            border: 'none',
                            padding: '20px 60px',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: `0 0 30px ${COLOR_PLAYER}`,
                            textTransform: 'uppercase'
                        }}
                    >
                        Retry System
                    </button>
                    <div style={{ marginTop: 20, color: '#666', fontSize: '0.9rem' }}>
                        W: Jump | S: Duck | A/D: Move
                    </div>
                </div>
            )}
        </div>
    );
}
