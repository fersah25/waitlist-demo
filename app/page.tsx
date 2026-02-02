"use client";
import { useState, useEffect, useRef } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import styles from "./page.module.css";

export default function BaseJump() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Oyun Değişkenleri
  const gameState = useRef({
    player: { x: 150, y: 250, width: 30, height: 30, dy: 0, jumpPower: -8, gravity: 0.3 },
    platforms: [] as { x: number; y: number; width: number; height: number }[],
    cameraY: 0
  });

  useEffect(() => {
    if (!isFrameReady) setFrameReady();

    // İlk platformları oluştur
    const initialPlatforms = [];
    for (let i = 0; i < 7; i++) {
      initialPlatforms.push({
        x: Math.random() * 250,
        y: i * 80,
        width: 60,
        height: 10
      });
    }
    gameState.current.platforms = initialPlatforms;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gameLoop = () => {
      if (gameOver || !ctx) return;

      const { player, platforms } = gameState.current;

      // Fizik Uygula
      player.dy += player.gravity;
      player.y += player.dy;

      // Platform Çarpışma Kontrolü (Sadece aşağı düşerken)
      if (player.dy > 0) {
        platforms.forEach(plat => {
          if (
            player.x < plat.x + plat.width &&
            player.x + player.width > plat.x &&
            player.y + player.height > plat.y &&
            player.y + player.height < plat.y + plat.height + 10
          ) {
            player.dy = player.jumpPower;
          }
        });
      }

      // Kamera ve Skor Takibi
      if (player.y < 200) {
        const diff = 200 - player.y;
        player.y = 200;
        platforms.forEach(plat => {
          plat.y += diff;
          if (plat.y > 500) {
            plat.y = 0;
            plat.x = Math.random() * 250;
            setScore(s => s + 1);
          }
        });
      }

      // Game Over Kontrolü
      if (player.y > 500) setGameOver(true);

      // Çizim
      ctx.clearRect(0, 0, 300, 500);

      // Oyuncu (Base Logosu gibi Mavi Kare)
      ctx.fillStyle = "#0052FF";
      ctx.fillRect(player.x, player.y, player.width, player.height);

      // Platformlar
      ctx.fillStyle = "#f7d954";
      platforms.forEach(plat => {
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      });

      requestAnimationFrame(gameLoop);
    };

    const interval = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(interval);
  }, [gameOver]);

  const move = (dir: number) => {
    gameState.current.player.x += dir;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>BASE JUMP</h1>
      <div className={styles.scoreDisplay}>Height: {score}m</div>
      
      <div className={styles.gameBoard}>
        {gameOver ? (
          <div className={styles.gameOver}>
            <h2>CRASHED!</h2>
            <button onClick={() => window.location.reload()} className={styles.joinButton}>TRY AGAIN</button>
          </div>
        ) : (
          <canvas ref={canvasRef} width={300} height={500} className={styles.canvas} />
        )}
      </div>

      <div className={styles.controls}>
        <button onTouchStart={() => move(-30)} onClick={() => move(-30)} className={styles.ctrlBtn}>LEFT</button>
        <button onTouchStart={() => move(30)} onClick={() => move(30)} className={styles.ctrlBtn}>RIGHT</button>
      </div>
    </div>
  );
}