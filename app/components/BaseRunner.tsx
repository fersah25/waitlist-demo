"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 10;
const MAX_SPEED = 50;
const SPEED_INC = 0.002; // Exponential-ish via logic
const LANE_SWITCH_SPEED = 0.15;
const GRAVITY = 0.8;
const JUMP_FORCE = -16;
const GROUND_Y = 0; // Utilized for physics

// Professional Palette
const COLOR_BG_TOP = '#02020a'; // Deep Navy
const COLOR_BG_BOT = '#2a0a40'; // Deep Purple
const COLOR_HORIZON = '#a020f0'; // Bright Purple Bloom
const COLOR_RAIL = '#00F0FF';   // Cyan Neon
const COLOR_MARKER = '#ffffff'; // White Road Lines
const COLOR_PLAYER = '#0052FF'; // Electric Blue
const COLOR_OBSTACLE = '#FF003C'; // Danger Red
const COLOR_COIN = '#4488ff';   // Blue Coin

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

interface Star {
    x: number;
    y: number;
    z: number; // Depth for parallax
    size: number;
}

// --- Helpers (Pure) ---
function getLineX(lineIndex: number, y: number, w: number, h: number, currentSpeed: number) {
    const horizon = h * 0.35; // Slightly higher horizon for better view
    if (y < horizon) return w / 2;

    const progress = (y - horizon) / (h - horizon);

    // Dynamic Warp: FOV widens with speed
    const speedFactor = Math.max(0, (currentSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    const convergence = 0.05 + (speedFactor * 0.4); // 0.05 to 0.45

    const xBottom = (lineIndex / LANE_COUNT) * w;
    const xCenter = w / 2;

    // Perspective Projection
    // At bottom (progress=1), x is xBottom
    // At top (progress=0), x is xCenter +/- convergence offset? 
    // Actually standard perspective: lines converge to center.
    // We want the road to appear wider at bottom.

    // Let's use a standard trapezoid projection
    // Top width = w * convergence
    // Bottom width = w

    const xTop = xCenter - (w * convergence * 0.5) + ((lineIndex / LANE_COUNT) * w * convergence);
    // Actually simpler: 
    // Lerp between xTop and xBottom is linear in screen Y for a simple "road" look, 
    // but for 3D realism it should be 1/z. 
    // For this aesthetic, linear Lerp is fine but we want the "Warp" to widen the top.

    // Re-calc based on new requirements:
    // We want accurate lane lines.
    // Line 0 is Left edge, Line 3 is Right edge.

    // Base width factors
    const bottomW = w * 1.0;
    const topW = w * 0.1 * (1 + speedFactor); // Top gets wider as we speed up (Warp)

    // Maps 0..3 to -0.5 .. 0.5
    const normalizedLane = (lineIndex / LANE_COUNT) - 0.5;

    const xCurrentBottom = (w / 2) + (normalizedLane * bottomW);
    const xCurrentTop = (w / 2) + (normalizedLane * topW);

    return xCurrentTop + (xCurrentBottom - xCurrentTop) * progress;
}

function getLaneCenterX(laneIndex: number, y: number, w: number, h: number, currentSpeed: number) {
    return getLineX(laneIndex + 0.5, y, w, h, currentSpeed);
}

export default function BaseRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Render State
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Game Refs
    const playerLane = useRef(1);
    const playerX = useRef(1); // Visual float index
    const playerY = useRef(0);
    const playerVy = useRef(0);
    const isDucking = useRef(false);

    // Physics
    const speed = useRef(BASE_SPEED);
    const scoreRef = useRef(0);
    const distanceRef = useRef(0);

    // Objects
    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);
    const stars = useRef<Star[]>([]);

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
        distanceRef.current = 0;

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
            y: -200, // Spawn further up
            type,
            subType
        });
    }, []);

    // --- Input & Init ---
    useEffect(() => {
        // Init Stars
        const s: Star[] = [];
        for (let i = 0; i < 100; i++) {
            s.push({
                x: Math.random(),
                y: Math.random(),
                z: Math.random() * 2 + 0.5,
                size: Math.random() * 1.5
            });
        }
        stars.current = s;

        // Farcaster
        try {
            if (sdk && sdk.actions) sdk.actions.ready();
        } catch (e) { console.error("SDK Error", e); }
    }, []);

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

            // --- 1. Physics ---

            // Speed (Exponential)
            speed.current = Math.min(MAX_SPEED, speed.current + (speed.current * 0.0001));
            distanceRef.current += speed.current * 0.01;

            // Lane Slide
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            // Gravity
            if (playerY.current < GROUND_Y || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > GROUND_Y) {
                    playerY.current = GROUND_Y;
                    playerVy.current = 0;
                }
            }

            // Spawn
            spawnTimer.current += dt;
            const spawnInterval = 7000 / speed.current;
            if (spawnTimer.current > spawnInterval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // --- 2. Draw Background (Anti-Hypnosis) ---
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.35;

            // Gradient Sky
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(horizon / h, COLOR_BG_BOT);
            grad.addColorStop(1, '#050510');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Stars (Parallax)
            ctx.fillStyle = '#ffffff';
            stars.current.forEach(s => {
                // Move stars down/out
                s.y += (speed.current * 0.0005) / s.z;
                // Reset
                if (s.y > 1) { s.y = 0; s.x = Math.random(); }

                // Draw based on horizon logic roughly or just pure screen percentage
                // We'll map 0..1 to 0..horizon for sky stars
                const sy = s.y * h; // Simple fullscreen for now to look like space travel
                const sx = (s.x - 0.5) * w * (1 + s.y) + w / 2; // Slight spread

                ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                ctx.fillRect(sx, sy, s.size, s.size);
            });
            ctx.globalAlpha = 1.0;

            // Horizon Bloom
            const bloom = ctx.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, w * 0.8);
            bloom.addColorStop(0, COLOR_HORIZON);
            bloom.addColorStop(0.2, 'transparent');
            ctx.fillStyle = bloom;
            ctx.globalAlpha = 0.4;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1.0;


            // --- 3. Road / Rails ---
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_RAIL;
            ctx.strokeStyle = COLOR_RAIL;
            ctx.lineWidth = 3;
            ctx.beginPath();

            // Left Rail
            ctx.moveTo(getLineX(0, h, w, h, speed.current), h);
            ctx.lineTo(getLineX(0, horizon, w, h, speed.current), horizon);
            // Right Rail
            ctx.moveTo(getLineX(LANE_COUNT, h, w, h, speed.current), h);
            ctx.lineTo(getLineX(LANE_COUNT, horizon, w, h, speed.current), horizon);
            ctx.stroke();

            // Lane Dividers
            ctx.strokeStyle = COLOR_MARKER;
            ctx.lineWidth = 2;
            const dashOffset = (-distanceRef.current * 50) % 100;
            ctx.setLineDash([30, 50]); // Create dash effect
            ctx.lineDashOffset = dashOffset;

            ctx.beginPath();
            for (let i = 1; i < LANE_COUNT; i++) {
                ctx.moveTo(getLineX(i, h, w, h, speed.current), h);
                ctx.lineTo(getLineX(i, horizon, w, h, speed.current), horizon);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;


            // --- 4. Warp Lines (High Speed) ---
            if (speed.current > 20) {
                const intensity = (speed.current - 20) / 30;
                ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const lx = Math.random() < 0.5 ? Math.random() * w * 0.2 : w * 0.8 + Math.random() * w * 0.2;
                    const ly = Math.random() * h;
                    const len = Math.random() * 100 * intensity;
                    ctx.moveTo(lx, ly);
                    // Angle away from center
                    const cx = w / 2; const cy = h / 2;
                    const ang = Math.atan2(ly - cy, lx - cx);
                    ctx.lineTo(lx + Math.cos(ang) * len, ly + Math.sin(ang) * len);
                }
                ctx.stroke();
            }


            // --- 5. Entities ---
            const playerScreenY = h - 120; // Fixed player Y on screen

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                if (ent.y === -200) ent.y = horizon;

                const progress = (ent.y - horizon) / (h - horizon);
                const scale = 0.1 + (progress * 1.5); // Perspective scaling
                ent.y += speed.current * scale;

                const ex = getLaneCenterX(ent.lane, ent.y, w, h, speed.current);
                const size = 60 * scale;

                if (!ent.collected) {
                    if (ent.type === 'coin') {
                        // Blue Coin with White Center Glow
                        const gradC = ctx.createRadialGradient(ex, ent.y, size * 0.1, ex, ent.y, size * 0.5);
                        gradC.addColorStop(0, 'white');
                        gradC.addColorStop(0.5, COLOR_COIN);
                        gradC.addColorStop(1, 'transparent');

                        ctx.fillStyle = gradC;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size / 2, 0, Math.PI * 2);
                        ctx.fill();

                        // Solid inner core
                        ctx.fillStyle = COLOR_COIN;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size * 0.3, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Obstacle (Red Wireframe Cube)
                        // Simple 2.5D Cube
                        const boxS = size;
                        const boxY = ent.subType === 'air' ? ent.y - (100 * scale) : ent.y - boxS / 2;

                        ctx.strokeStyle = COLOR_OBSTACLE;
                        ctx.lineWidth = 2 * scale;
                        ctx.shadowColor = COLOR_OBSTACLE;
                        ctx.shadowBlur = 10;

                        // Front Face
                        ctx.strokeRect(ex - boxS / 2, boxY - boxS / 2, boxS, boxS);

                        // Inner "X" for danger
                        ctx.beginPath();
                        ctx.moveTo(ex - boxS / 2, boxY - boxS / 2);
                        ctx.lineTo(ex + boxS / 2, boxY + boxS / 2);
                        ctx.moveTo(ex + boxS / 2, boxY - boxS / 2);
                        ctx.lineTo(ex - boxS / 2, boxY + boxS / 2);
                        ctx.stroke();

                        ctx.fillStyle = `rgba(255, 0, 60, 0.2)`;
                        ctx.fillRect(ex - boxS / 2, boxY - boxS / 2, boxS, boxS);

                        ctx.shadowBlur = 0;

                        // Pole if air
                        if (ent.subType === 'air') {
                            ctx.fillStyle = '#666';
                            ctx.fillRect(ex - 2, boxY + boxS / 2, 4, 150 * scale);
                        }
                    }
                }

                // Collision
                if (!ent.collected && Math.abs(ent.y - playerScreenY) < 30) {
                    const pCx = getLaneCenterX(playerX.current, playerScreenY, w, h, speed.current);
                    if (Math.abs(ex - pCx) < 40) {
                        let hit = false;
                        if (ent.type === 'coin') hit = true;
                        else {
                            if (ent.subType === 'air') { if (!isDucking.current) hit = true; } // Hit high if not ducking
                            else { if (playerY.current > -50) hit = true; } // Hit low if on ground
                        }

                        if (hit) {
                            if (ent.type === 'coin') {
                                ent.collected = true;
                                scoreRef.current += 100;
                                setScore(s => s + 100);
                                particles.current.push({ x: ex, y: ent.y, vx: 0, vy: -5, life: 1, color: COLOR_COIN });
                                floatTexts.current.push({ text: '+100', x: ex, y: ent.y - 50, life: 1, opacity: 1 });
                            } else {
                                setGameState('gameover');
                            }
                        }
                    }
                }

                if (ent.y > h + 150) entities.current.splice(i, 1);
            }


            // --- 6. Player ---
            const pX = getLaneCenterX(playerX.current, playerScreenY, w, h, speed.current);
            const pY = playerScreenY + playerY.current;
            const tilt = (playerX.current - playerLane.current) * -0.5; // Tilt opposite to slide? Or same?
            // Actually, if moving Right (lane increases), (target - current) is positive.
            // Tilt should be into the turn.
            // Let's us velocity logic:
            const pVelX = (playerLane.current - playerX.current);

            ctx.save();
            ctx.translate(pX, pY);
            ctx.rotate(pVelX * 0.5); // Tilt

            // Player Shadow
            if (playerY.current === GROUND_Y) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(0, 30, 20, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Player Body (Triangle/Ship shape)
            const dS = isDucking.current ? 0.5 : 1;
            ctx.fillStyle = COLOR_PLAYER;
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(0, -30 * dS);
            ctx.lineTo(20, 20 * dS);
            ctx.lineTo(0, 10 * dS); // Tail indent
            ctx.lineTo(-20, 20 * dS);
            ctx.closePath();
            ctx.fill();

            // Cockpit
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(0, -5 * dS, 5, 10 * dS, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
            ctx.shadowBlur = 0;


            // --- 7. Particles & Text ---
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.y += p.vy;
                p.life -= 0.05;
                if (p.life <= 0) particles.current.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 10 * p.life, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;

            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 2;
                ft.life -= 0.02;
                if (ft.life <= 0) floatTexts.current.splice(i, 1);
                else {
                    ctx.fillStyle = '#fff';
                    ctx.shadowColor = '#000';
                    ctx.shadowBlur = 5;
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText(ft.text, ft.x, ft.y);
                }
            }
            ctx.shadowBlur = 0;

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, [gameState, spawnEntity]);

    // --- Render ---
    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
            userSelect: 'none'
        }}>
            {/* UI */}
            <div style={{
                position: 'absolute', top: 20, width: '100%',
                textAlign: 'center', pointerEvents: 'none', zIndex: 10
            }}>
                <h1 style={{
                    fontSize: '4rem', margin: 0, color: 'white',
                    textShadow: `0 0 20px ${COLOR_PLAYER}`, fontStyle: 'italic'
                }}>{score}</h1>
            </div>

            {/* Controls Layer */}
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

            {/* Game Over */}
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 20, backdropFilter: 'blur(10px)'
                }}>
                    <h2 style={{ fontSize: '3rem', color: COLOR_OBSTACLE, textShadow: '0 0 20px red' }}>CRITICAL FAILURE</h2>
                    <p style={{ color: 'white', fontSize: '1.5rem' }}>SCORE: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            marginTop: 20,
                            background: COLOR_PLAYER,
                            color: 'white',
                            border: 'none',
                            padding: '15px 40px',
                            fontSize: '1.2rem',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            boxShadow: `0 0 20px ${COLOR_PLAYER}`
                        }}
                    >
                        REBOOT SYSTEM
                    </button>
                    <div style={{ marginTop: 30, color: '#888' }}>WASD / ARROWS to Move | W to Jump | S to Duck</div>
                </div>
            )}
        </div>
    );
}
