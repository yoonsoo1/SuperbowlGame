import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number;
  lane: number;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const GRAVITY = 0.6;
const JUMP_FORCE = -15;
const LANE_COUNT = 3;
const LANE_WIDTH = GAME_WIDTH / 3;
const OBSTACLE_FALL_SPEED = 4;

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [health, setHealth] = useState(3);
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const gameStateRef = useRef({
    player: {
      lane: 1,
      x: LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2,
      y: GAME_HEIGHT - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityY: 0,
      isJumping: false,
    },
    obstacles: [] as GameObject[],
    animationFrameId: 0,
    lastObstacleTime: 0,
  });

  const getLaneX = (lane: number) => {
    return lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const { player } = gameStateRef.current;
    
    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
        if (!player.isJumping) {
          player.velocityY = JUMP_FORCE;
          player.isJumping = true;
        }
        break;
      case 'ArrowLeft':
        if (player.lane > 0) {
          player.lane--;
          player.x = getLaneX(player.lane);
        }
        break;
      case 'ArrowRight':
        if (player.lane < LANE_COUNT - 1) {
          player.lane++;
          player.x = getLaneX(player.lane);
        }
        break;
    }
  };

  const getPlayerColor = (player: GameObject & { isJumping: boolean; velocityY: number }) => {
    if (player.isJumping) {
      const maxJumpHeight = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY);
      const currentHeight = GAME_HEIGHT - PLAYER_HEIGHT - player.y;
      const jumpPercent = Math.min(Math.max(currentHeight / maxJumpHeight, 0), 1);
      
      const r = Math.floor(59 + (72 - 59) * jumpPercent);
      const g = Math.floor(130 + (217 - 130) * jumpPercent);
      const b = Math.floor(246 + (247 - 246) * jumpPercent);
      
      return `rgb(${r}, ${g}, ${b})`;
    }
    return '#3b82f6';
  };

  const checkCollision = (player: typeof gameStateRef.current.player, obstacle: GameObject) => {
    // Only check collision if player is not jumping
    if (player.isJumping) return false;

    // Check vertical overlap
    const verticalOverlap = 
      player.y < obstacle.y + obstacle.height &&
      player.y + player.height > obstacle.y;

    // Check if in same lane
    const sameLane = player.lane === obstacle.lane;

    return verticalOverlap && sameLane;
  };

  const gameLoop = (timestamp: number) => {
    if (!canvasRef.current || gameOver) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { player, obstacles } = gameStateRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw lane dividers
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, 0);
      ctx.lineTo(i * LANE_WIDTH, GAME_HEIGHT);
      ctx.stroke();
    }

    // Update player
    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    // Ground collision
    if (player.y > GAME_HEIGHT - PLAYER_HEIGHT) {
      player.y = GAME_HEIGHT - PLAYER_HEIGHT;
      player.velocityY = 0;
      player.isJumping = false;
    }

    // Generate obstacles
    if (timestamp - gameStateRef.current.lastObstacleTime > 1000) {
      const numObstacles = Math.floor(Math.random() * 2) + 1;
      const usedLanes = new Set<number>();

      for (let i = 0; i < numObstacles; i++) {
        let lane;
        do {
          lane = Math.floor(Math.random() * LANE_COUNT);
        } while (usedLanes.has(lane));
        
        usedLanes.add(lane);
        
        obstacles.push({
          lane,
          x: getLaneX(lane),
          y: -40,
          width: LANE_WIDTH * 0.4,
          height: 40,
          speed: OBSTACLE_FALL_SPEED + (gameTime / 60),
        });
      }
      
      gameStateRef.current.lastObstacleTime = timestamp;
    }

    // Update and draw obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.y += obstacle.speed || OBSTACLE_FALL_SPEED;

      // Remove off-screen obstacles
      if (obstacle.y > GAME_HEIGHT) {
        obstacles.splice(i, 1);
        continue;
      }

      // Check collision
      if (checkCollision(player, obstacle)) {
        setHealth(prev => {
          if (prev <= 1) {
            setGameOver(true);
            return 0;
          }
          obstacles.splice(i, 1);
          return prev - 1;
        });
      }

      // Draw obstacle
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    // Draw player with color gradient based on jump state
    ctx.fillStyle = getPlayerColor(player);
    ctx.fillRect(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT);

    // Update game time
    setGameTime(prev => prev + 1/60);

    gameStateRef.current.animationFrameId = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameStarted && !gameOver) {
      window.addEventListener('keydown', handleKeyDown);
      gameStateRef.current.animationFrameId = requestAnimationFrame(gameLoop);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        cancelAnimationFrame(gameStateRef.current.animationFrameId);
      };
    }
  }, [gameStarted, gameOver]);

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setHealth(3);
    setGameTime(0);
    gameStateRef.current = {
      player: {
        lane: 1,
        x: getLaneX(1),
        y: GAME_HEIGHT - PLAYER_HEIGHT,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        velocityY: 0,
        isJumping: false,
      },
      obstacles: [],
      animationFrameId: 0,
      lastObstacleTime: 0,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            {[...Array(health)].map((_, i) => (
              <Heart key={i} className="w-6 h-6 text-red-500 fill-red-500" />
            ))}
          </div>
          <div className="text-white font-mono">
            Time: {gameTime.toFixed(1)}s
          </div>
        </div>
        
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="bg-gray-700 rounded-lg"
        />

        {!gameStarted || gameOver ? (
          <div className="mt-4 text-center">
            <button
              onClick={startGame}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              {gameOver ? 'Play Again' : 'Start Game'}
            </button>
            {gameOver && (
              <p className="text-white mt-2">
                Final Score: {gameTime.toFixed(1)} seconds
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 text-white text-center">
            <p>Use ↑ or Space to jump, ← → to switch lanes</p>
          </div>
        )}
      </div>
    </div>
  );
};