import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Loader Component - Animated SVG Path Loader
// ---------------------------------------------------------------------------

let cachedPathLength = 0;
let stylesInjected = false;

const LOADER_KEYFRAMES = `
  @keyframes drawStroke {
    0% {
      stroke-dashoffset: var(--path-length);
      opacity: 0;
    }
    15% {
      opacity: 1;
    }
    50% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      stroke-dashoffset: 0;
      opacity: 0;
    }
  }
`;

interface LoaderProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

const Loader = React.forwardRef<SVGSVGElement, LoaderProps>(
  ({ className, size = 64, strokeWidth = 2, ...props }, ref) => {
    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState<number>(cachedPathLength);

    useEffect(() => {
      if (typeof window !== 'undefined' && !stylesInjected) {
        stylesInjected = true;
        const style = document.createElement('style');
        style.innerHTML = LOADER_KEYFRAMES;
        document.head.appendChild(style);
      }

      if (!cachedPathLength && pathRef.current) {
        cachedPathLength = pathRef.current.getTotalLength();
        setPathLength(cachedPathLength);
      }
    }, []);

    const isReady = pathLength > 0;

    return (
      <svg
        ref={ref}
        role="status"
        aria-label="Loading..."
        viewBox="0 0 19 19"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        className={cn("text-current", className)}
        {...props}
      >
        <path
          ref={pathRef}
          d="M4.43431 2.42415C-0.789139 6.90104 1.21472 15.2022 8.434 15.9242C15.5762 16.6384 18.8649 9.23035 15.9332 4.5183C14.1316 1.62255 8.43695 0.0528911 7.51841 3.33733C6.48107 7.04659 15.2699 15.0195 17.4343 16.9241"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={isReady ? {
            strokeDasharray: pathLength,
            '--path-length': pathLength,
          } as React.CSSProperties : undefined}
          className={cn(
            "transition-opacity duration-300",
            isReady ? "opacity-100 animate-[drawStroke_2.5s_infinite]" : "opacity-0"
          )}
        />
      </svg>
    );
  }
);

Loader.displayName = "Loader";

// ---------------------------------------------------------------------------
// Loading Breadcrumb Component - Animated Loading State with Shimmer Text
// ---------------------------------------------------------------------------

interface LoadingBreadcrumbProps {
  className?: string;
  states?: string[];
  intervalDelay?: number;
}

export function LoadingBreadcrumb({ 
  className,
  states = ["Thinking", "Analyzing context", "Writing code", "Cooking"],
  intervalDelay = 2500
}: LoadingBreadcrumbProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!states || states.length === 0) return;
    
    // Cycle through states
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % states.length);
    }, intervalDelay);
    
    return () => clearInterval(interval);
  }, [states, intervalDelay]);

  const currentText = states[currentIndex] || "Cooking";

  return (
    <>
      <style>{`
        @keyframes textShimmer {
          0% { 
            background-position: -100% center;
          }
          100% { 
            background-position: 100% center;
          }
        }
      `}</style>
      
      <div className={cn(
        "flex items-center gap-2 text-[15px] font-medium tracking-wide",
        className
      )}>
        <Loader 
          size={18} 
          strokeWidth={2.5} 
          className="text-zinc-600 dark:text-zinc-200" 
        />
        
        <div className="relative inline-flex items-center">
          <AnimatePresence mode="popLayout">
            <motion.span 
              key={currentText}
              initial={{ filter: "blur(6px)", opacity: 0, y: 3 }}
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              exit={{ filter: "blur(6px)", opacity: 0, y: -3 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-clip-text text-transparent shimmer-text inline-block whitespace-nowrap px-1"
              style={{
                backgroundSize: "200% auto",
                animation: "textShimmer 2s ease-in-out infinite"
              }}
            >
              {currentText}...
            </motion.span>
          </AnimatePresence>
        </div>
        

      </div>
      
      <style>{`
        .shimmer-text {
          background-image: linear-gradient(
            90deg,
            rgb(113 113 122) 0%,
            rgb(113 113 122) 40%,
            rgb(24 24 27) 50%,
            rgb(113 113 122) 60%,
            rgb(113 113 122) 100%
          );
        }
        .dark .shimmer-text {
          background-image: linear-gradient(
            90deg,
            rgb(161 161 170) 0%,
            rgb(161 161 170) 40%,
            rgb(255 255 255) 50%,
            rgb(161 161 170) 60%,
            rgb(161 161 170) 100%
          );
        }
        
        /* Make sure shimmer works properly in dark environments without a specific .dark prefix */
        :root * .shimmer-text {
             background-image: linear-gradient(
               90deg,
               rgb(161 161 170) 0%,
               rgb(161 161 170) 40%,
               rgb(255 255 255) 50%,
               rgb(161 161 170) 60%,
               rgb(161 161 170) 100%
             );
        }
      `}</style>
    </>
  );
}
