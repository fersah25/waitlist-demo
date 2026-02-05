"use client";
import React, { useRef, useEffect, useState } from "react";
import sdk from '@farcaster/frame-sdk';
import styles from "../page.module.css";

interface Point {
    x: number;
    y: number;
    life: number; // For trail fading
}

interface Orb {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    isSliced: boolean;
}

export default function BaseNinja() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [gameOver] = useState(false);
    // Game State Refs (to avoid closures in animation loop)
    const orbs = useRef<Orb[]>([]);
    const trail = useRef<Point[]>([]);
    const scoreRef = useRef(0);
    const lastTime = useRef(0);
    const spawnTimer = useRef(0);
    const isPointerDown = useRef(false);

    // Initial Setup & Resize
    useEffect(() => {
        if (sdk && sdk.actions) {
            sdk.actions.ready();
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        return () => window.removeEventListener('resize', resize);
    }, []);

    // Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const spawnOrb = () => {
            const radius = 30;
            const x = Math.random() * (canvas.width - radius * 2) + radius;
            const y = canvas.height + radius;
            // Launch upwards with slight random angle
            const vx = (Math.random() - 0.5) * 4;
            const vy = -(Math.random() * 10 + 10); // Vertical launch speed

            orbs.current.push({
                id: Date.now() + Math.random(),
                x,
                y,
                vx,
                vy,
                radius,
                color: '#0052FF', // Base Blue
                isSliced: false
            });
        };

        const update = (time: number) => {
            if (gameOver) return;

            const deltaTime = time - lastTime.current;
            lastTime.current = time;

            // Spawning
            spawnTimer.current += deltaTime;
            if (spawnTimer.current > 800) { // Spawn every 800ms
                spawnOrb();
                spawnTimer.current = 0;
            }

            // Physics & Logic
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update Orbs
            for (let i = orbs.current.length - 1; i >= 0; i--) {
                const orb = orbs.current[i];

                // Gravity
                orb.vy += 0.2;
                orb.x += orb.vx;
                orb.y += orb.vy;

                // Remove falling off screen
                if (orb.y > canvas.height + 100) {
                    orbs.current.splice(i, 1);
                    continue;
                }

                // Draw Orb
                if (!orb.isSliced) {
                    ctx.beginPath();
                    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
                    ctx.fillStyle = orb.color;
                    ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = 'white';
                    ctx.stroke();
                    ctx.closePath();

                    // logo decoration
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(orb.x, orb.y, orb.radius * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Sliced effect (simple explosion/fade for now)
                    ctx.beginPath();
                    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 82, 255, 0.)`;
                    ctx.fill();
                }
            }

            // Update Trail
            if (isPointerDown.current) {
                // Decay trail
                for (let i = trail.current.length - 1; i >= 0; i--) {
                    trail.current[i].life -= 0.1;
                    if (trail.current[i].life <= 0) {
                        trail.current.splice(i, 1);
                    }
                }

                // Draw Trail
                if (trail.current.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(trail.current[0].x, trail.current[0].y);
                    for (let i = 1; i < trail.current.length; i++) {
                        ctx.lineTo(trail.current[i].x, trail.current[i].y);
                    }
                    ctx.strokeStyle = 'cyan';
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'cyan';
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Check Collisions
                const lastPoint = trail.current[trail.current.length - 1];
                if (lastPoint) {
                    orbs.current.forEach(orb => {
                        if (!orb.isSliced) {
                            const dx = lastPoint.x - orb.x;
                            const dy = lastPoint.y - orb.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < orb.radius) {
                                orb.isSliced = true;
                                scoreRef.current += 1;
                                setScore(scoreRef.current);
                            }
                        }
                    });
                }
            } else {
                trail.current = [];
            }

            animationFrameId = requestAnimationFrame(update);
        };

        animationFrameId = requestAnimationFrame(update);

        return () => cancelAnimationFrame(animationFrameId);
    }, [gameOver]);

    // Input Handlers
    const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
        isPointerDown.current = true;
        addPoint(e);
    };

    const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isPointerDown.current) return;
        addPoint(e);
    };

    const handleEnd = () => {
        isPointerDown.current = false;
        trail.current = [];
    };

    const addPoint = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        trail.current.push({
            x: clientX,
            y: clientY,
            life: 1.0
        });
    };

    return (
        <div className={styles.container} style={{ overflow: 'hidden', touchAction: 'none' }}>
            <div className={styles.gameHeader} style={{ position: 'absolute', top: 20, zIndex: 10, textAlign: 'center', width: '100%' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 800, textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>{score}</h1>
                <p>Slice the Base Orbs!</p>
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
        </div>
    );
}
