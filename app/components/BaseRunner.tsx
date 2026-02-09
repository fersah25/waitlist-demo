"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 3;       // Start significantly slower
const MAX_SPEED = 18;       // Cap speed at 18
const LANE_SWITCH_SPEED = 0.15;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const GROUND_Y = 0;         // Player Y position (0 is ground)

const SPAWN_Z = 2000;       // Spawn depth

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
    z: number;
    type: 'coin' | 'eth' | 'arch';
    collected: boolean;
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
    const playerLane = useRef(1); // 0, 1, 2
    const playerX = useRef(1);    // Interpolated lane position (0.0 - 2.0)
    const playerY = useRef(0);    // Vertical position (0=ground, <0=air)
    const playerVy = useRef(0);   // Vertical velocity
    const isDucking = useRef(false);

    const speed = useRef(BASE_SPEED);

    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);

    const lastTime = useRef(0);
    const spawnTimer = useRef(0);

    // --- Helpers ---

    // Project (lane, z) -> Screen Coordinates
    // Removing unused parameters and variables strictly
    const project = useCallback((lane: number, z: number, w: number, h: number) => {
        const horizonY = h * 0.35;
        const f = 500;
        const scale = f / (z + f);

        // Map z to y
        const yBase = horizonY + (h - horizonY) * scale;

        // Lane positioning
        // Center X is w / 2
        // Lane offset scales with depth/perspective
        const x = (w / 2) + ((lane - 1) * (w * 0.35) * scale);

        return { x, y: yBase, scale };
    }, []);

    const spawnEntity = useCallback(() => {
        // Random lane
        const lane = Math.floor(Math.random() * LANE_COUNT);

        // Determine type
        const r = Math.random();
        let type: 'coin' | 'eth' | 'arch';

        if (r > 0.6) {
            // Obstacle (40% chance)
            // 50/50 split between eth (jump) and arch (duck)
            type = Math.random() > 0.5 ? 'eth' : 'arch';
        } else {
            // Coin (60% chance)
            type = 'coin';
        }

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            z: SPAWN_Z,
            type,
            collected: false
        });
    }, []);

    const restartGame = useCallback(() => {
        playerLane.current = 1;
        playerX.current = 1;
        playerY.current = 0;
        playerVy.current = 0;
        isDucking.current = false;

        speed.current = BASE_SPEED;

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
            if (sdk && sdk.actions) {
                sdk.actions.ready();
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    // --- Input ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            const k = e.key.toLowerCase();

            // Lanes
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
                // Fast fall if in air
                if (playerY.current < GROUND_Y) {
                    playerVy.current += 10;
                }
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

            // --- Update Physics ---

            // Player Lane Smooth
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            // Player Jump/Gravity
            if (playerY.current < GROUND_Y || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > GROUND_Y) {
                    playerY.current = GROUND_Y;
                    playerVy.current = 0;
                }
            }

            // Speed Curve based on SCORE
            // Example: +1 speed every 100 points
            const scoreBasedSpeed = BASE_SPEED + (score / 100);
            speed.current = Math.min(MAX_SPEED, scoreBasedSpeed);

            // Spawn Logic
            spawnTimer.current += dt;
            // Spawn interval decreases as speed increases
            const currentInterval = 4000 / speed.current;
            if (spawnTimer.current > currentInterval) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // Update Entities
            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                ent.z -= speed.current * 8; // Multiplier to map speed to Z units

                if (ent.z < -200) {
                    // Passed player
                    entities.current.splice(i, 1);
                    continue;
                }

                // Collision Detection
                // Player is effectively at z=0, lane=playerX (float), y=playerY
                // Entity is at ent.z, ent.lane (int)
                // Check Z proximity
                if (!ent.collected && ent.z < 50 && ent.z > -50) {
                    // Check Horizontal: visual overlap
                    if (Math.abs(ent.lane - playerX.current) < 0.6) {

                        let collision = false;

                        // Constants defining player state
                        const isJumping = playerY.current < -30; // Significant air time
                        const isDuckingState = isDucking.current;

                        if (ent.type === 'coin') {
                            ent.collected = true;
                            setScore(s => s + 10);
                            floatTexts.current.push({
                                text: '+10', x: 0, y: 0, life: 1, opacity: 1
                            });
                        } else if (ent.type === 'eth') {
                            // ETH Obstacle (Ground) -> Must be JUMPING
                            if (!isJumping) {
                                collision = true;
                            }
                        } else if (ent.type === 'arch') {
                            // ARCH Obstacle (High) -> Must be DUCKING
                            if (!isDuckingState) {
                                collision = true;
                            }
                        }

                        if (collision) {
                            setGameState('gameover');
                        }
                    }
                }
            }

            // Update Particles
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.04;
                if (p.life <= 0) particles.current.splice(i, 1);
            }

            // Update Text
            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 2;
                ft.life -= 0.03;
                if (ft.life <= 0) floatTexts.current.splice(i, 1);
            }

            // --- Render ---
            const w = canvas.width;
            const h = canvas.height;
            // horizonY is used here for background/rendering
            // NOTE: We rely on the project() function for lane drawing to keep dry, 
            // but we might need horizonY for background rects if needed.
            // Actually, we can get yBase from project for lane lines.

            // Background
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, COLOR_BG_TOP);
            grad.addColorStop(1, COLOR_BG_BOT);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Draw Lanes
            ctx.lineWidth = 4;
            ctx.strokeStyle = COLOR_LANE;
            ctx.shadowColor = COLOR_LANE;
            ctx.shadowBlur = 15;
            ctx.beginPath();

            for (let i = -0.5; i <= LANE_COUNT - 0.5; i++) {
                const pNear = project(i + 0.5, 0, w, h); // z=0
                const pFar = project(i + 0.5, SPAWN_Z, w, h); // z=max

                ctx.moveTo(pNear.x, pNear.y);
                ctx.lineTo(pFar.x, pFar.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw Entities (Painter's Algo: Far to Near)
            entities.current.sort((a, b) => b.z - a.z);

            for (const ent of entities.current) {
                if (ent.collected) continue;

                const proj = project(ent.lane, ent.z, w, h);
                const size = 100 * proj.scale;

                if (ent.type === 'coin') {
                    // Draw Coin
                    ctx.shadowColor = COLOR_COIN_BASE;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = COLOR_COIN_BASE;
                    ctx.beginPath();
                    ctx.arc(proj.x, proj.y - size / 2, size / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = COLOR_COIN_INNER;
                    ctx.beginPath();
                    ctx.arc(proj.x, proj.y - size / 2, size / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else if (ent.type === 'eth') {
                    // ETH Diamond (Ground)
                    const halfW = size * 0.4;
                    const height = size * 0.8;

                    ctx.fillStyle = COLOR_OBSTACLE_ETH;
                    ctx.shadowColor = COLOR_OBSTACLE_ETH;
                    ctx.shadowBlur = 20;

                    ctx.beginPath();
                    ctx.moveTo(proj.x, proj.y - height); // Top
                    ctx.lineTo(proj.x + halfW, proj.y - height / 2); // Right
                    ctx.lineTo(proj.x, proj.y); // Bottom
                    ctx.lineTo(proj.x - halfW, proj.y - height / 2); // Left
                    ctx.closePath();
                    ctx.fill();

                    // Inner detail
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.beginPath();
                    ctx.moveTo(proj.x, proj.y - height);
                    ctx.lineTo(proj.x + halfW / 2, proj.y - height / 2);
                    ctx.lineTo(proj.x, proj.y);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                } else if (ent.type === 'arch') {
                    // RED Arch (High)
                    const archW = size;
                    const archH = size * 1.2;
                    const legW = size * 0.1;

                    ctx.fillStyle = COLOR_OBSTACLE_ARCH;
                    ctx.shadowColor = COLOR_OBSTACLE_ARCH;
                    ctx.shadowBlur = 20;

                    // Draw Arch shape
                    // Left leg
                    ctx.fillRect(proj.x - archW / 2, proj.y - archH, legW, archH);
                    // Right leg
                    ctx.fillRect(proj.x + archW / 2 - legW, proj.y - archH, legW, archH);
                    // Top Bar
                    ctx.fillRect(proj.x - archW / 2, proj.y - archH, archW, legW * 2);

                    ctx.shadowBlur = 0;

                    // Warning marker on ground
                    ctx.fillStyle = 'rgba(255,0,0,0.3)';
                    ctx.fillRect(proj.x - archW / 2, proj.y - size * 0.1, archW, size * 0.1);
                }
            }

            // Draw Player
            const playerProj = project(playerX.current, 0, w, h);
            const pY = playerProj.y + playerY.current * playerProj.scale;
            const pSize = 100 * playerProj.scale;

            // Shadow
            if (playerY.current > -5) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(playerProj.x, playerProj.y, pSize * 0.3, pSize * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Player Body
            const duckFactor = isDucking.current ? 0.5 : 1.0;

            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 20;
            ctx.fillStyle = COLOR_BG_TOP;
            ctx.strokeStyle = COLOR_PLAYER;
            ctx.lineWidth = 4;

            ctx.beginPath();
            const halfW = pSize * 0.3;
            const height = pSize * 0.6 * duckFactor;

            ctx.moveTo(playerProj.x, pY - height); // Tip
            ctx.lineTo(playerProj.x + halfW, pY);
            ctx.lineTo(playerProj.x - halfW, pY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Engine Glow
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(playerProj.x, pY - height * 0.2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Render Text
            for (const ft of floatTexts.current) {
                if (ft.x === 0 && ft.y === 0) {
                    ft.x = playerProj.x;
                    ft.y = pY - 50;
                }

                ctx.fillStyle = `rgba(255, 255, 255, ${ft.opacity})`;
                ctx.font = 'bold 24px monospace';
                ctx.fillText(ft.text, ft.x, ft.y);
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, [gameState, project, spawnEntity, score]); // Added score to dependencies since we use it to calc speed

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

            {/* Controls Info */}
            <div style={{
                position: 'absolute', bottom: 20, width: '100%',
                textAlign: 'center', pointerEvents: 'none', zIndex: 10,
                color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem'
            }}>
                WASD / ARROWS to Move • SPACE to Jump
            </div>

            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            {/* Game Over Overlay */}
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
                    <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: 30 }}>
                        Score: {score}
                    </p>
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
