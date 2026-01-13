'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import logoAgs from '@/assets/logoags.png';
import confetti from 'canvas-confetti';
import SlotMachine from './SlotMachine';
import { employees as defaultEmployees, PRIZES, type PrizeType, type Employee, type PrizeConfig } from '@/data/employees';
import { Settings, X, Save, RotateCcw, Maximize2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LuckyDrawProps {
  enableConfig?: boolean;
}

type Winner = Employee & { prize: PrizeType };

function readJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getSpinCountsFromWinners(nextWinners: Winner[]): Record<PrizeType, number> {
  const counts: Record<PrizeType, number> = {
    SPECIAL: 0,
    FIRST: 0,
    SECOND: 0,
    THIRD: 0,
  };

  for (const winner of nextWinners) {
    if (counts[winner.prize] !== undefined) counts[winner.prize] += 1;
  }

  return counts;
}

function BackgroundEffects() {
  const [stars, setStars] = useState<Array<{ id: number; top: number; left: number; duration: number; delay: number; size: number }>>([]);
  const [lines, setLines] = useState<Array<{ id: number; left: number; targetLeft: number; duration: number; delay: number; rotation: number }>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newStars = Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 5,
        size: Math.random() * 10 + 10
      }));
      setStars(newStars);

      const newLines = Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        targetLeft: Math.random() * 100 + (Math.random() * 20 - 10),
        duration: Math.random() * 4 + 4,
        delay: Math.random() * 5,
        rotation: Math.random() * 40 - 20
      }));
      setLines(newLines);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
       {/* Rotating Rays */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vmax] h-[150vmax] opacity-[0.03]">
         <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="w-full h-full bg-[repeating-conic-gradient(from_0deg,transparent_0deg,transparent_10deg,#ffffff_10deg,#ffffff_20deg)]"
            style={{ borderRadius: '50%' }}
         />
       </div>
       
       {/* Shooting Lines (Fireworks strands) */}
       {lines.map((line) => (
         <motion.div
           key={`line-${line.id}`}
           initial={{ 
             opacity: 0, 
             top: "120%",
             left: `${line.left}%`
           }}
           animate={{ 
             opacity: [0, 0.6, 0],
             top: "-20%",
             left: `${line.targetLeft}%` 
           }}
           transition={{
             duration: line.duration,
             repeat: Infinity,
             delay: line.delay,
             ease: "linear"
           }}
           className="absolute w-[2px] h-[150px] bg-gradient-to-t from-transparent via-yellow-200/30 to-transparent blur-[1px]"
           style={{ transform: `rotate(${line.rotation}deg)` }}
         />
       ))}

        {/* Floating Golden Stars */}
        {stars.map((star) => (
            <motion.div
                key={`star-${star.id}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0.5, 1.2, 0.5],
                    rotate: [0, 180, 360] 
                }}
                transition={{
                    duration: star.duration,
                    repeat: Infinity,
                    delay: star.delay,
                    ease: "easeInOut"
                }}
                className="absolute text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]"
                style={{
                    top: `${star.top}%`,
                    left: `${star.left}%`,
                }}
            >
                <Star size={star.size} fill="currentColor" />
            </motion.div>
        ))}
    </div>
  );
}

export default function LuckyDraw({ enableConfig = false }: LuckyDrawProps) {
  const initialWinners = readJsonFromStorage<Winner[]>('winners', []);

  const [employees, setEmployees] = useState<Employee[]>(() => readJsonFromStorage<Employee[]>('employees_data', defaultEmployees));
  const [prizesConfig, setPrizesConfig] = useState<PrizeConfig[]>(() => readJsonFromStorage<PrizeConfig[]>('prizesConfig', PRIZES));
  const [enableKeyboard, setEnableKeyboard] = useState(() => readJsonFromStorage<boolean>('enableKeyboard', true));
  const [showConfig, setShowConfig] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<PrizeType>('SPECIAL');
  const [spinSettings, setSpinSettings] = useState<{ stopMode: 'manual' | 'auto'; autoStopMs: number }>(() =>
    readJsonFromStorage<{ stopMode: 'manual' | 'auto'; autoStopMs: number }>('spinSettings', { stopMode: 'manual', autoStopMs: 3500 })
  );
  const [spinCounts, setSpinCounts] = useState<Record<PrizeType, number>>(() => getSpinCountsFromWinners(initialWinners));
  const [winners, setWinners] = useState<Winner[]>(initialWinners);
  const [currentWinner, setCurrentWinner] = useState<Employee | null>(null);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [targetNumber, setTargetNumber] = useState("000");
  
  const [showResult, setShowResult] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [showSelectedPrizeList, setShowSelectedPrizeList] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [uiScale, setUiScale] = useState(1);

  // Load config and state from localStorage on mount
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'employees_data' && e.newValue) {
        try {
            setEmployees(JSON.parse(e.newValue));
        } catch (error) {
            console.error('Failed to parse employees update', error);
        }
      }

      if (e.key === 'prizesConfig' && e.newValue) {
        try {
          setPrizesConfig(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to parse config update', error);
        }
      }

      if (e.key === 'enableKeyboard' && e.newValue) {
        try {
          setEnableKeyboard(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to parse keyboard config update', error);
        }
      }
      
      if (e.key === 'winners' && e.newValue) {
        try {
            const parsed = JSON.parse(e.newValue) as unknown;
            const nextWinners = Array.isArray(parsed) ? (parsed as Winner[]) : [];
            setWinners(nextWinners);
            
            // Recalculate spin counts
            setSpinCounts(getSpinCountsFromWinners(nextWinners));

            // Reset target number if winners cleared
            if (nextWinners.length === 0) {
                setTargetNumber("000");
                setStopRequested(false);
                setIsSpinning(false);
                if (autoStopTimeoutRef.current) {
                  window.clearTimeout(autoStopTimeoutRef.current);
                  autoStopTimeoutRef.current = null;
                }
            }
        } catch (error) {
            console.error('Failed to parse winners update', error);
        }
      }

      if (e.key === 'spinSettings' && e.newValue) {
        try {
          setSpinSettings(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Failed to parse spin settings update', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const stageEl = stageRef.current;
      if (!stageEl) return;

      const padding = 48;
      const availableWidth = Math.max(1, window.innerWidth - padding);
      const availableHeight = Math.max(1, window.innerHeight - padding);
      const stageWidth = stageEl.offsetWidth;
      const stageHeight = stageEl.offsetHeight;

      if (!stageWidth || !stageHeight) return;

      const nextScale = Math.min(availableWidth / stageWidth, availableHeight / stageHeight);
      setUiScale(Math.max(0.5, Math.min(2.5, nextScale)));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);


  const currentPrizeConfig = prizesConfig.find(p => p.id === selectedPrize) || prizesConfig[0];
  const remainingSpins = currentPrizeConfig.maxSpins - spinCounts[selectedPrize];

  const handleConfigSave = (newConfig: PrizeConfig[]) => {
    setPrizesConfig(newConfig);
    localStorage.setItem('prizesConfig', JSON.stringify(newConfig));
    localStorage.setItem('enableKeyboard', JSON.stringify(enableKeyboard));

    // Manually trigger storage event for current window (since storage event only fires on other windows)
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'prizesConfig',
        newValue: JSON.stringify(newConfig)
    }));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'enableKeyboard',
        newValue: JSON.stringify(enableKeyboard)
    }));
    setShowConfig(false);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    setIsSpinning(false);
    setStopRequested(false);
    setWinners([]);
    setSpinCounts({
      SPECIAL: 0,
      FIRST: 0,
      SECOND: 0,
      THIRD: 0,
    });
    setTargetNumber("000");
    
    // Update localStorage and trigger storage event for other tabs
    localStorage.setItem('winners', JSON.stringify([]));
    
    // Trigger storage event for current window
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'winners',
      newValue: JSON.stringify([])
    }));
    
    setShowResetConfirm(false);
  };

  const handleSpin = useCallback(() => {
    console.log("Handle spin clicked", { isSpinning, remainingSpins, selectedPrize, stopRequested });

    if (isSpinning) {
      if (spinSettings.stopMode !== 'manual') return;
      if (stopRequested) return;
      if (autoStopTimeoutRef.current) {
        window.clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      setStopRequested(true);
      return;
    }

    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (remainingSpins <= 0) {
      console.log("No remaining spins");
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
      return;
    }

    const candidates = employees.filter(emp => !winners.some(w => w.id === emp.id));
    
    if (candidates.length === 0) {
      console.log("No candidates left");
      alert("Đã hết nhân viên để quay thưởng!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const winner = candidates[randomIndex];
    
    console.log("Winner selected:", winner);
    
    setCurrentWinner(winner);
    setTargetNumber(winner.code);
    setStopRequested(false);
    setIsSpinning(true);
    setShowResult(false);

    if (spinSettings.stopMode === 'auto') {
      const ms = Math.max(1000, spinSettings.autoStopMs || 3500);
      autoStopTimeoutRef.current = window.setTimeout(() => {
        setStopRequested(true);
      }, ms);
    }
  }, [isSpinning, spinSettings, stopRequested, remainingSpins, selectedPrize, employees, winners]);

  const triggerConfetti = useCallback(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const intervalId = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        window.clearInterval(intervalId);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  }, []);

  const onSpinEnd = useCallback(() => {
    setIsSpinning(false);
    setStopRequested(false);
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    
    setSpinCounts(prev => ({
      ...prev,
      [selectedPrize]: prev[selectedPrize] + 1
    }));

    if (currentWinner) {
      setWinners(prev => {
        // Prevent duplicates
        if (prev.some(w => w.id === currentWinner.id)) return prev;
        
        const newWinners = [...prev, { ...currentWinner, prize: selectedPrize }];
        
        // Save to localStorage
        localStorage.setItem('winners', JSON.stringify(newWinners));
        // Trigger storage event for same window
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'winners',
            newValue: JSON.stringify(newWinners)
        }));
        
        return newWinners;
      });
    }

    triggerConfetti();
    
    // Play celebration sound
    const audio = new Audio('/sounds/celebration.mp3');
    audio.volume = 0.6;
    audio.play().catch(e => console.log('Audio play failed:', e));

    setShowResult(true);
    
    // Auto-close for all prizes
    setTimeout(() => {
      setShowResult(false);
    }, 4000);

  }, [currentWinner, selectedPrize, triggerConfetti]);

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if any modal/popup is open
      if (showConfig || showResetConfirm || showResult || showAllWinners || showSelectedPrizeList) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (!isSpinning) {
            const currentIndex = prizesConfig.findIndex(p => p.id === selectedPrize);
            if (currentIndex > 0) {
              setSelectedPrize(prizesConfig[currentIndex - 1].id);
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isSpinning) {
            const currentIndex = prizesConfig.findIndex(p => p.id === selectedPrize);
            if (currentIndex < prizesConfig.length - 1) {
              setSelectedPrize(prizesConfig[currentIndex + 1].id);
            }
          }
          break;
        case 'ArrowRight': // Next -> Spin
          e.preventDefault();
          if (!isSpinning && !stopRequested) {
            handleSpin();
          }
          break;
        case 'ArrowLeft': // Back -> Stop
          e.preventDefault();
          if (isSpinning && !stopRequested) {
            handleSpin();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfig, showResetConfirm, showResult, showAllWinners, showSelectedPrizeList, isSpinning, stopRequested, prizesConfig, selectedPrize, handleSpin, enableKeyboard]);

  return (
    <div className="relative min-h-screen w-full bg-[#004a9f] overflow-hidden">
      {/* Background Gradient & Clouds */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#004a9f] to-[#002855]" />
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/clouds.png')]" />
      <BackgroundEffects />
      <div className="absolute top-8 left-8 z-900">
        <Image src={logoAgs} alt="AGS" priority className="h-10 w-auto drop-shadow-lg" />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center px-6 py-6">
        <div className="origin-center" style={{ transform: `scale(${uiScale})` }}>
          <div ref={stageRef} className="w-[1400px] flex flex-col items-center justify-center">
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center mb-10"
            >
              <div className="grid grid-cols-12 items-center w-full mb-2 px-4">
                <div className="col-span-12 flex items-center justify-center gap-4">
                  <span className="text-4xl">✈️</span>
                  <h1 className="text-6xl font-bold text-white drop-shadow-lg tracking-wider font-sans uppercase">
                    LUCKY DRAW
                  </h1>
                  <span className="text-4xl">✈️</span>
                </div>
                <div className="col-span-3" />
              </div>
              <p className="text-blue-200 text-xl font-light tracking-widest uppercase mb-4">AGS YEAR-END PARTY</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full px-4 items-start">
              <div className="lg:col-span-3 w-full space-y-6">
                <div className="bg-[#002855]/80 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <h2 className="text-white text-lg font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="text-yellow-400">💎</span> Chọn Giải
                    </h2>
                    {enableConfig && (
                      <button
                        onClick={() => setShowConfig(true)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                      >
                        <Settings size={20} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {prizesConfig.map((prize) => (
                      <button
                        key={prize.id}
                        onClick={() => !isSpinning && setSelectedPrize(prize.id)}
                        className={cn(
                          "w-full text-left px-5 py-4 rounded-xl transition-all duration-300 flex justify-between items-center group relative overflow-hidden",
                          selectedPrize === prize.id
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg ring-2 ring-blue-400/50"
                            : "bg-white/5 text-blue-200 hover:bg-white/10 hover:pl-6"
                        )}
                        disabled={isSpinning}
                      >
                        <span className="relative z-10 font-bold">{prize.name}</span>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-md relative z-10",
                            selectedPrize === prize.id ? "bg-white/20 text-white" : "bg-black/20 text-blue-300"
                          )}
                          suppressHydrationWarning
                        >
                          {prize.maxSpins - spinCounts[prize.id]}/{prize.maxSpins}
                        </span>
                        {selectedPrize === prize.id && (
                          <motion.div
                            layoutId="active-glow"
                            className="absolute inset-0 bg-white/10"
                            transition={{ duration: 0.3 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 flex flex-col items-center pt-4 lg:pt-10">
                <div className="relative p-8 lg:p-12 bg-[#002855] rounded-[3rem] border-8 border-white/20 shadow-[0_0_50px_rgba(0,74,159,0.5)]">
                  <div className="absolute inset-x-0 -top-6 flex justify-center gap-8">
                    <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-pulse" />
                    <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-pulse delay-75" />
                    <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-pulse delay-150" />
                  </div>

                  <SlotMachine
                    targetNumber={targetNumber}
                    isSpinning={isSpinning}
                    stopRequested={stopRequested}
                    onSpinEnd={onSpinEnd}
                    className="scale-100 lg:scale-110"
                  />

                  <div className="absolute -bottom-10 inset-x-10 h-10 bg-black/20 blur-xl rounded-full" />
                </div>

                {!enableConfig && (
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(255,255,255,0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSpin}
                    disabled={spinSettings.stopMode === 'auto' ? (isSpinning || stopRequested) : stopRequested}
                    className={cn(
                      "mt-16 px-20 py-6 text-4xl font-bold tracking-[0.2em] rounded-full shadow-2xl transition-all uppercase relative overflow-hidden group",
                      stopRequested
                        ? "bg-gray-500 text-gray-300 cursor-not-allowed border-4 border-gray-600"
                        : isSpinning
                          ? (spinSettings.stopMode === 'manual'
                              ? "bg-gradient-to-b from-red-500 to-red-600 text-white border-4 border-red-300/50"
                              : "bg-gradient-to-b from-blue-500 to-blue-600 text-white border-4 border-blue-300/50")
                          : "bg-gradient-to-b from-white to-blue-50 text-[#004a9f] border-4 border-white"
                    )}
                  >
                    <span className="relative z-10">
                      {stopRequested ? 'ĐANG DỪNG...' : isSpinning ? (spinSettings.stopMode === 'manual' ? 'DỪNG' : 'ĐANG QUAY...') : 'QUAY'}
                    </span>
                    {!isSpinning && !stopRequested && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    )}
                  </motion.button>
                )}
              </div>

              <div className="lg:col-span-3 w-full">
                <div className="bg-[#002855]/80 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col h-[600px]">
                  <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                    <h2 className="text-white text-lg font-bold uppercase tracking-widest flex items-center gap-2">
                      <span className="text-yellow-400">🏆</span> Vinh danh
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowSelectedPrizeList(true)}
                        className="p-1.5 bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-300 rounded-lg transition-all border border-blue-500/30"
                        title="Mở rộng"
                      >
                        <Maximize2 size={14} />
                      </button>
                      <button
                        onClick={() => setShowAllWinners(true)}
                        className="text-[10px] uppercase font-bold bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-300 px-3 py-1.5 rounded-lg transition-all border border-blue-500/30"
                      >
                        Tất Cả
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {winners.filter(w => w.prize === selectedPrize).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-blue-300/50 space-y-2">
                        <span className="text-4xl opacity-50">🎲</span>
                        <p className="text-sm italic">Chưa có kết quả giải này</p>
                      </div>
                    ) : (
                      winners.filter(w => w.prize === selectedPrize).reverse().map((winner, index, arr) => (
                        <motion.div
                          key={`${winner.id}-${index}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white/5 p-4 rounded-xl flex justify-between items-center group hover:bg-white/10 transition-all border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-lg",
                                winner.prize === 'SPECIAL'
                                  ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                                  : "bg-gradient-to-br from-blue-400 to-blue-600"
                              )}
                            >
                              #{arr.length - index}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm group-hover:text-blue-200 transition-colors">
                                {winner.name}
                              </div>
                              <div className="text-[10px] text-blue-300/80 uppercase tracking-wider">
                                {PRIZES.find(p => p.id === winner.prize)?.name}
                              </div>
                            </div>
                          </div>
                          <div className="font-mono font-bold text-yellow-400 text-lg drop-shadow-sm">{winner.code}</div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Popup */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl border-2 border-red-500 shadow-2xl text-center relative overflow-hidden">
              <h3 className="text-3xl font-bold text-red-600 mb-2">HẾT LƯỢT QUAY!</h3>
              <p className="text-gray-800 text-xl">Giải thưởng này đã hết lượt quay.</p>
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="absolute bottom-0 left-0 h-1 bg-red-500"
              />
            </div>
          </motion.div>
        )}

        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#002855] border-2 border-red-500/50 rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <h3 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-2">
                <span className="text-3xl">⚠️</span> CẢNH BÁO RESET
              </h3>
              
              <div className="space-y-4 text-blue-100 mb-8">
                <p>Bạn có chắc chắn muốn reset toàn bộ dữ liệu không?</p>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-sm space-y-2">
                  <p className="font-bold text-red-400">Hành động này sẽ:</p>
                  <ul className="list-disc pl-5 space-y-1 text-red-300/80">
                    <li>Xóa toàn bộ danh sách người trúng thưởng</li>
                    <li>Đặt lại số lượt quay về 0</li>
                    <li>Không thể hoàn tác hành động này</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmReset}
                  className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all"
                >
                  Xác nhận Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#002855] border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative"
            >
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
                        <Settings className="text-blue-400" />
                        Cấu hình giải thưởng
                    </h2>
                    <button 
                        onClick={() => setShowConfig(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="bg-white/5 p-4 rounded-xl flex items-center justify-between border border-white/5">
                        <div className="flex flex-col">
                            <label className="text-lg text-blue-200 font-medium">Điều khiển bằng bàn phím</label>
                            <span className="text-sm text-white/40">Sử dụng các phím mũi tên để điều khiển</span>
                        </div>
                        <button
                            onClick={() => setEnableKeyboard(!enableKeyboard)}
                            className={cn(
                                "w-14 h-7 rounded-full transition-colors relative",
                                enableKeyboard ? "bg-blue-500" : "bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-lg",
                                enableKeyboard ? "left-8" : "left-1"
                            )} />
                        </button>
                    </div>

                    {prizesConfig.map((prize, idx) => (
                        <div key={prize.id} className="bg-white/5 p-4 rounded-xl flex items-center justify-between border border-white/5">
                            <label className="text-lg text-blue-200 font-medium">{prize.name}</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white/50 uppercase tracking-wider">Số lượng:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={prize.maxSpins}
                                    onChange={(e) => {
                                        const newVal = parseInt(e.target.value) || 0;
                                        const newConfig = [...prizesConfig];
                                        newConfig[idx] = { ...newConfig[idx], maxSpins: newVal };
                                        setPrizesConfig(newConfig);
                                    }}
                                    className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-center text-xl font-bold text-yellow-400 focus:outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex justify-between items-center pt-6 border-t border-white/10">
                    <button
                        onClick={handleReset}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 border border-red-500/20 hover:border-red-500/50"
                    >
                        <RotateCcw size={20} />
                        Reset Game
                    </button>

                    <button
                        onClick={() => handleConfigSave(prizesConfig)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <Save size={20} />
                        Lưu Cấu Hình
                    </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Prize Winners Popup */}
      <AnimatePresence>
        {showSelectedPrizeList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#002855]/95 backdrop-blur-md flex flex-col h-screen"
          >
            {(() => {
                const selectedWinners = winners.filter(w => w.prize === selectedPrize);
                const isLargeList = selectedWinners.length > 5;
                const isSingle = selectedWinners.length === 1;
                
                return (
                    <div className={cn(
                        "mx-auto w-full flex flex-col h-full p-4 md:p-8 transition-all duration-300",
                        isLargeList ? "max-w-7xl" : (isSingle ? "max-w-3xl" : "max-w-4xl")
                    )}>
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/10 pb-4">
                            <h2 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-widest drop-shadow-lg flex items-center gap-4">
                                <span className="text-yellow-400">🏆</span>
                                {PRIZES.find(p => p.id === selectedPrize)?.name}
                                <span className="text-yellow-400">🏆</span>
                            </h2>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setShowSelectedPrizeList(false)}
                                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content List */}
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col h-full overflow-hidden">
                            <div className={cn(
                                "overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30",
                                isSingle ? "flex items-center justify-center" : (isLargeList ? "grid grid-cols-1 md:grid-cols-2 gap-4 content-start" : "space-y-3")
                            )}>
                                {selectedWinners.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center h-full text-blue-300/50 space-y-4">
                                        <span className="text-6xl opacity-50">🎲</span>
                                        <p className="text-xl italic">Chưa có kết quả cho giải này</p>
                                    </div>
                                ) : isSingle ? (
                                    (() => {
                                        const winner = selectedWinners[0];
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="relative bg-gradient-to-b from-blue-900/40 to-blue-800/30 border border-blue-400/30 rounded-3xl p-8 md:p-10 w-full max-w-2xl mx-auto shadow-[0_0_40px_rgba(96,165,250,0.25)]"
                                            >
                                                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-yellow-500/10 via-white/10 to-blue-500/10 blur-xl" />
                                                <div className="relative z-10 flex items-center gap-6">
                                                    <div className={cn(
                                                        "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl shrink-0 shadow-lg",
                                                        selectedPrize === 'SPECIAL' ? "bg-yellow-500" : "bg-blue-500"
                                                    )}>
                                                        1
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-4xl md:text-5xl font-extrabold text-white truncate drop-shadow-md">{winner.name}</div>
                                                        <div className="text-xl md:text-2xl text-blue-200 truncate">{winner.department}</div>
                                                    </div>
                                                    <div className="font-mono font-extrabold text-yellow-300 text-5xl md:text-6xl shrink-0 drop-shadow-lg">
                                                        {winner.code}
                                                    </div>
                                                </div>
                                                <div className="mt-6 flex items-center justify-center">
                                                    <span className={cn(
                                                        "inline-block px-6 py-2 rounded-full font-bold uppercase tracking-wider text-white",
                                                        selectedPrize === 'SPECIAL' ? "bg-yellow-600" : "bg-blue-600"
                                                    )}>
                                                        {PRIZES.find(p => p.id === selectedPrize)?.name}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })()
                                ) : (
                                    selectedWinners.reverse().map((winner, idx, arr) => (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            key={idx} 
                                            className="bg-white/10 p-4 rounded-xl flex items-center gap-4 hover:bg-white/20 transition-colors shrink-0"
                                        >
                                            <div className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0 shadow-lg",
                                                selectedPrize === 'SPECIAL' ? "bg-yellow-500" : "bg-blue-500"
                                            )}>
                                                {arr.length - idx}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white truncate text-xl">{winner.name}</div>
                                                <div className="text-blue-300 truncate text-base">{winner.department}</div>
                                            </div>
                                            <div className="font-mono font-bold text-yellow-400 text-3xl shrink-0 drop-shadow-md">
                                                {winner.code}
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Popup */}
      <AnimatePresence>
        {showResult && currentWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
             <motion.div
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 100 }}
              className="bg-gradient-to-b from-blue-100 to-white w-full max-w-2xl rounded-3xl p-1 shadow-2xl overflow-hidden"
             >
                <div className="bg-white p-10 text-center relative overflow-hidden border-4 border-blue-500/50 rounded-[20px]">
                  <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500" />
                  
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-blue-600 font-bold text-2xl uppercase tracking-widest mb-6"
                  >
                    Chúc mừng chiến thắng
                  </motion.div>
                  
                  <motion.h2 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.3 }}
                    className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-blue-600 to-blue-900 mb-6 drop-shadow-md"
                  >
                    {currentWinner.code}
                  </motion.h2>
                  
                  <div className="space-y-2 mb-8">
                    <motion.h3 
                       initial={{ x: -50, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       transition={{ delay: 0.5 }}
                       className="text-4xl font-bold text-gray-800"
                    >
                      {currentWinner.name}
                    </motion.h3>
                    <motion.p 
                       initial={{ x: 50, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       transition={{ delay: 0.6 }}
                       className="text-2xl text-gray-600 font-medium"
                    >
                      {currentWinner.department}
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg">
                      {PRIZES.find(p => p.id === selectedPrize)?.name}
                    </div>
                  </motion.div>
 
                   <motion.div 
                     initial={{ width: "100%" }}
                     animate={{ width: "0%" }}
                     transition={{ duration: 5, ease: "linear" }}
                     className="absolute bottom-0 left-0 h-2 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500"
                   />
                 </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All Winners Popup */}
      <AnimatePresence>
        {showAllWinners && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#002855]/95 backdrop-blur-md flex flex-col h-screen"
          >
            <div className="max-w-7xl mx-auto w-full flex flex-col h-full p-4 md:p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/10 pb-4">
                    <h2 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-widest drop-shadow-lg flex items-center gap-4">
                        <span className="text-yellow-400">🏆</span>
                        Bảng Vinh Danh
                        <span className="text-yellow-400">🏆</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowAllWinners(false)}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-0 flex-1">
                    {prizesConfig.map(prize => {
                        const prizeWinners = winners.filter(w => w.prize === prize.id).reverse();
                        return (
                            <div key={prize.id} className="bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col h-full overflow-hidden">
                                <h3 className={cn(
                                    "text-xl font-bold mb-4 text-center border-b border-white/10 pb-4 uppercase shrink-0",
                                    prize.id === 'SPECIAL' ? "text-yellow-400" : "text-blue-200"
                                )}>
                                    {prize.name}
                                    <span className="block text-sm font-normal text-white/50 mt-1">
                                        ({prizeWinners.length}/{prize.maxSpins})
                                    </span>
                                </h3>
                                
                                <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30">
                                    {prizeWinners.length === 0 ? (
                                        <p className="text-center text-white/20 italic text-sm py-4">Chưa có kết quả</p>
                                    ) : (
                                        prizeWinners.map((winner, idx) => (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                key={idx} 
                                                className="bg-white/10 p-3 rounded-xl flex items-center gap-3 hover:bg-white/20 transition-colors shrink-0"
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0",
                                                    prize.id === 'SPECIAL' ? "bg-yellow-500" : "bg-blue-500"
                                                )}>
                                                    {prizeWinners.length - idx}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-white truncate text-sm">{winner.name}</div>
                                                    <div className="text-[10px] text-blue-300 truncate">{winner.department}</div>
                                                </div>
                                                <div className="font-mono font-bold text-yellow-400 text-base shrink-0">
                                                    {winner.code}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
