'use client';

import { useEffect, useState } from 'react';

import { resolveGifUrl, useExerciseGifOverrides } from '@/components/ExerciseGifOverrides';
import { cn } from '@/lib/cn';
import type { AnimationKey, StrengthExercise } from '@/lib/strength-catalog';

/**
 * Looping illustration for every catalogue exercise.
 *
 * Each movement is two stick-figure poses that SMIL morphs back and forth, so
 * the demo ships with the app: no GIF hosting, no network, works offline and in
 * both themes. When `exercise.gif_url` is set the real GIF is shown instead —
 * that field is the hook for swapping in filmed demos later.
 */

type Point = [number, number];

interface Pose {
  /** Head centre. */
  head: Point;
  /** Neck → hip → knee → ankle. */
  body: Point[];
  /** Shoulder → elbow → hand. */
  arms: Point[];
  /** Optional second limb for split stances and quadruped positions. */
  leg2?: Point[];
  arm2?: Point[];
}

interface Movement {
  a: Pose;
  b: Pose;
  /** Seconds for a full cycle. */
  dur: number;
  /** Optional prop drawn behind the figure. */
  prop?: 'wall' | 'bench' | 'floor-line';
  /** Horizontal travel, used by the bear crawl. */
  travel?: number;
}

const MOVEMENTS: Record<AnimationKey, Movement> = {
  squat: {
    dur: 2.2,
    a: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [58, 70], [58, 86]],
      arms: [[58, 32], [61, 45], [64, 56]],
    },
    b: {
      head: [54, 32],
      body: [[55, 40], [62, 60], [47, 67], [52, 86]],
      arms: [[55, 42], [45, 45], [35, 43]],
    },
  },
  jumpsquat: {
    dur: 1.4,
    a: {
      head: [54, 36],
      body: [[55, 44], [62, 62], [47, 68], [52, 86]],
      arms: [[55, 46], [47, 54], [41, 62]],
    },
    b: {
      head: [58, 6],
      body: [[58, 14], [58, 40], [58, 58], [58, 74]],
      arms: [[58, 20], [63, 10], [67, 2]],
    },
  },
  lunge: {
    dur: 2.2,
    a: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [58, 70], [58, 86]],
      arms: [[58, 32], [58, 45], [58, 56]],
      leg2: [[58, 52], [58, 70], [58, 86]],
    },
    b: {
      head: [56, 26],
      body: [[56, 34], [56, 58], [72, 70], [74, 86]],
      arms: [[56, 38], [54, 50], [52, 60]],
      leg2: [[56, 58], [40, 74], [33, 86]],
    },
  },
  bridge: {
    dur: 2.4,
    prop: 'floor-line',
    a: {
      head: [26, 78],
      body: [[34, 80], [58, 82], [74, 74], [78, 86]],
      arms: [[34, 80], [40, 86], [48, 87]],
    },
    b: {
      head: [26, 78],
      body: [[34, 80], [58, 64], [74, 62], [78, 86]],
      arms: [[34, 80], [40, 86], [48, 87]],
    },
  },
  calf: {
    dur: 1.8,
    a: {
      head: [58, 20],
      body: [[58, 28], [58, 54], [58, 71], [58, 86]],
      arms: [[58, 34], [60, 47], [61, 58]],
    },
    b: {
      head: [58, 12],
      body: [[58, 20], [58, 46], [58, 64], [60, 80]],
      arms: [[58, 26], [60, 39], [61, 50]],
    },
  },
  wallsit: {
    dur: 3,
    prop: 'wall',
    a: {
      head: [76, 34],
      body: [[76, 42], [76, 64], [52, 64], [52, 86]],
      arms: [[76, 46], [70, 56], [64, 64]],
    },
    b: {
      head: [77, 36],
      body: [[77, 44], [77, 65], [53, 65], [53, 86]],
      arms: [[77, 48], [71, 57], [65, 65]],
    },
  },
  pushup: {
    dur: 1.8,
    prop: 'floor-line',
    a: {
      head: [28, 52],
      body: [[36, 56], [62, 66], [78, 72], [92, 82]],
      arms: [[36, 56], [33, 70], [30, 84]],
    },
    b: {
      head: [26, 68],
      body: [[34, 72], [62, 78], [78, 80], [92, 85]],
      arms: [[34, 72], [22, 78], [30, 84]],
    },
  },
  wallpush: {
    dur: 1.8,
    prop: 'wall',
    a: {
      head: [46, 26],
      body: [[48, 34], [54, 58], [58, 72], [60, 86]],
      arms: [[48, 36], [66, 34], [84, 32]],
    },
    b: {
      head: [56, 28],
      body: [[58, 36], [62, 60], [64, 73], [66, 86]],
      arms: [[58, 38], [70, 26], [84, 32]],
    },
  },
  dip: {
    dur: 1.9,
    prop: 'bench',
    a: {
      head: [46, 30],
      body: [[48, 38], [50, 60], [70, 66], [84, 82]],
      arms: [[48, 38], [40, 52], [36, 66]],
    },
    b: {
      head: [46, 44],
      body: [[48, 52], [50, 72], [70, 74], [84, 84]],
      arms: [[48, 52], [36, 58], [36, 66]],
    },
  },
  pike: {
    dur: 2,
    prop: 'floor-line',
    a: {
      head: [40, 44],
      body: [[46, 46], [66, 26], [76, 56], [82, 84]],
      arms: [[46, 46], [40, 64], [34, 84]],
    },
    b: {
      head: [32, 74],
      body: [[40, 66], [66, 30], [76, 58], [82, 84]],
      arms: [[40, 66], [28, 72], [34, 84]],
    },
  },
  ytw: {
    dur: 2.2,
    a: {
      head: [58, 20],
      body: [[58, 28], [58, 54], [58, 70], [58, 86]],
      arms: [[58, 32], [44, 24], [34, 12]],
      arm2: [[58, 32], [72, 24], [82, 12]],
    },
    b: {
      head: [58, 20],
      body: [[58, 28], [58, 54], [58, 70], [58, 86]],
      arms: [[58, 32], [42, 36], [40, 22]],
      arm2: [[58, 32], [74, 36], [76, 22]],
    },
  },
  cobra: {
    dur: 2.4,
    prop: 'floor-line',
    a: {
      head: [26, 80],
      body: [[34, 82], [60, 84], [76, 84], [92, 84]],
      arms: [[34, 82], [46, 87], [58, 87]],
    },
    b: {
      head: [22, 62],
      body: [[32, 68], [60, 80], [76, 78], [92, 70]],
      arms: [[32, 68], [40, 76], [52, 74]],
    },
  },
  birddog: {
    dur: 2.6,
    prop: 'floor-line',
    a: {
      head: [30, 52],
      body: [[38, 56], [66, 58], [66, 72], [66, 86]],
      arms: [[38, 56], [38, 71], [38, 86]],
      leg2: [[66, 58], [78, 72], [78, 86]],
    },
    b: {
      head: [28, 48],
      body: [[38, 54], [66, 58], [66, 72], [66, 86]],
      arms: [[38, 54], [22, 46], [10, 40]],
      leg2: [[66, 58], [82, 56], [96, 50]],
    },
  },
  plank: {
    dur: 3,
    prop: 'floor-line',
    a: {
      head: [26, 58],
      body: [[34, 62], [60, 70], [76, 74], [92, 82]],
      arms: [[34, 62], [30, 76], [44, 84]],
    },
    b: {
      head: [26, 60],
      body: [[34, 64], [60, 71], [76, 75], [92, 83]],
      arms: [[34, 64], [30, 77], [44, 85]],
    },
  },
  sideplank: {
    dur: 3,
    prop: 'floor-line',
    a: {
      head: [26, 50],
      body: [[34, 56], [62, 70], [78, 76], [92, 84]],
      arms: [[34, 56], [30, 70], [40, 84]],
      arm2: [[34, 56], [34, 40], [34, 26]],
    },
    b: {
      head: [26, 52],
      body: [[34, 58], [62, 71], [78, 77], [92, 84]],
      arms: [[34, 58], [30, 71], [40, 85]],
      arm2: [[34, 58], [36, 42], [36, 28]],
    },
  },
  crunch: {
    dur: 2,
    prop: 'floor-line',
    a: {
      head: [24, 78],
      body: [[32, 80], [58, 82], [72, 68], [80, 84]],
      arms: [[32, 80], [28, 72], [26, 66]],
    },
    b: {
      head: [34, 62],
      body: [[40, 68], [58, 82], [72, 68], [80, 84]],
      arms: [[40, 68], [36, 58], [34, 52]],
    },
  },
  legraise: {
    dur: 2.2,
    prop: 'floor-line',
    a: {
      head: [22, 80],
      body: [[30, 82], [56, 84], [74, 84], [92, 84]],
      arms: [[30, 82], [40, 87], [52, 87]],
    },
    b: {
      head: [22, 80],
      body: [[30, 82], [56, 84], [70, 62], [82, 44]],
      arms: [[30, 82], [40, 87], [52, 87]],
    },
  },
  twist: {
    dur: 1.6,
    prop: 'floor-line',
    a: {
      head: [44, 40],
      body: [[48, 48], [58, 70], [74, 60], [86, 78]],
      arms: [[48, 50], [38, 58], [30, 64]],
    },
    b: {
      head: [48, 40],
      body: [[52, 48], [58, 70], [74, 60], [86, 78]],
      arms: [[52, 50], [64, 54], [74, 48]],
    },
  },
  deadbug: {
    dur: 2.4,
    prop: 'floor-line',
    a: {
      head: [22, 80],
      body: [[30, 82], [56, 84], [64, 66], [78, 62]],
      arms: [[30, 82], [30, 66], [30, 52]],
      leg2: [[56, 84], [66, 68], [80, 66]],
    },
    b: {
      head: [22, 80],
      body: [[30, 82], [56, 84], [70, 78], [90, 78]],
      arms: [[30, 82], [18, 70], [10, 60]],
      leg2: [[56, 84], [66, 68], [80, 66]],
    },
  },
  climber: {
    dur: 1.2,
    prop: 'floor-line',
    a: {
      head: [26, 56],
      body: [[34, 60], [62, 68], [78, 74], [92, 82]],
      arms: [[34, 60], [32, 72], [30, 84]],
      leg2: [[62, 68], [60, 78], [54, 84]],
    },
    b: {
      head: [26, 56],
      body: [[34, 60], [62, 68], [78, 74], [92, 82]],
      arms: [[34, 60], [32, 72], [30, 84]],
      leg2: [[62, 68], [48, 72], [42, 84]],
    },
  },
  crawl: {
    dur: 1.6,
    prop: 'floor-line',
    travel: 12,
    a: {
      head: [26, 52],
      body: [[34, 56], [64, 58], [66, 72], [68, 84]],
      arms: [[34, 56], [32, 70], [30, 84]],
      leg2: [[64, 58], [78, 70], [80, 84]],
    },
    b: {
      head: [30, 52],
      body: [[38, 56], [68, 58], [62, 70], [58, 84]],
      arms: [[38, 56], [44, 68], [48, 84]],
      leg2: [[68, 58], [82, 68], [88, 84]],
    },
  },
  jumpingjack: {
    dur: 1,
    a: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [58, 70], [58, 86]],
      arms: [[58, 32], [52, 46], [48, 58]],
      arm2: [[58, 32], [64, 46], [68, 58]],
      leg2: [[58, 52], [58, 70], [58, 86]],
    },
    b: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [46, 70], [38, 86]],
      arms: [[58, 30], [44, 20], [34, 10]],
      arm2: [[58, 30], [72, 20], [82, 10]],
      leg2: [[58, 52], [70, 70], [78, 86]],
    },
  },
  burpee: {
    dur: 2,
    prop: 'floor-line',
    a: {
      head: [58, 14],
      body: [[58, 22], [58, 50], [58, 68], [58, 86]],
      arms: [[58, 26], [62, 14], [66, 4]],
    },
    b: {
      head: [28, 66],
      body: [[36, 70], [62, 78], [78, 80], [92, 85]],
      arms: [[36, 70], [30, 78], [30, 86]],
    },
  },
  rope: {
    dur: 0.9,
    a: {
      head: [58, 20],
      body: [[58, 28], [58, 54], [58, 71], [58, 86]],
      arms: [[58, 34], [46, 44], [42, 54]],
      arm2: [[58, 34], [70, 44], [74, 54]],
    },
    b: {
      head: [58, 14],
      body: [[58, 22], [58, 48], [58, 62], [58, 76]],
      arms: [[58, 28], [46, 38], [42, 48]],
      arm2: [[58, 28], [70, 38], [74, 48]],
    },
  },
  highknee: {
    dur: 0.8,
    a: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [66, 66], [64, 84]],
      arms: [[58, 32], [48, 40], [44, 50]],
      leg2: [[58, 52], [52, 62], [50, 86]],
    },
    b: {
      head: [58, 18],
      body: [[58, 26], [58, 52], [50, 62], [48, 86]],
      arms: [[58, 32], [68, 40], [72, 50]],
      leg2: [[58, 52], [68, 66], [66, 84]],
    },
  },
  stepup: {
    dur: 1.8,
    prop: 'bench',
    a: {
      head: [64, 26],
      body: [[64, 34], [64, 58], [58, 72], [56, 86]],
      arms: [[64, 38], [68, 50], [70, 60]],
      leg2: [[64, 58], [46, 64], [44, 72]],
    },
    b: {
      head: [58, 12],
      body: [[58, 20], [58, 44], [48, 56], [44, 70]],
      arms: [[58, 24], [64, 34], [66, 44]],
      leg2: [[58, 44], [64, 60], [66, 80]],
    },
  },
  skater: {
    dur: 1.1,
    a: {
      head: [46, 24],
      body: [[46, 32], [50, 56], [46, 70], [42, 86]],
      arms: [[46, 36], [34, 44], [28, 54]],
      leg2: [[50, 56], [66, 64], [74, 72]],
    },
    b: {
      head: [72, 24],
      body: [[72, 32], [68, 56], [72, 70], [76, 86]],
      arms: [[72, 36], [84, 44], [90, 54]],
      leg2: [[68, 56], [52, 64], [44, 72]],
    },
  },
  bike: {
    dur: 1,
    prop: 'floor-line',
    a: {
      head: [42, 26],
      body: [[46, 34], [58, 58], [72, 52], [78, 66]],
      arms: [[46, 34], [34, 42], [26, 48]],
      leg2: [[58, 58], [50, 68], [56, 78]],
    },
    b: {
      head: [42, 26],
      body: [[46, 34], [58, 58], [50, 46], [56, 60]],
      arms: [[46, 34], [34, 42], [26, 48]],
      leg2: [[58, 58], [72, 64], [78, 74]],
    },
  },
  rowmachine: {
    dur: 1.6,
    prop: 'floor-line',
    a: {
      head: [40, 40],
      body: [[46, 46], [60, 66], [42, 62], [32, 72]],
      arms: [[46, 46], [34, 52], [24, 58]],
    },
    b: {
      head: [58, 34],
      body: [[62, 42], [70, 66], [50, 72], [32, 74]],
      arms: [[62, 42], [46, 50], [30, 56]],
    },
  },
};

const toPoints = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

function AnimatedPolyline({
  from,
  to,
  dur,
  playing,
  strokeWidth = 4,
}: {
  from: Point[];
  to: Point[];
  dur: number;
  playing: boolean;
  strokeWidth?: number;
}) {
  return (
    <polyline
      points={toPoints(from)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {playing ? (
        <animate
          attributeName="points"
          values={`${toPoints(from)};${toPoints(to)};${toPoints(from)}`}
          dur={`${dur}s`}
          repeatCount="indefinite"
        />
      ) : null}
    </polyline>
  );
}

export default function ExerciseAnimation({
  exercise,
  playing = true,
  className,
}: {
  exercise: StrengthExercise;
  playing?: boolean;
  className?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const { overrides } = useExerciseGifOverrides();

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const gifUrl = resolveGifUrl(exercise, overrides);
  // Reset once the exercise or its link changes, so switching exercises (or
  // a trainer just having saved a new link) gets a fresh attempt.
  useEffect(() => setGifFailed(false), [gifUrl]);

  // A real GIF, once one exists, always wins over the built-in illustration
  // — unless it fails to load, in which case falling back to the stick
  // figure beats showing a broken-image icon.
  if (gifUrl && !gifFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- author-supplied GIF
      <img
        src={gifUrl}
        alt={`הדגמה: ${exercise.name} (${exercise.nameEn})`}
        className={cn('w-full rounded-xl object-cover', className)}
        onError={() => setGifFailed(true)}
      />
    );
  }

  const movement = MOVEMENTS[exercise.animation];
  const animate = playing && !reduceMotion;

  // A saved link that didn't embed (e.g. it points to a page rather than an
  // image file) still deserves a way to reach it — the built-in animation
  // shows underneath, with a link to open it instead of just losing it.
  const brokenLinkNotice =
    gifUrl && gifFailed ? (
      <a
        href={gifUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-surface/90 px-2 py-1.5 text-xs font-medium text-accent shadow hover:underline"
      >
        פתיחת הקישור השמור בכרטיסייה חדשה
      </a>
    ) : null;

  return (
    <div className="relative">
    <svg
      viewBox="0 0 120 100"
      className={cn('w-full text-ink', className)}
      role="img"
      aria-label={`הדגמת תנועה: ${exercise.name} (${exercise.nameEn})`}
    >
      {/* props */}
      {movement.prop === 'wall' ? (
        <line x1="104" y1="6" x2="104" y2="88" stroke="currentColor" strokeWidth={3} opacity={0.25} />
      ) : null}
      {movement.prop === 'bench' ? (
        <rect x="24" y="66" width="34" height="6" rx="2" fill="currentColor" opacity={0.2} />
      ) : null}

      {/* ground */}
      <line x1="6" y1="90" x2="114" y2="90" stroke="currentColor" strokeWidth={2} opacity={0.25} />

      <g className="text-accent">
        {movement.travel && animate ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0 0;${movement.travel} 0;0 0`}
            dur={`${movement.dur * 2}s`}
            repeatCount="indefinite"
          />
        ) : null}

        <circle cx={movement.a.head[0]} cy={movement.a.head[1]} r="7" fill="currentColor">
          {animate ? (
            <>
              <animate
                attributeName="cx"
                values={`${movement.a.head[0]};${movement.b.head[0]};${movement.a.head[0]}`}
                dur={`${movement.dur}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values={`${movement.a.head[1]};${movement.b.head[1]};${movement.a.head[1]}`}
                dur={`${movement.dur}s`}
                repeatCount="indefinite"
              />
            </>
          ) : null}
        </circle>

        <AnimatedPolyline from={movement.a.body} to={movement.b.body} dur={movement.dur} playing={animate} />
        {movement.a.leg2 && movement.b.leg2 ? (
          <AnimatedPolyline
            from={movement.a.leg2}
            to={movement.b.leg2}
            dur={movement.dur}
            playing={animate}
            strokeWidth={3.5}
          />
        ) : null}
        <AnimatedPolyline
          from={movement.a.arms}
          to={movement.b.arms}
          dur={movement.dur}
          playing={animate}
          strokeWidth={3.5}
        />
        {movement.a.arm2 && movement.b.arm2 ? (
          <AnimatedPolyline
            from={movement.a.arm2}
            to={movement.b.arm2}
            dur={movement.dur}
            playing={animate}
            strokeWidth={3.5}
          />
        ) : null}
      </g>
    </svg>
    {brokenLinkNotice}
    </div>
  );
}
