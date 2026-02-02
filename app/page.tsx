"use client";
import { useState, useEffect, useRef } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import styles from "./page.module.css";

// TypeScript için platform yapısını tanımlıyoruz (Hata vermemesi için şart)
interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  isRamp: boolean;
}

export default function BaseJump() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [color, setColor] = useState("#0052FF");

  const game = useRef({
    player: { x: 135, y: 350, w: 30, h: 30, dy: 0 },
    platforms: [] as Platform[],
    gravity: 0.35,
    jump: -10,
    rampJump: -20,
    isInitial: true
  });

  const colors = ["#0052FF", "#f7d954", "#ff4d4d", "#00ff88", "#ff00ff"];

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    if (gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (game.current.isInitial) {
      const initialPlatforms: Platform[] = [];
      for (let i = 0; i < 7; i++) {
        initialPlatforms.push({
          x: Math.random() * 240,
          y: i * 70 + 50,
          w: 60,
          h: 10,
          isRamp: Math.random() > 0.85
        });
      }
      game.current.platforms = initialPlatforms;
      game.current.isInitial = false;
    }

    let animationId: number;

    const update = () => {
      const g = game.current;
      const p = g.player;

      p.dy += g.gravity;
      p.y += p.dy;

      if (p.dy > 0) {
        g.platforms.forEach(plat => {
          if (
            p.x < plat.x + plat.w &&
            p.x + p.w > plat.x &&
            p.y + p.h > plat.y &&
            p.y + p.h < plat.y + plat.h + 10
          ) {
            p.dy = plat.isRamp ? g.rampJump : g.jump;
            p.y = plat.y - p.h;
            setColor(colors[Math.floor(Math.random() * colors.length)]);
          }
        });
      }

      if (p.y < 200) {
        const offset = 200 - p.y;
        p.y = 200;
        g.platforms.forEach(plat => {
          plat.y += offset;
          if (plat.y > 450) {
            plat.y = 0;
            plat.x = Math.random() * 240;
            plat.isRamp = Math.random() > 0.85;
            setScore(s => s + 1);
          }
        });
      }

      if (p.y > 450) {
        if (lives > 1) {
          setLives(l => l - 1);
          p.y = 150;
          p.dy = 0;
        } else {
          setLives(0);
          setGameOver(true);
        }
      }

      ctx.clearRect(0, 0, 300, 450);

      g.platforms.forEach(plat => {
        ctx.fillStyle = plat.isRamp ? "#ff00ff" : "#f7d954";
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        if (plat.isRamp) {
          ctx.fillStyle = "white";
          ctx.fillRect(plat.x + 10, plat.y - 2, plat.w - 20, 3);
        }
      });

      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      animationId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, lives, color]);

  const move = (dir: "L" | "R") => {
    const p = game.current.player;
    if (dir === "L") p.x = Math.max(0, p.x - 40);
    if (dir === "R") p.x = Math.min(270, p.x + 40);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>BASE JUMP PRO</h1>
      <div className={styles.statsRow}>
        <div className={styles.statBox}>Score: {score}</div>
        <div className={styles.statBox}>Lives: {"❤️".repeat(lives)}</div>
      </div>
      
      <div className={styles.gameBoard}>
        {gameOver ? (
          <div className={styles.gameOver}>
            <h2>GAME OVER</h2>
            <button onClick={() => window.location.reload()} className={styles.joinButton}>REPLAY</button>
          </div>
        ) : (
          <canvas ref={canvasRef} width={300} height={450} className={styles.canvas} />
        )}
      </div>

      <div className={styles.controls}>
        <button onTouchStart={() => move("L")} onClick={() => move("L")} className={styles.ctrlBtn}>LEFT</button>
        <button onTouchStart={() => move("R")} onClick={() => move("R")} className={styles.ctrlBtn}>RIGHT</button>
      </div>
    </div>
  );
}