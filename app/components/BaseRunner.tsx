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
    // Helper to get the X coordinate of a specific lane line (0..LANE_COUNT) at a given Y
    // y is screen coordinate.
    const getLineX = (lineIndex: number, y: number, w: number, h: number) => {
        const horizon = h * 0.3;
        if (y < horizon) return w / 2;

        const progress = (y - horizon) / (h - horizon);

        // Line bottom X (0 to w based on ratio)
        const xBottom = (lineIndex / LANE_COUNT) * w;

        // Line top X (Vanishing point with convergence)
        // Convergence 0.1 means top width is 10% of bottom width
        const xTop = w / 2 + (xBottom - w / 2) * 0.1;

        return xTop + (xBottom - xTop) * progress;
    };

    const getLaneCenterX = (laneIndex: number, y: number, w: number, h: number) => {
        // Support fractional lanes for player lerping
        // We can interpolate between the "lines" of the floor(laneIndex) and ceil(laneIndex) + 1?
        // Actually simplest is: Center of Lane L is average of Line L and Line L+1.
        // For fractional lane L (e.g. 1.5), we can just interp between Center(1) and Center(2).

        // Let's just calculate the two boundary lines for this "lane"
        // If laneIndex is 0.5, it means we are halfway between lane 0 and 1.
        // Actually, let's keep it consistent with the visual logic.
        // A "lane" is the space between line i and line i+1.
        // Center of logical lane i is (Line(i) + Line(i+1)) / 2

        // Since getLineX is linear with respect to lineIndex (due to linear lerps),
        // we can just pass (laneIndex + 0.5) to a hypothetical getLineX logic?
        // Let's verify:
        // getLineX(i) = Lerp(Top(i), Bot(i), p)
        // Top(i) is linear with i? Yes: w/2 + (i/N*w - w/2)*0.1 -> A + i*B
        // Bot(i) is linear with i? Yes: i/N*w

        // So yes, perfectly safe to just calculate "Line X" at index (laneIndex + 0.5)
        return getLineX(laneIndex + 0.5, y, w, h);
    };

    const spawnEntity = () => {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const type = Math.random() > 0.3 ? 'obstacle' : 'coin';

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100,
            type
        });
    };

    const restartGame = () => {
        playerLane.current = 1;
        // playerX is now just the physical lane index lerped, we will use that for calculation
        playerX.current = 1;
        speed.current = BASE_SPEED;
        scoreRef.current = 0;
        entities.current = [];
        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    };

    // --- Interaction ---
    const moveLeft = () => {
        if (gameState !== 'playing') return;
        playerLane.current = Math.max(0, playerLane.current - 1);
    };

    const moveRight = () => {
        if (gameState !== 'playing') return;
        playerLane.current = Math.min(LANE_COUNT - 1, playerLane.current + 1);
    };

    const handleTouch = (e: React.TouchEvent) => {
        const x = e.touches[0].clientX;
        if (x < window.innerWidth / 2) moveLeft();
        else moveRight();
    };
    const handleClick = (e: React.MouseEvent) => {
        const x = e.clientX;
        if (x < window.innerWidth / 2) moveLeft();
        else moveRight();
    };

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

        // Keyboard Logic
        const handleKeyDown = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') moveLeft();
            if (k === 'arrowright' || k === 'd') moveRight();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('keydown', handleKeyDown);
        }
    }, [gameState]);

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
            // Distance Score REMOVED as per request. Only coins count.

            // Sync Display Score
            const currentScore = Math.floor(scoreRef.current);
            setScore(prev => (currentScore > prev ? currentScore : prev));

            // Spawning
            spawnTimer.current += dt;
            const spawnRate = 10000 / speed.current;
            if (spawnTimer.current > spawnRate) {
                spawnEntity();
                spawnTimer.current = 0;
            }

            // Player Lane Interpolation (Lerp the integer lane index)
            // Normalized speed independent of frame rate would be better but simple lerp works for now
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            // Clear
            ctx.fillStyle = COLOR_BG;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- Draw Road ---
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.3;

            // Grid Lines
            ctx.strokeStyle = COLOR_GRID;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_GRID;

            ctx.beginPath();
            for (let i = 0; i <= LANE_COUNT; i++) {
                const xBottom = getLineX(i, h, w, h);
                const xTop = getLineX(i, horizon, w, h);

                ctx.moveTo(xBottom, h);
                ctx.lineTo(xTop, horizon);
            }
            ctx.stroke();

            // Horizontal Lines
            const offset = (Date.now() * speed.current * 0.5) % 100;
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
            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];

                if (ent.y === -100) ent.y = horizon;

                const progress = (ent.y - horizon) / (h - horizon);
                const scale = 0.1 + (progress * 0.9);
                const moveSpeed = speed.current * scale;
                ent.y += moveSpeed;

                // Use Helper for X
                const currentX = getLaneCenterX(ent.lane, ent.y, w, h);
                const size = 60 * scale;

                // Collision
                const playerScreenY = h - 100;
                const hitDist = 40; // Generous hit box

                if (Math.abs(ent.y - playerScreenY) < hitDist) {
                    // Calculate Player X at this Y-plane
                    // We use playerX.current which is looking at the 'lane index' (0-2 float)
                    // We need to convert that lane index to an X position AT the player's Y (h-100)

                    const pX = getLaneCenterX(playerX.current, playerScreenY, w, h);

                    if (Math.abs(currentX - pX) < hitDist) {
                        if (ent.type === 'obstacle') {
                            setGameState('gameover');
                        } else if (ent.type === 'coin' && !ent.collected) {
                            ent.collected = true;
                            scoreRef.current += 100;
                        }
                    }
                }

                if (ent.collected) continue;

                if (ent.type === 'obstacle') {
                    ctx.fillStyle = COLOR_OBSTACLE;
                    ctx.fillRect(currentX - size / 2, ent.y - size / 2, size, size);
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

                if (ent.y > h + 50) entities.current.splice(i, 1);
            }

            // --- Draw Player ---
            const playerScreenY = h - 100;
            const pX = getLaneCenterX(playerX.current, playerScreenY, w, h);
            const pSize = 50;

            ctx.beginPath();
            ctx.arc(pX, playerScreenY, pSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_PLAYER;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pX, playerScreenY, pSize * 0.3, 0, Math.PI * 2);
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
