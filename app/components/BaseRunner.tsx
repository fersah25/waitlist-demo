"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 15;
const MAX_SPEED = 60;
const LANE_SWITCH_SPEED = 0.2; // Snappier
const GRAVITY = 0.8;
const JUMP_FORCE = -16;
const GROUND_Y = 0;

// Anti-Hypnosis Palette
const COLOR_BG_TOP = '#0A0A2E'; // Deep Space
const COLOR_BG_BOT = '#1A1A40'; // Horizon
const COLOR_HORIZON_GLOW = '#4B0082'; // Indigo Glow
const COLOR_RAIL = '#00F0FF';   // Cyan Neon
const COLOR_MARKER = '#FFFFFF'; // White Road Lines
const COLOR_PLAYER = '#0052FF'; // Electric Blue
const COLOR_OBSTACLE = '#FF0000'; // Solid Red
const COLOR_COIN = '#00F0FF';   // Cyan/Blue Coin (Constant)

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
    z: number; // Depth
    size: number;
}

interface Pyramid {
    x: number; // -1 (left) or 1 (right)
    y: number; // Distance
    z: number;
    type: number;
}

// --- Helpers (Pure) ---
function getLineX(lineIndex: number, y: number, w: number, h: number, currentSpeed: number) {
    const horizon = h * 0.35;
    if (y < horizon) return w / 2;

    const progress = (y - horizon) / (h - horizon);

    // Dynamic Warp
    const speedFactor = Math.max(0, (currentSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
    const convergence = 0.05 + (speedFactor * 0.4);

    const xCenter = w / 2;
    const bottomW = w * 1.0;
    const topW = w * 0.1 * (1 + speedFactor);

    const normalizedLane = (lineIndex / LANE_COUNT) - 0.5;

    const xCurrentBottom = xCenter + (normalizedLane * bottomW);
    const xCurrentTop = xCenter + (normalizedLane * topW);

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
    const playerX = useRef(1);
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
    const pyramids = useRef<Pyramid[]>([]);

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
            y: -200,
            type,
            subType
        });
    }, []);

    // --- Init ---
    useEffect(() => {
        // Init Stars
        const s: Star[] = [];
        for (let i = 0; i < 80; i++) {
            s.push({
                x: Math.random(),
                y: Math.random(),
                z: Math.random() * 2 + 0.5,
                size: Math.random() * 2
            });
        }
        stars.current = s;

        // Init Pyramids
        const p: Pyramid[] = [];
        for (let i = 0; i < 10; i++) {
            p.push({
                x: Math.random() > 0.5 ? 1 : -1,
                y: Math.random() * 1000,
                z: Math.random() * 2 + 1,
                type: Math.floor(Math.random() * 3)
            });
        }
        pyramids.current = p;

        try {
            if (sdk && sdk.actions) sdk.actions.ready();
        } catch (e) { console.error(e); }
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
            // Speed (Linear Cap)
            // Cap at MAX_SPEED, increase log based on score
            // Actually simple: increase by small factor
            if (speed.current < MAX_SPEED) {
                speed.current += 0.01;
            }
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
            const spawnInterval = 6000 / speed.current; // 6000 base
            if (spawnTimer.current > spawnInterval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // --- Background ---
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.35;

            // Deep Space Gradient
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(0.5, COLOR_BG_BOT);
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Horizon Glow
            const glow = ctx.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, w * 0.9);
            glow.addColorStop(0, COLOR_HORIZON_GLOW);
            glow.addColorStop(0.5, 'transparent');
            ctx.fillStyle = glow;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1.0;

            // Stars
            ctx.fillStyle = '#ffffff';
            stars.current.forEach(s => {
                s.y += (speed.current * 0.0002) / s.z;
                if (s.y > 1) { s.y = 0; s.x = Math.random(); }

                const sy = s.y * h * 0.8; // Stick to upper sky mostly
                const sx = (s.x - 0.5) * w + w / 2;

                ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                ctx.fillRect(sx, sy, s.size, s.size);
            });
            ctx.globalAlpha = 1.0;

            // Pyramids (Parallax)
            pyramids.current.forEach(p => {
                // Move towards camera
                p.y -= speed.current * 0.1;
                if (p.y < -100) {
                    p.y = 1000 + Math.random() * 500;
                    p.x = Math.random() > 0.5 ? 1 : -1;
                }

                // Render: Simple triangles on side of road
                // Project X based on depth (y)
                // We'll fake perspective: center X is vanishing point
                const zFactor = 500 / (p.y + 100); // Inverse to distance
                if (zFactor < 0 || zFactor > 5) return;

                const pyBottom = horizon + (p.y * 0.2); // Stick to ground plane roughly
                // Actually need proper projection relative to horizon:
                // horizon is y=0 in 3D space.
                // p.y is distance Z.
                // screenY = horizon + (camHeight / Z)
                const screenY = horizon + (3000 / (10 + p.y)); // Fake it

                // Keep them below horizon
                if (screenY < horizon) return;

                const size = 100 * (100 / (10 + p.y));
                const centerX = w / 2 + (p.x * w * 0.4) * (100 / (10 + p.y));

                ctx.fillStyle = `rgba(0, 240, 255, ${0.1 + (0.5 * (100 / (10 + p.y)))})`;
                ctx.beginPath();
                ctx.moveTo(centerX, screenY - size);
                ctx.lineTo(centerX - size / 2, screenY);
                ctx.lineTo(centerX + size / 2, screenY);
                ctx.closePath();
                ctx.fill();
            });


            // --- Road ---
            ctx.shadowBlur = 15;
            ctx.shadowColor = COLOR_RAIL;
            ctx.strokeStyle = COLOR_RAIL;
            ctx.lineWidth = 4;
            ctx.beginPath();

            // Left Rail
            ctx.moveTo(getLineX(0, h, w, h, speed.current), h);
            ctx.lineTo(getLineX(0, horizon, w, h, speed.current), horizon);
            // Right Rail
            ctx.moveTo(getLineX(LANE_COUNT, h, w, h, speed.current), h);
            ctx.lineTo(getLineX(LANE_COUNT, horizon, w, h, speed.current), horizon);
            ctx.stroke();

            // Neon Tiles (Markers)
            ctx.strokeStyle = COLOR_MARKER;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 5;

            const tileSpacing = 200; // Screen pixels roughly
            const offset = (distanceRef.current * 20) % tileSpacing;

            // Simple approach: Iterate Y from bottom to horizon
            // We want log spacing for perspective.
            // Let's create lines at fixed world Z, project to screen Y.
            const worldZOffset = (distanceRef.current * 50) % 500;

            ctx.beginPath();
            for (let z = 100; z < 5000; z += 500) {
                const screenZ = z - worldZOffset;
                if (screenZ < 10) continue;

                // Project Z to Y
                // y = horizon + (H / Z)
                const progress = 1000 / (screenZ + 500); // 0..1
                const y = horizon + ((h - horizon) * progress);
                if (y > h || y < horizon) continue;

                // Draw line across lanes
                const lx = getLineX(0, y, w, h, speed.current);
                const rx = getLineX(LANE_COUNT, y, w, h, speed.current);
                ctx.moveTo(lx, y);
                ctx.lineTo(rx, y);
            }
            ctx.stroke();

            // Divider Lines (Dashed)
            ctx.setLineDash([20, 40]);
            ctx.beginPath();
            for (let i = 1; i < LANE_COUNT; i++) {
                ctx.moveTo(getLineX(i, h, w, h, speed.current), h);
                ctx.lineTo(getLineX(i, horizon, w, h, speed.current), horizon);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;


            // --- Entities ---
            const playerScreenY = h - 120;

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                if (ent.y === -200) ent.y = horizon;

                const progress = (ent.y - horizon) / (h - horizon);
                const scale = 0.1 + (progress * 1.5);
                ent.y += speed.current * scale;

                const ex = getLaneCenterX(ent.lane, ent.y, w, h, speed.current);
                const size = 60 * scale;

                if (!ent.collected) {
                    if (ent.type === 'coin') {
                        // Constant Blue/Cyan with White Glow
                        const gradC = ctx.createRadialGradient(ex, ent.y, size * 0.1, ex, ent.y, size * 0.5);
                        gradC.addColorStop(0, '#FFFFFF');
                        gradC.addColorStop(0.4, COLOR_COIN); // Cyan
                        gradC.addColorStop(1, 'transparent');

                        ctx.fillStyle = gradC;
                        ctx.beginPath();
                        ctx.arc(ex, ent.y, size / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Obstacle: Red Cube
                        const boxS = size;
                        const boxY = ent.subType === 'air' ? ent.y - (100 * scale) : ent.y - boxS / 2;

                        ctx.fillStyle = COLOR_OBSTACLE;
                        ctx.strokeStyle = '#330000'; // Dark border
                        ctx.lineWidth = 2;

                        // Face
                        ctx.fillRect(ex - boxS / 2, boxY - boxS / 2, boxS, boxS);
                        ctx.strokeRect(ex - boxS / 2, boxY - boxS / 2, boxS, boxS);

                        // Inner detail
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.fillRect(ex - boxS / 4, boxY - boxS / 4, boxS / 2, boxS / 2);

                        // Pole
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
                            if (ent.subType === 'air') { if (!isDucking.current) hit = true; }
                            else { if (playerY.current > -50) hit = true; } // Low hit
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

            // --- Player ---
            const pX = getLaneCenterX(playerX.current, playerScreenY, w, h, speed.current);
            const pY = playerScreenY + playerY.current;

            // Calc tilt locally
            const tilt = (playerLane.current - playerX.current) * 0.4;

            ctx.save();
            ctx.translate(pX, pY);
            ctx.rotate(tilt);

            // Shadow
            if (playerY.current === GROUND_Y) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(0, 30, 20, 10, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Ship
            const dS = isDucking.current ? 0.5 : 1;
            ctx.fillStyle = COLOR_PLAYER;
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(0, -30 * dS);
            ctx.lineTo(20, 20 * dS);
            ctx.lineTo(0, 10 * dS);
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


            // --- FX ---
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.y += p.vy;
                p.life -= 0.05;
                if (p.life <= 0) particles.current.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 8 * p.life, 0, Math.PI * 2);
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
            position: 'relative', width: '100vw', height: '100vh',
            backgroundColor: 'black', overflow: 'hidden',
            fontFamily: 'sans-serif', userSelect: 'none'
        }}>
            <div style={{
                position: 'absolute', top: 20, width: '100%',
                textAlign: 'center', pointerEvents: 'none', zIndex: 10
            }}>
                <h1 style={{
                    fontSize: '4rem', margin: 0, color: 'white',
                    textShadow: `0 0 20px ${COLOR_PLAYER}`, fontStyle: 'italic'
                }}>{score}</h1>
            </div>

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
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 20, backdropFilter: 'blur(10px)'
                }}>
                    <h2 style={{ fontSize: '3rem', color: COLOR_OBSTACLE, textShadow: '0 0 20px red' }}>CRASHED</h2>
                    <p style={{ color: 'white', fontSize: '1.5rem' }}>SCORE: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            marginTop: 20, background: COLOR_PLAYER, color: 'white',
                            border: 'none', padding: '15px 40px', fontSize: '1.2rem',
                            borderRadius: '5px', cursor: 'pointer',
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
