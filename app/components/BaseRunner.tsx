"use client";
import React, { useRef, useEffect, useState } from "react";
import sdk from '@farcaster/frame-sdk';
// import styles from "../page.module.css"; // Removing CSS Module

// --- Constants ---
const LANE_COUNT = 3;
const BASE_SPEED = 5;
const MAX_SPEED = 15;
const SPEED_INC = 0.005;
const LANE_SWITCH_SPEED = 0.15; // Smoother
const GRAVITY = 0.6;
const JUMP_FORCE = -14; // Increased jump power slightly
const GROUND_Y = 0;

// Colors
const COLOR_BG = '#050510'; // Darker, bluish black
const COLOR_GRID = '#00F0FF';
const COLOR_PLAYER = '#0052FF';
const COLOR_OBSTACLE = '#FF0420';
const COLOR_COIN = '#FFD700'; // Gold for Coins
const COLOR_KRYPTON = '#1eff00'; // Kryptonite Green

interface Entity {
    id: number;
    lane: number; // 0, 1, 2
    y: number;
    type: 'obstacle' | 'coin';
    collected?: boolean;
    // content type for obstacles
    subType?: 'ground' | 'air';
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface FloatingText {
    id: number;
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

    // Logic Refs
    const playerLane = useRef(1); // Start Middle
    const playerX = useRef(1); // Visual X-lane coordinate (0.0 - 2.0)

    // Physics Refs
    const playerY = useRef(0); // Height from ground (0 is ground)
    const playerVy = useRef(0);
    const isDucking = useRef(false);

    const speed = useRef(BASE_SPEED);
    const scoreRef = useRef(0);
    const entities = useRef<Entity[]>([]);
    const particles = useRef<Particle[]>([]);
    const floatTexts = useRef<FloatingText[]>([]);

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

        // Dynamic Perspective (Warp Speed)
        // As speed increases, widen the FOV (increase convergence factor)
        // Base 0.1, max 0.3
        const speedRatio = (speed.current - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
        const convergence = 0.1 + Math.max(0, speedRatio) * 0.15;

        // Line top X (Vanishing point with convergence)
        const xTop = w / 2 + (xBottom - w / 2) * convergence;

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
        const typeRand = Math.random();

        let type: 'obstacle' | 'coin' = 'coin';
        let subType: 'ground' | 'air' | undefined = undefined;

        if (typeRand > 0.6) {
            type = 'obstacle';
            // 50% chance of High Obstacle (Laser) vs Low Obstacle (Box)
            subType = Math.random() > 0.5 ? 'air' : 'ground';
        }

        entities.current.push({
            id: Date.now() + Math.random(),
            lane,
            y: -100,
            type,
            subType
        });
    };

    const restartGame = () => {
        playerLane.current = 1;
        // playerX is now just the physical lane index lerped, we will use that for calculation
        // playerX is now just the physical lane index lerped
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
            if (k === 'arrowup' || k === 'w' || k === ' ') {
                if (playerY.current === 0) {
                    playerVy.current = JUMP_FORCE;
                }
            }
            if (k === 'arrowdown' || k === 's') {
                isDucking.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowdown' || k === 's') {
                isDucking.current = false;
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
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
            // Dynamic MAX_SPEED based on score
            // Every 500 points, increase cap by 2
            const scoreMilestone = Math.floor(scoreRef.current / 500);
            const dynamicMax = MAX_SPEED + (scoreMilestone * 2);

            speed.current = Math.min(dynamicMax, speed.current + SPEED_INC);
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

            // Physics
            if (playerY.current > 0 || playerVy.current !== 0) {
                playerY.current += playerVy.current;
                playerVy.current += GRAVITY;
                if (playerY.current > 0) {
                    playerY.current = 0;
                    playerVy.current = 0;
                }
            }
            // Cap height so we don't fly forever if gravity fails
            // (Negative Y is up in standard canvas? No, we will treat Y as height from ground, so +Y is up, need to invert for rendering)
            // Wait, we'll maintain playerY as positive UP. 
            if (playerY.current < -200) playerY.current = -200; // Cap ceiling 


            // Player Lane Interpolation
            playerX.current += (playerLane.current - playerX.current) * LANE_SWITCH_SPEED;

            // Clear
            ctx.fillStyle = COLOR_BG;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- Draw Visuals ---
            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.3;

            // Retro Sun / Glow
            const gradient = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 100);
            gradient.addColorStop(0, '#00F0FF00');
            gradient.addColorStop(0.5, '#00F0FF44'); // Glow color
            gradient.addColorStop(1, '#00F0FF00');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, horizon - 50, w, 150);

            // Neon Pillars (Scrolling Env)
            const pillarOffset = (Date.now() * speed.current * 0.2) % 200;
            ctx.fillStyle = '#111';
            ctx.shadowBlur = 0;
            // Draw simple vertical "buildings" on sides
            for (let i = -200; i < h; i += 150) {
                const py = i + pillarOffset;
                // Left
                if (py > horizon) {
                    const depth = (py - horizon) / (h - horizon);
                    const pW = 10 + 40 * depth;
                    const pX = getLineX(-1, py, w, h) - pW * 2;
                    ctx.fillStyle = `rgba(0, 40, 80, ${depth})`;
                    ctx.fillRect(pX, py, pW, 100 * depth);
                    // Right
                    const pXR = getLineX(LANE_COUNT + 1, py, w, h) + pW;
                    ctx.fillRect(pXR, py, pW, 100 * depth);
                }
            }


            // Grid Lines
            ctx.strokeStyle = COLOR_GRID;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_GRID;
            ctx.globalAlpha = 0.6; // Softer grid

            ctx.beginPath();
            for (let i = 0; i <= LANE_COUNT; i++) {
                const xBottom = getLineX(i, h, w, h);
                const xTop = getLineX(i, horizon, w, h);

                ctx.moveTo(xBottom, h);
                ctx.lineTo(xTop, horizon);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;

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

                const currentX = getLaneCenterX(ent.lane, ent.y, w, h);
                const size = 60 * scale;

                // Collision
                const playerScreenY = h - 100;
                // Since our playerY is "height from ground" (negative is UP in canvas coords? Wait.)
                // Let's define: playerVisualY = playerScreenY + playerY.current
                // playerY.current starts at 0 and goes NEGATIVE for jump? JUMP_FORCE = -12. Gravity = 0.6.
                // Yes, typically in Canvas Y+ is down. So Jump Force -12 means move UP. 
                // So (0 is ground), (-100 is air).

                const pVisualY = playerScreenY + playerY.current;

                // Hit Logic
                // Z-collision (Y-axis on screen)
                // If entity is within a certain depth range of the player
                const hitZone = 30; // Depth tolerance
                const inHitZone = Math.abs(ent.y - playerScreenY) < hitZone; // Check against GROUND Y for consistency of lane arrival

                if (inHitZone) {
                    // Check X alignment
                    const pX = getLaneCenterX(playerX.current, playerScreenY, w, h);
                    if (Math.abs(currentX - pX) < 40) {
                        let hit = false;

                        if (ent.type === 'coin') {
                            hit = true;
                        } else if (ent.type === 'obstacle') {
                            // Check Vertical Collision
                            // Box (Ground): Hits if player is low (playerY > -50 ?)
                            // We are using negative for UP. 
                            // So Box hits if playerY > -40 (close to 0).
                            // Laser (Air): Hits if player is High (standing). 
                            // Ducking check? Or just Height check?
                            // Laser is at height -60..-100?

                            if (ent.subType === 'ground') {
                                // Box: Jump to avoid.
                                // Player Safe if Y < -50
                                if (playerY.current > -50) hit = true;
                            } else {
                                // Laser: Duck to avoid.
                                // If ducking, hitbox is small.
                                // Simpler: Laser hits if NOT ducking.
                                if (!isDucking.current) hit = true;
                            }
                        }

                        if (hit) {
                            if (ent.type === 'obstacle') {
                                setGameState('gameover');
                            } else if (ent.type === 'coin' && !ent.collected) {
                                ent.collected = true;
                                scoreRef.current += 100; // Only give score here

                                // Spawn Effects
                                for (let k = 0; k < 5; k++) {
                                    particles.current.push({
                                        id: Math.random(),
                                        x: currentX, y: ent.y,
                                        vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                                        life: 1.0, color: '#FFD700'
                                    });
                                }
                                floatTexts.current.push({
                                    id: Math.random(),
                                    text: '+100', x: currentX, y: ent.y - 50,
                                    life: 1.0, opacity: 1.0
                                });
                            }
                        }
                    }
                }

                if (ent.collected) continue;

                // Draw Entity
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(currentX, ent.y + size / 2, size / 2, size / 4, 0, 0, Math.PI * 2);
                ctx.fill();

                if (ent.type === 'obstacle') {
                    if (ent.subType === 'ground') {
                        // Ground Box
                        ctx.fillStyle = COLOR_OBSTACLE;
                        ctx.fillRect(currentX - size / 2, ent.y - size, size, size);
                        ctx.shadowBlur = 0;
                        // Top face for 3D effect
                        ctx.fillStyle = '#ff5555';
                        ctx.fillRect(currentX - size / 2, ent.y - size - 10 * scale, size, 10 * scale);
                    } else {
                        // Air Laser
                        const laserH = 20 * scale;
                        const laserY = ent.y - 80 * scale;
                        ctx.fillStyle = '#ff00ff';
                        ctx.shadowColor = '#ff00ff';
                        ctx.shadowBlur = 20;
                        ctx.fillRect(currentX - size, laserY, size * 2, laserH);
                        ctx.shadowBlur = 0;
                        // Posts
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(currentX - size, laserY, 5 * scale, 100 * scale); // Left pole
                        ctx.fillRect(currentX + size - 5 * scale, laserY, 5 * scale, 100 * scale); // Right pole
                    }
                } else {
                    // Coin
                    ctx.beginPath();
                    // Bobbing
                    const bob = Math.sin(Date.now() * 0.01) * 10 * scale;
                    ctx.arc(currentX, ent.y - 30 * scale + bob, size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = COLOR_COIN;
                    ctx.fill();
                    ctx.shadowColor = COLOR_COIN;
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = '#fff'; // Ring
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;

                if (ent.y > h + 50) entities.current.splice(i, 1);
            }

            // --- Effects ---
            // Particles
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.05;
                if (p.life <= 0) { particles.current.splice(i, 1); continue; }

                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 4, 4);
                ctx.globalAlpha = 1.0;
            }
            // Floating Text
            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                const ft = floatTexts.current[i];
                ft.y -= 2;
                ft.life -= 0.02;
                if (ft.life <= 0) { floatTexts.current.splice(i, 1); continue; }

                ctx.globalAlpha = ft.life;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.globalAlpha = 1.0;
            }


            // --- Draw Player ---
            const playerScreenBaseY = h - 100;
            const pVisualY = playerScreenBaseY + playerY.current; // Negative Y is UP
            const pX = getLaneCenterX(playerX.current, playerScreenBaseY, w, h);

            // Squash/Stretch
            let sX = 50;
            let sY = 50;

            if (isDucking.current) {
                sY = 25; // Duck height
            } else if (playerY.current < 0) {
                // Jump stretch
                sX = 40; sY = 60;
            }

            // Shadow on ground
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.ellipse(pX, playerScreenBaseY + 25, 25, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // Player Body
            ctx.shadowColor = COLOR_PLAYER;
            ctx.shadowBlur = 20;
            ctx.fillStyle = COLOR_PLAYER;

            ctx.beginPath();
            // Draw rounded rect or circle?
            // Simple: Circle/Ellipse based on sX sY
            ctx.ellipse(pX, pVisualY, sX / 2, sY / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Inner Core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(pX, pVisualY, sX * 0.3, sY * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;



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
