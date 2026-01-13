'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SlotMachineProps {
  targetNumber: string;
  isSpinning: boolean;
  stopRequested: boolean;
  onSpinEnd?: () => void;
  className?: string;
}

const NUM_HEIGHT = 140;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const REPEATS = 6;

export default function SlotMachine({ targetNumber, isSpinning, stopRequested, onSpinEnd, className }: SlotMachineProps) {
  const cleanTarget = targetNumber.padStart(3, '0');
  const digits = useMemo(() => cleanTarget.split('').map(Number), [cleanTarget]);
  const [stopStage, setStopStage] = useState(0);
  const stopTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    stopTimeoutsRef.current = [];
    const resetId = window.setTimeout(() => setStopStage(0), 0);
    stopTimeoutsRef.current.push(resetId);

    if (!isSpinning || !stopRequested) return;

    digits.forEach((_, index) => {
      const timeoutId = window.setTimeout(() => {
        setStopStage(index + 1);
      }, 600 + index * 650);
      stopTimeoutsRef.current.push(timeoutId);
    });

    return () => {
      stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      stopTimeoutsRef.current = [];
    };
  }, [isSpinning, stopRequested, digits]);
  
  return (
    <div className={cn("flex gap-6 px-8 py-6 bg-blue-900/50 rounded-3xl border-4 border-white/60 shadow-[0_0_50px_rgba(15,23,42,0.9)] backdrop-blur-md", className)}>
      {digits.map((digit, index) => (
        <SlotDigit 
          key={index} 
          targetDigit={digit} 
          phase={!isSpinning ? 'idle' : stopStage > index ? 'stop' : 'spin'}
          spinSpeedOffset={index * 0.12}
          onAnimationComplete={index === digits.length - 1 ? onSpinEnd : undefined}
        />
      ))}
    </div>
  );
}

function SlotDigit({ 
  targetDigit, 
  phase,
  spinSpeedOffset,
  onAnimationComplete 
}: { 
  targetDigit: number; 
  phase: 'spin' | 'stop' | 'idle';
  spinSpeedOffset: number;
  onAnimationComplete?: () => void;
}) {
  const controls = useAnimation();

  const targetIndex = (REPEATS - 1) * 10 + targetDigit;
  const finalY = -targetIndex * NUM_HEIGHT;
  const loopY = -(REPEATS - 1) * 10 * NUM_HEIGHT;

  useEffect(() => {
    controls.stop();

    if (phase === 'spin') {
      controls.set({ y: 0 });
      controls.start({
        y: loopY,
        transition: {
          duration: 1.2 + spinSpeedOffset,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        },
      });
      return;
    }

    if (phase === 'stop') {
      controls
        .start({
          y: finalY,
          transition: {
            duration: 1.6,
            ease: [0.2, 0.8, 0.2, 1],
          },
        })
        .then(() => {
          if (onAnimationComplete) onAnimationComplete();
        });
      return;
    }

    controls.set({ y: finalY });
  }, [phase, finalY, controls, spinSpeedOffset, loopY, onAnimationComplete]);

  // Create the strip of numbers
  const stripNumbers = [];
  for (let i = 0; i < REPEATS; i++) {
    stripNumbers.push(...DIGITS);
  }

  return (
    <div className="relative h-[140px] w-[120px] overflow-hidden bg-white rounded-2xl shadow-inner border-4 border-blue-200">
      {/* Gradient overlay for 3D effect */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/25 via-transparent to-black/30 pointer-events-none" />
      
      <motion.div
        animate={controls}
        initial={{ y: 0 }}
        className="flex flex-col items-center"
      >
        {stripNumbers.map((num, i) => (
          <div 
            key={i} 
            className="flex h-[140px] items-center justify-center text-7xl font-bold text-blue-900 tracking-[0.15em]"
          >
            {num}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
