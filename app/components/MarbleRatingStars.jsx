"use client";

import { useId } from "react";

export function MarbleRatingStars({ count = 5, className = "", label = "امتیاز ۵ از ۵" }) {
  const gradientPrefix = useId().replace(/:/g, "");
  const starPath = "M32 3.7c2.7 0 5.1 1.6 6.3 4.1l5.6 11.5 12.7 1.9c2.8.4 5 2.3 5.8 4.9.8 2.6.1 5.4-2 7.4l-9.2 9 2.2 12.6c.5 2.8-.6 5.5-2.8 7.1-2.2 1.6-5.1 1.8-7.6.5L32 56.7 20.7 62.6c-2.5 1.3-5.4 1.1-7.6-.5-2.2-1.6-3.3-4.3-2.8-7.1l2.2-12.6-9.2-9c-2-2-2.8-4.8-2-7.4.8-2.6 3-4.5 5.8-4.9l12.7-1.9 5.6-11.5c1.2-2.5 3.6-4 6.3-4Z";

  return (
    <span className={`marbleRatingStars ${className}`} aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <svg className="marbleRatingStar" viewBox="0 0 64 64" aria-hidden="true" key={index}>
          <defs>
            <clipPath id={`${gradientPrefix}-marbleStarClip-${index}`}>
              <path d={starPath} />
            </clipPath>
            <linearGradient id={`${gradientPrefix}-marbleStarBase-${index}`} x1="4" y1="8" x2="60" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ff9ddd" />
              <stop offset="0.2" stopColor="#ffffff" />
              <stop offset="0.42" stopColor="#ffe05c" />
              <stop offset="0.62" stopColor="#18cfff" />
              <stop offset="0.82" stopColor="#6d57ff" />
              <stop offset="1" stopColor="#ff7b18" />
            </linearGradient>
            <linearGradient id={`${gradientPrefix}-marbleStarRim-${index}`} x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.2" stopColor="#ff5bbd" />
              <stop offset="0.42" stopColor="#ffd430" />
              <stop offset="0.62" stopColor="#20d7ff" />
              <stop offset="0.8" stopColor="#3156ff" />
              <stop offset="1" stopColor="#ff7a00" />
            </linearGradient>
            <radialGradient id={`${gradientPrefix}-marbleStarLight-${index}`} cx="20%" cy="18%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.26" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g clipPath={`url(#${gradientPrefix}-marbleStarClip-${index})`}>
            <rect width="64" height="64" fill={`url(#${gradientPrefix}-marbleStarBase-${index})`} />
            <path className="marbleRibbon pink" d="M-10 24C6 8 20 12 31 25s25 13 44-1" />
            <path className="marbleRibbon cyan" d="M-8 35c16-9 27-9 39 0s23 10 40-8" />
            <path className="marbleRibbon yellow" d="M19-4c5 20 15 27 28 35s17 15 10 34" />
            <path className="marbleRibbon orange" d="M5 58c12-21 26-22 39-28s22-10 29-28" />
            <path className="marbleRibbon blue" d="M-5 45c15 8 28 5 39-7s22-17 38-11" />
            <path className="marbleRibbon white" d="M7 18c15 15 29 17 44 5" />
            <path className="marbleRibbon violet" d="M16 70c4-17 14-25 29-28s23-11 29-24" />
            <path className="marbleStarSoftLight" d="M0 0h64v64H0z" fill={`url(#${gradientPrefix}-marbleStarLight-${index})`} />
          </g>
          <path className="marbleStarShape" d={starPath} fill="none" stroke={`url(#${gradientPrefix}-marbleStarRim-${index})`} strokeWidth="2.4" strokeLinejoin="round" />
          <path className="marbleStarGloss" d="M17 19c7.6-8.2 19-9 29.2-2.6" fill="none" stroke="rgba(255,255,255,.86)" strokeWidth="3.2" strokeLinecap="round" />
          <path className="marbleStarGloss thin" d="M11.5 32c9.8 4.9 22 4.4 34.5-1.2" fill="none" stroke="rgba(255,255,255,.68)" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      ))}
    </span>
  );
}
