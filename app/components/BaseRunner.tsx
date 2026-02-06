"use client";
import React, { useRef, useEffect, useState } from "react";
import sdk from '@farcaster/frame-sdk';
// import styles from "../page.module.css"; // Removing CSS Module

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 5;
const MAX_SPEED = 15;
const SPEED_INC = 0.005;
const LANE_SWITCH_SPEED = 0.2; // Lerp factor

// Colors
const COLOR_BG = '#000000';
const COLOR_GRID = '#00F0FF';
const COLOR_PLAYER = '#0052FF';
const COLOR_OBSTACLE = '#FF0420';
const COLOR_COIN = '#627EEA'; // ETH Blue/Goldish

interface Entity {
    id: number;
    lane: number; // 0, 1, 2
    y: number;
    type: 'obstacle' | 'coin';
    collected?: boolean;
}

export default function BaseRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Game State
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    // Logic Refs
    const playerLane = useRef(1); // Start Middle
    const playerX = useRef(0.5); // 0.0 to 1.0 (relative to road width)
    const speed = useRef(BASE_SPEED);
    const scoreRef = useRef(0);
    const entities = useRef<Entity[]>([]);
    const lastTime = useRef(0);
    const spawnTimer = useRef(0);

    // --- Helpers ---
    const getLaneX = (lane: number) => {
        // Lanes are 0, 1, 2. 
        // 0 -> 1/6, 1 -> 3/6 (0.5), 2 -> 5/6
        return (lane * 2 + 1) / (LANE_COUNT * 2);
    };

    const spawnEntity = () => {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const type = Math.random() > 0.3 ? 'obstacle' : 'coin'; // 70% obstacles

        // Prevent stacking? Simple logic: just push.
        // Check collision with recent spawns to match lane?
        // Basic version: Just spawn.

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100, // Spawn above screen perspective
            type
        });
    };

    const restartGame = () => {
        playerLane.current = 1;
        playerX.current = 0.5;
        speed.current = BASE_SPEED;
        scoreRef.current = 0;
        entities.current = [];
        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    };

    // --- Interaction ---
    const handleInput = (x: number, width: number) => {
        if (gameState !== 'playing') return;

        if (x < width / 2) {
            // Left
            playerLane.current = Math.max(0, playerLane.current - 1);
        } else {
            // Right
            playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
        }
    };

    const handleTouch = (e: React.TouchEvent) => handleInput(e.touches[0].clientX, window.innerWidth);
    const handleClick = (e: React.MouseEvent) => handleInput(e.clientX, window.innerWidth);

    // --- Init ---
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

    // --- Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;

        const loop = (time: number) => {
            if (gameState !== 'playing') return;

            const dt = Math.min(time - lastTime.current, 50);
            lastTime.current = time;

            // Speed Scaling
            speed.current = Math.min(MAX_SPEED, speed.current + SPEED_INC);
            scoreRef.current += speed.current * 0.05; // Distance score

            // Sync Display Score
            // Sync Display Score
            const currentScore = Math.floor(scoreRef.current);
            setScore(prev => (currentScore > prev ? currentScore : prev));

            // Spawning
            spawnTimer.current += dt;
            const spawnRate = 10000 / speed.current; // Faster spawn as speed increases
            if (spawnTimer.current > spawnRate) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // Player Pos Interpolation
            const targetX = getLaneX(playerLane.current);
            playerX.current += (targetX - playerX.current) * LANE_SWITCH_SPEED;

            // Clear
            ctx.fillStyle = COLOR_BG;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- Draw Road (Retro Perspective) ---
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.3; // Horizon line

            // Grid Lines (Vertical)
            ctx.strokeStyle = COLOR_GRID;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_GRID;

            ctx.beginPath();
            // Draw main 4 lines defining 3 lanes
            for (let i = 0; i <= LANE_COUNT; i++) {
                // Determine x at bottom
                const xBottom = (i / LANE_COUNT) * w;
                // Determine x at horizon (vanishing point is w/2)
                // Actually, let's make vanishing point w/2, horizon y
                const xTop = w / 2 + (xBottom - w / 2) * 0.1; // Converge

                ctx.moveTo(xBottom, h);
                ctx.lineTo(xTop, horizon);
            }
            ctx.stroke();

            // Horizontal Moving Lines
            const offset = (Date.now() * speed.current * 0.5) % 100;
            // Draw lines coming towards us
            // Z-space mapping: y = screenY
            // Simple approach: Linear lines moving down? No, exponential for perspective.
            // Let's just do linear lines for retro feel or simplified.
            // Actually, `y = h / z` projection.
            // Simplified:
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            for (let i = 0; i < h; i += 40) {
                const y = horizon + ((i + offset) % (h - horizon));
                if (y < horizon) continue;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;


            // --- Entities ---
            // Sort by Y to draw back-to-front? Yes.
            // Actually entity.y IS Z-position in a 3D sense? 
            // In typical runner logic: Y moves 0 -> max. 
            // Here let's say Y is screen Y to keep it simple 2.5D.
            // Horizon is Y=0 for logic, but rendered at `horizon` var.
            // Let's stick to: Spawn at horizon, move down to h.

            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];

                // Move
                if (ent.y === -100) ent.y = horizon; // Init

                // Perspective Scale
                // As Y goes from horizon to h, scale goes 0.1 to 1.0
                const progress = (ent.y - horizon) / (h - horizon);
                const scale = 0.1 + (progress * 0.9);
                const moveSpeed = speed.current * scale; // Move faster as closer

                ent.y += moveSpeed;

                // X position based on Lane lines
                // xBottom and xTop were unused. Removed.
                // Lerp based on progress
                // Actually we used lines: xTop to xBottom. 
                // Lane Center at bottom:
                const laneCenterBottom = ((ent.lane * 2 + 1) / (LANE_COUNT * 2)) * w;
                // Lane Center at top:
                const laneCenterTop = w / 2 + (laneCenterBottom - w / 2) * 0.1;

                const currentX = laneCenterTop + (laneCenterBottom - laneCenterTop) * progress;
                const size = 60 * scale;

                // Collision
                // Player is at Y ~ h - 100.
                const playerScreenY = h - 100;
                const hitDist = 40;

                if (Math.abs(ent.y - playerScreenY) < hitDist) {
                    // Check Grid X
                    // Approximate player X
                    const pX = playerX.current * w;
                    if (Math.abs(currentX - pX) < hitDist) {
                        if (ent.type === 'obstacle') {
                            setGameState('gameover');
                        } else if (ent.type === 'coin' && !ent.collected) {
                            ent.collected = true;
                            scoreRef.current += 100;
                            // particle effect?
                        }
                    }
                }

                // Draw
                if (ent.collected) continue;

                if (ent.type === 'obstacle') {
                    ctx.fillStyle = COLOR_OBSTACLE;
                    ctx.fillRect(currentX - size / 2, ent.y - size / 2, size, size);
                    // Glow
                    ctx.shadowColor = COLOR_OBSTACLE;
                    ctx.shadowBlur = 10;
                    ctx.strokeRect(currentX - size / 2, ent.y - size / 2, size, size);
                } else {
                    ctx.beginPath();
                    ctx.arc(currentX, ent.y, size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = COLOR_COIN;
                    ctx.fill();
                    ctx.shadowColor = COLOR_COIN;
                    ctx.shadowBlur = 10;
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;

                // Remove
                if (ent.y > h + 50) {
                    entities.current.splice(i, 1);
                }
            }

            // --- Draw Player ---
            const pX = playerX.current * w;
            const pY = h - 100;
            const pSize = 50;

            // Base Logo (Blue Circle)
            ctx.beginPath();
            ctx.arc(pX, pY, pSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_PLAYER;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';
            ctx.stroke();

            // Inner
            ctx.beginPath();
            ctx.arc(pX, pY, pSize * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [gameState]);

    return (
        <div style={{
            overflow: 'hidden',
            touchAction: 'none',
            position: 'relative',
            background: 'black',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* HUD */}
            <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'white', textShadow: '0 0 10px #00F0FF', margin: 0 }}>{score}</h1>
            </div>

            {/* Input Zones */}
            <div onMouseDown={handleClick} onTouchStart={handleTouch} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 5 }} />

            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%' }}
            />

            {/* Game Over */}
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20
                }}>
                    <h2 style={{ fontSize: '3rem', color: '#FF0420', marginBottom: 10 }}>CRASHED!</h2>
                    <p style={{ fontSize: '1.5rem', color: '#fff', marginBottom: 30 }}>Score: {score}</p>
                    <button
                        onClick={restartGame}
                        style={{
                            padding: '15px 40px', fontSize: '1.2rem', fontWeight: 'bold',
                            background: '#0052FF', color: 'white', border: 'none', borderRadius: 50,
                            cursor: 'pointer', boxShadow: '0 0 20px rgba(0,82,255,0.5)', zIndex: 30
                        }}
                    >
                        RESTART RUN
                    </button>
                </div>
            )}
        </div>
    );
}
