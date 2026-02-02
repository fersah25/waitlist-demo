"use client";
import { useState, useEffect, useRef } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import styles from "./page.module.css";

export default function BaseJump() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [boxColor, setBoxColor] = useState("#0052FF");

  const gameState = useRef({
    player: { x: 150, y: 250, width: 30, height: 30, dy: 0, jumpPower: -8, gravity: 0.3 },
    platforms: [] as { x: number; y: number; width: number; height: number; isRamp?: boolean }[],
  });

  const getRandomColor = () => {
    const colors = ["#0052FF", "#f7d954", "#ff4d4d", "#00ff88", "#ff00ff", "#00ffff"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  useEffect(() => {
    if (!isFrameReady) setFrameReady();

    const generatePlatforms = () => {
      const p = [];
      for (let i = 0; i < 7; i++) {
        p.push({
          x: Math.random() * 240,
          y: i * 70,
          width: 60,
          height: 10,
          isRamp: Math.random() > 0.85 // %15 ihtimalle rampa
        });
      }
      return p;
    };

    gameState.current.platforms = generatePlatforms();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gameLoop = () => {
      if (gameOver || !ctx) return;
      const { player, platforms } = gameState.current;

      player.dy += player.gravity;
      player.y += player.dy;

      // Platform Çarpışma
      if (player.dy > 0) {
        platforms.forEach(plat => {
          if (
            player.x < plat.x + plat.width &&
            player.x + player.width > plat.x &&
            player.y + player.height > plat.y &&
            player.y + player.height < plat.y + plat.height + 10
          ) {
            player.dy = plat.isRamp ? -18 : player.jumpPower; // Rampa fırlatır
            setBoxColor(getRandomColor()); // Her zıplayışta renk değişir
          }
        });
      }

      // Kamera Kaydırma
      if (player.y < 200) {
        const diff = 200 - player.y;
        player.y = 200;
        platforms.forEach(plat => {
          plat.y += diff;
          if (plat.y > 450) {
            plat.y = 0;
            plat.x = Math.random() * 240;
            plat.isRamp = Math.random() > 0.85;
            setScore(s => s + 1);
          }
        });
      }

      // Can Sistemi
      if (player.y > 450) {
        if (lives > 1) {
          setLives(l => l - 1);
          player.y = 200;
          player.dy = 0;
        } else {
          setLives(0);
          setGameOver(true);
        }
      }

      // Çizim
      ctx.clearRect(0, 0, 300, 450);
      
      // Platformlar
      platforms.forEach(plat => {
        ctx.fillStyle = plat.isRamp ? "#ff00ff" : "#f7d954"; // Rampa morsa
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        if(plat.isRamp) {
           ctx.fillStyle = "white";
           ctx.fillRect(plat.x + 10, plat.y - 2, plat.width - 20, 2);
        }
      });

      // Oyuncu
      ctx.fillStyle = boxColor;
      ctx.shadowBlur = 15;
      ctx.shadowColor = boxColor;
      ctx.fillRect(player.x, player.y, player.width, player.height);
      ctx.shadowBlur = 0;

      requestAnimationFrame(gameLoop);
    };

    const anim = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(anim);
  }, [gameOver, lives, boxColor]);

  const move = (dir: number) => {
    gameState.current.player.x = Math.max(0, Math.min(270, gameState.current.player.x + dir));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>BASE JUMP PRO</h1>
      <div className={styles.statsRow}>
        <div className={styles.statBox}>Height: {score}m</div>
        <div className={styles.statBox}>Lives: {"❤️".repeat(lives)}</div>
      </div>
      
      <div className={styles.gameBoard}>
        {gameOver ? (
          <div className={styles.gameOver}>
            <h2>GAME OVER</h2>
            <p>Score: {score}m</p>
            <button onClick={() => window.location.reload()} className={styles.joinButton}>REPLAY</button>
          </div>
        ) : (
          <canvas ref={canvasRef} width={300} height={450} className={styles.canvas} />
        )}
      </div>

      <div className={styles.controls}>
        <button onTouchStart={() => move(-40)} onClick={() => move(-40)} className={styles.ctrlBtn}>LEFT</button>
        <button onTouchStart={() => move(40)} onClick={() => move(40)} className={styles.ctrlBtn}>RIGHT</button>
      </div>
    </div>
  );
}