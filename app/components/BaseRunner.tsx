"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import sdk from '@farcaster/frame-sdk';

export default function BaseRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');

    const playerLane = useRef(1);
    const playerX = useRef(0.5);
    const entities = useRef<any[]>([]);
    const lastTime = useRef(0);
    const speed = useRef(6);

    const getLaneCenterX = useCallback((lane: number) => (lane * 2 + 1) / 6, []);

    const restartGame = useCallback(() => {
        playerLane.current = 1;
        playerX.current = 0.5;
        speed.current = 6;
        entities.current = [];
        setScore(0);
        setGameState('playing');
        lastTime.current = performance.now();
    }, []);

    useEffect(() => {
        if (sdk?.actions?.ready) sdk.actions.ready();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') playerLane.current = Math.max(0, playerLane.current - 1);
            if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') playerLane.current = Math.min(2, playerLane.current + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;
        let spawnTimer = 0;

        // Resize handler - Ekran boyutuna göre canvası ayarlar
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        const loop = (time: number) => {
            if (gameState !== 'playing') return;
            const dt = time - lastTime.current;
            lastTime.current = time;

            speed.current = Math.min(18, speed.current + 0.001);
            spawnTimer += dt;
            if (spawnTimer > 1200) {
                entities.current.push({
                    id: Math.random(),
                    lane: Math.floor(Math.random() * 3),
                    z: 0,
                    type: Math.random() > 0.4 ? 'obstacle' : 'coin',
                    collected: false
                });
                spawnTimer = 0;
            }

            playerX.current += (getLaneCenterX(playerLane.current) - playerX.current) * 0.15;

            // 1. Arka Plan (Deep Space Gradient)
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#02020a');
            grad.addColorStop(1, '#080826');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const w = canvas.width;
            const h = canvas.height;
            const horizon = h * 0.4;

            // 2. Yol Çizgileri
            ctx.strokeStyle = '#00F0FF';
            ctx.lineWidth = 2;
            [0, 1, 2, 3].forEach(i => {
                const xBottom = (i / 3) * w;
                const xTop = w / 2 + (xBottom - w / 2) * 0.1;
                ctx.beginPath();
                ctx.moveTo(xTop, horizon);
                ctx.lineTo(xBottom, h);
                ctx.stroke();
            });

            // 3. Objeler (Kemerler ve Base Logoları)
            for (let i = entities.current.length - 1; i >= 0; i--) {
                const ent = entities.current[i];
                ent.z += speed.current * 0.6;
                const p = ent.z / 1000;

                if (p > 1) {
                    entities.current.splice(i, 1);
                    continue;
                }

                const size = (w * 0.22) * p;
                const xPos = (w / 2) + (getLaneCenterX(ent.lane) - 0.5) * w * p;
                const yPos = horizon + (h - horizon) * p;

                // Çarpışma Testi
                if (p > 0.8 && p < 0.9 && ent.lane === playerLane.current) {
                    if (ent.type === 'obstacle') {
                        setGameState('gameover');
                    } else if (!ent.collected) {
                        ent.collected = true;
                        setScore(s => s + 10);
                    }
                }

                if (ent.collected) continue;

                if (ent.type === 'obstacle') {
                    // NEON KEMER (Ref resmindeki gibi)
                    ctx.save();
                    ctx.strokeStyle = '#FF0420';
                    ctx.lineWidth = 4 + (p * 4);
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#FF0420';
                    ctx.beginPath();
                    ctx.moveTo(xPos - size / 2, yPos);
                    ctx.lineTo(xPos - size / 2, yPos - size);
                    ctx.lineTo(xPos + size / 2, yPos - size);
                    ctx.lineTo(xPos + size / 2, yPos);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    // BASE LOGO COIN
                    ctx.save();
                    ctx.fillStyle = '#0052FF';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#0052FF';
                    ctx.beginPath();
                    ctx.arc(xPos, yPos - size / 4, size / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(xPos, yPos - size / 4, size / 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // 4. Oyuncu (Senin karakterin)
            const pX = playerX.current * w;
            const pY = h * 0.85;
            ctx.save();
            ctx.fillStyle = '#0052FF';
            ctx.beginPath();
            ctx.arc(pX, pY, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [gameState, getLaneCenterX]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#02020a' }}>
            <div style={{
                position: 'absolute', top: 30, width: '100%', textAlign: 'center',
                color: 'white', fontSize: '2.5rem', fontWeight: 'bold', zIndex: 10,
                textShadow: '0 0 10px rgba(0,240,255,0.7)'
            }}>
                {score}
            </div>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            {gameState === 'gameover' && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <h1 style={{ color: '#FF0420', fontSize: '3rem', marginBottom: '20px' }}>CRASHED</h1>
                    <button
                        onClick={restartGame}
                        style={{
                            padding: '12px 40px', fontSize: '1.5rem', cursor: 'pointer',
                            background: '#0052FF', color: 'white', border: 'none', borderRadius: '30px',
                            boxShadow: '0 0 20px rgba(0,82,255,0.5)'
                        }}
                    >
                        RETRY
                    </button>
                </div>
            )}
        </div>
    );
}