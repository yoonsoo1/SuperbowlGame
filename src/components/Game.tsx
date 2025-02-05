import React, { useEffect, useRef, useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number;
  lane: number;
  image: HTMLImageElement;
}

interface Collision {
  x: number;
  y: number;
  timestamp: number;
}

interface TeamAssets {
  player: string;
  obstacles: string[];
}

const TEAMS: Record<string, TeamAssets> = {
  eagles: {
    player: '/eaglesPlayer.png',
    obstacles: ['/chiefs-def1.png', '/chiefs-def2.png', '/chiefs-def3.png']
  },
  chiefs: {
    player: '/chiefsPlayer.png',
    obstacles: ['/eagles-def1.png', '/eagles-def2.png', '/eagles-def3.png']
  }
};

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
const PLAYER_WIDTH = 37.5;
const PLAYER_HEIGHT = 37.5;
const OBSTACLE_WIDTH = GAME_WIDTH / 3 * 0.6;
const OBSTACLE_HEIGHT = 60;
const CLOUD_WIDTH = OBSTACLE_WIDTH * 1.5;
const CLOUD_HEIGHT = OBSTACLE_HEIGHT * 1.5;
const GRAVITY = 0.6;
const JUMP_FORCE = -7.5;
const LANE_COUNT = 3;
const LANE_WIDTH = GAME_WIDTH / 3;
const OBSTACLE_FALL_SPEED = 8;
const OBSTACLE_SPAWN_INTERVAL = 500;
const COLLISION_PAUSE_DURATION = 2000;
const STRIPE_HEIGHT = 20;
const STRIPE_SPEED = 3;

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [health, setHealth] = useState(3);
  const [gameTime, setGameTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const playerImageRef = useRef<HTMLImageElement | null>(null);
  const obstacleImagesRef = useRef<HTMLImageElement[]>([]);
  const cloudImageRef = useRef<HTMLImageElement | null>(null);
  const collisionRef = useRef<Collision | null>(null);
  const pausedUntilRef = useRef<number>(0);
  const backgroundOffsetRef = useRef(0);

  const gameStateRef = useRef({
    player: {
      lane: 1,
      x: LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2,
      y: GAME_HEIGHT - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityY: 0,
      isJumping: false,
      image: null as HTMLImageElement | null,
    },
    obstacles: [] as GameObject[],
    animationFrameId: 0,
    lastObstacleTime: 0,
  });

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Draw green background
    ctx.fillStyle = '#22c55e'; // Tailwind green-500
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw moving white stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let y = -STRIPE_HEIGHT + backgroundOffsetRef.current; y < GAME_HEIGHT; y += STRIPE_HEIGHT * 2) {
      ctx.fillRect(0, y, GAME_WIDTH, STRIPE_HEIGHT);
    }

    // Update background offset
    if (Date.now() >= pausedUntilRef.current) {
      backgroundOffsetRef.current = (backgroundOffsetRef.current + STRIPE_SPEED) % (STRIPE_HEIGHT * 2);
    }
  };

  const loadImages = async (team: string) => {
    // Load cloud image
    const cloudImage = new Image();
    cloudImage.src = '/cloud.png';
    await new Promise((resolve) => {
      cloudImage.onload = resolve;
    });
    cloudImageRef.current = cloudImage;

    // Load player image
    const playerImage = new Image();
    playerImage.src = TEAMS[team].player;
    await new Promise((resolve) => {
      playerImage.onload = resolve;
    });
    playerImageRef.current = playerImage;

    // Load obstacle images
    const obstacleImages = await Promise.all(
      TEAMS[team].obstacles.map((src) => {
        const img = new Image();
        img.src = src;
        return new Promise<HTMLImageElement>((resolve) => {
          img.onload = () => resolve(img);
        });
      })
    );
    obstacleImagesRef.current = obstacleImages;
  };

  const getLaneX = (lane: number) => {
    return lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (Date.now() < pausedUntilRef.current) return;
    
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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (Date.now() < pausedUntilRef.current) return;
    
    const { player } = gameStateRef.current;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    
    if (touch.clientY - rect.top > rect.height / 3 && touch.clientY - rect.top < (rect.height * 2) / 3) {
      if (!player.isJumping) {
        player.velocityY = JUMP_FORCE;
        player.isJumping = true;
      }
      return;
    }
    
    if (x < GAME_WIDTH / 3 && player.lane > 0) {
      player.lane--;
      player.x = getLaneX(player.lane);
    } else if (x > (GAME_WIDTH * 2) / 3 && player.lane < LANE_COUNT - 1) {
      player.lane++;
      player.x = getLaneX(player.lane);
    }
  };

  const handleMobileControl = (action: 'left' | 'right' | 'jump') => {
    if (Date.now() < pausedUntilRef.current) return;
    
    const { player } = gameStateRef.current;
    
    switch (action) {
      case 'jump':
        if (!player.isJumping) {
          player.velocityY = JUMP_FORCE;
          player.isJumping = true;
        }
        break;
      case 'left':
        if (player.lane > 0) {
          player.lane--;
          player.x = getLaneX(player.lane);
        }
        break;
      case 'right':
        if (player.lane < LANE_COUNT - 1) {
          player.lane++;
          player.x = getLaneX(player.lane);
        }
        break;
    }
  };

  const checkCollision = (player: typeof gameStateRef.current.player, obstacle: GameObject) => {
    if (player.isJumping) return false;
    const verticalOverlap = 
      player.y < obstacle.y + obstacle.height &&
      player.y + player.height > obstacle.y;
    const sameLane = player.lane === obstacle.lane;
    return verticalOverlap && sameLane;
  };

  const generateObstacles = (timestamp: number) => {
    if (timestamp - gameStateRef.current.lastObstacleTime > OBSTACLE_SPAWN_INTERVAL) {
      const numObstacles = Math.min(3, Math.floor(Math.random() * 3) + 1);
      const usedLanes = new Set<number>();

      for (let i = 0; i < numObstacles; i++) {
        let lane;
        do {
          lane = Math.floor(Math.random() * LANE_COUNT);
        } while (usedLanes.has(lane));
        
        usedLanes.add(lane);
        
        const randomObstacleImage = obstacleImagesRef.current[
          Math.floor(Math.random() * obstacleImagesRef.current.length)
        ];
        
        gameStateRef.current.obstacles.push({
          lane,
          x: getLaneX(lane),
          y: -OBSTACLE_HEIGHT,
          width: OBSTACLE_WIDTH,
          height: OBSTACLE_HEIGHT,
          speed: OBSTACLE_FALL_SPEED + (gameTime / 60),
          image: randomObstacleImage,
        });
      }
      
      gameStateRef.current.lastObstacleTime = timestamp;
    }
  };

  const gameLoop = (timestamp: number) => {
    if (!canvasRef.current || gameOver) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { player, obstacles } = gameStateRef.current;
    const now = Date.now();

    // Draw background first
    drawBackground(ctx);

    // Draw lane dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, 0);
      ctx.lineTo(i * LANE_WIDTH, GAME_HEIGHT);
      ctx.stroke();
    }

    if (now >= pausedUntilRef.current) {
      player.velocityY += GRAVITY;
      player.y += player.velocityY;

      if (player.y > GAME_HEIGHT - PLAYER_HEIGHT) {
        player.y = GAME_HEIGHT - PLAYER_HEIGHT;
        player.velocityY = 0;
        player.isJumping = false;
      }

      generateObstacles(timestamp);

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.y += obstacle.speed || OBSTACLE_FALL_SPEED;

        if (obstacle.y > GAME_HEIGHT) {
          obstacles.splice(i, 1);
          continue;
        }

        if (checkCollision(player, obstacle)) {
          collisionRef.current = {
            x: obstacle.x - (CLOUD_WIDTH - OBSTACLE_WIDTH) / 2,
            y: obstacle.y - (CLOUD_HEIGHT - OBSTACLE_HEIGHT) / 2,
            timestamp: now
          };
          pausedUntilRef.current = now + COLLISION_PAUSE_DURATION;
          
          setHealth(prev => {
            if (prev <= 1) {
              setGameOver(true);
              return 0;
            }
            obstacles.splice(i, 1);
            return prev - 1;
          });
          continue;
        }

        ctx.drawImage(
          obstacle.image,
          obstacle.x,
          obstacle.y,
          obstacle.width,
          obstacle.height
        );
      }
    } else {
      obstacles.forEach(obstacle => {
        ctx.drawImage(
          obstacle.image,
          obstacle.x,
          obstacle.y,
          obstacle.width,
          obstacle.height
        );
      });
    }

    if (playerImageRef.current) {
      ctx.drawImage(
        playerImageRef.current,
        player.x,
        player.y,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      );
    }

    if (collisionRef.current && cloudImageRef.current && now < pausedUntilRef.current) {
      ctx.drawImage(
        cloudImageRef.current,
        collisionRef.current.x,
        collisionRef.current.y,
        CLOUD_WIDTH,
        CLOUD_HEIGHT
      );
    }

    if (now >= pausedUntilRef.current) {
      setGameTime(prev => prev + 1/60);
    }

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

  const handleTeamSelect = async (team: string) => {
    await loadImages(team);
    setSelectedTeam(team);
    startGame();
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setHealth(3);
    setGameTime(0);
    collisionRef.current = null;
    pausedUntilRef.current = 0;
    backgroundOffsetRef.current = 0;
    gameStateRef.current = {
      player: {
        lane: 1,
        x: getLaneX(1),
        y: GAME_HEIGHT - PLAYER_HEIGHT,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        velocityY: 0,
        isJumping: false,
        image: playerImageRef.current,
      },
      obstacles: [],
      animationFrameId: 0,
      lastObstacleTime: 0,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-gray-900 px-2 py-4">
      <div className="bg-gray-800 p-3 rounded-lg shadow-xl w-full max-w-[300px]">
        {!selectedTeam ? (
          <div className="flex flex-col gap-4 p-4">
            <h2 className="text-white text-xl font-bold text-center mb-4">Choose Your Team</h2>
            <button
              onClick={() => handleTeamSelect('eagles')}
              className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-lg text-lg"
            >
              Eagles
            </button>
            <button
              onClick={() => handleTeamSelect('chiefs')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
            >
              Chiefs
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-1">
                {[...Array(health)].map((_, i) => (
                  <Heart key={i} className="w-4 h-4 text-red-500 fill-red-500" />
                ))}
              </div>
              <div className="text-white font-mono text-xs">
                Time: {gameTime.toFixed(1)}s
              </div>
            </div>
            
            <canvas
              ref={canvasRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              className="bg-gray-700 rounded-lg touch-none w-full"
              onTouchStart={handleTouchStart}
            />

            {/* Mobile Controls */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                onClick={() => handleMobileControl('left')}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white p-3 rounded-lg flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleMobileControl('jump')}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white p-3 rounded-lg flex items-center justify-center"
              >
                <ArrowUp className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleMobileControl('right')}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white p-3 rounded-lg flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {gameOver && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => handleTeamSelect(selectedTeam)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1.5 px-3 rounded text-sm"
                >
                  Play Again
                </button>
                <p className="text-white mt-1 text-xs">
                  Final Score: {gameTime.toFixed(1)} seconds
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};