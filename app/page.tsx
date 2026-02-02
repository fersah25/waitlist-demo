"use client";
import { useState, useEffect, useRef } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import styles from "./page.module.css";

export default function PacmanGame() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Oyun Değişkenleri
  const player = useRef({ x: 20, y: 20, size: 20, speed: 4, dx: 0, dy: 0 });
  const dots = useRef<{ x: number; y: number }[]>([]);
  const enemy = useRef({ x: 250, y: 250, size: 20, speed: 2 });

  useEffect(() => {
    if (!isFrameReady) setFrameReady();

    // Noktaları oluştur
    const newDots = [];
    for (let i = 0; i < 15; i++) {
      newDots.push({
        x: Math.random() * 280 + 10,
        y: Math.random() * 280 + 10,
      });
    }
    dots.current = newDots;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gameLoop = () => {
      if (gameOver) return;
      if (!ctx) return;

      // Temizle
      ctx.clearRect(0, 0, 300, 300);

      // Oyuncuyu Hareket Ettir
      player.current.x += player.current.dx;
      player.current.y += player.current.dy;

      // Duvar Kontrolü
      if (player.current.x < 0) player.current.x = 0;
      if (player.current.x > 280) player.current.x = 280;
      if (player.current.y < 0) player.current.y = 0;
      if (player.current.y > 280) player.current.y = 280;

      // Düşman Hareketi (Seni takip eder)
      if (enemy.current.x < player.current.x) enemy.current.x += enemy.current.speed;
      else enemy.current.x -= enemy.current.speed;
      if (enemy.current.y < player.current.y) enemy.current.y += enemy.current.speed;
      else enemy.current.y -= enemy.current.speed;

      // Çizim: Oyuncu (Sarı)
      ctx.fillStyle = "#f7d954";
      ctx.beginPath();
      ctx.arc(player.current.x + 10, player.current.y + 10, 10, 0.2 * Math.PI, 1.8 * Math.PI);
      ctx.lineTo(player.current.x + 10, player.current.y + 10);
      ctx.fill();

      // Çizim: Düşman (Kırmızı)
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(enemy.current.x, enemy.current.y, 20, 20);

      // Çizim: Noktalar (Mavi - Base Rengi)
      ctx.fillStyle = "#0052FF";
      dots.current.forEach((dot, index) => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Nokta toplama kontrolü
        const dist = Math.hypot(player.current.x - dot.x, player.current.y - dot.y);
        if (dist < 15) {
          dots.current.splice(index, 1);
          setScore((s) => s + 10);
        }
      });

      // Çarpışma Kontrolü (Game Over)
      const enemyDist = Math.hypot(player.current.x - enemy.current.x, player.current.y - enemy.current.y);
      if (enemyDist < 15) {
          setGameOver(true);
      }

      requestAnimationFrame(gameLoop);
    };

    const interval = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(interval);
  }, [gameOver]);

  const move = (dir: string) => {
    const s = player.current.speed;
    if (dir === "UP") { player.current.dx = 0; player.current.dy = -s; }
    if (dir === "DOWN") { player.current.dx = 0; player.current.dy = s; }
    if (dir === "LEFT") { player.current.dx = -s; player.current.dy = 0; }
    if (dir === "RIGHT") { player.current.dx = s; player.current.dy = 0; }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>BASE-MAN</h1>
      <div className={styles.scoreDisplay}>Score: {score}</div>
      
      <div className={styles.gameBoard}>
        {gameOver ? (
          <div className={styles.gameOver}>
            <h2>GAME OVER!</h2>
            <button onClick={() => window.location.reload()} className={styles.joinButton}>RESTART</button>
          </div>
        ) : (
          <canvas ref={canvasRef} width={300} height={300} className={styles.canvas} />
        )}
      </div>

      {/* Kontrol Butonları */}
      <div className={styles.controls}>
        <button onClick={() => move("UP")} className={styles.ctrlBtn}>UP</button>
        <div className={styles.row}>
          <button onClick={() => move("LEFT")} className={styles.ctrlBtn}>LEFT</button>
          <button onClick={() => move("DOWN")} className={styles.ctrlBtn}>DOWN</button>
          <button onClick={() => move("RIGHT")} className={styles.ctrlBtn}>RIGHT</button>
        </div>
      </div>
    </div>
  );
}