import { LEVELS } from "@lhhp/shared";
import { cn } from "@/lib/utils";

/**
 * The child's plant, drawn.
 *
 * She asked for this twice. On 23/09: "thiết kế bỏ nước vô là có cây có lá có hoa có quả khum" — put water in and
 * get a tree, with leaves and flowers. On 24/09, in red beside her screenshot of the class: "mong muốn icon cây to
 * hơn, rõ hơn". A 🌰 at 0.86rem is a brown dot, and across a classroom a seed and a sprout look the same.
 *
 * So each stage is a picture that changes shape, not just size: the seed splits, the sprout opens two seed leaves,
 * leaves come in pairs up the stem, the stem thickens into a trunk with a crown, the crown buds, the buds open, the
 * flowers set green fruit and the fruit ripens red. It reads at 20px in a list and at 140px on the child's own page.
 *
 * The drawn stages stop at ripe fruit. Past it the levels carry on every hundred drops with this same picture —
 * "vẫn hiện quả đỏ k thay đổi giao diện chỉ thay đổi lv" — which the clamp below takes care of.
 */

const SOIL = "#b07a4e";
const SOIL_DARK = "#8a5c37";
const SEED = "#8a5c37";
const STEM = "#3f9b52";
const LEAF = "#57c06a";
const LEAF_DARK = "#3f9b52";
const TRUNK = "#8a5c37";
const CROWN = "#57c06a";
const CROWN_DARK = "#41a555";
const BUD = "#f4a6c0";
const PETAL = "#ff8fb1";
const HEART = "#ffd76b";
const FRUIT_GREEN = "#8fd14f";
const FRUIT_GREEN_DARK = "#69ab35";
const FRUIT_RED = "#e8382f";
const FRUIT_RED_DARK = "#b32219";

/** A pair of leaves on the stem at height `y`, growing wider further down the plant. */
function Leaves({ y, w }: { y: number; w: number }) {
  return (
    <>
      <path d={`M24,${y} C${24 - w},${y - w * 0.75} ${24 - w},${y + w * 0.5} 24,${y + 1.5}`} fill={LEAF} />
      <path d={`M24,${y} C${24 + w},${y - w * 0.75} ${24 + w},${y + w * 0.5} 24,${y + 1.5}`} fill={LEAF_DARK} />
    </>
  );
}

function Flower({ x, y, r, open }: { x: number; y: number; r: number; open: boolean }) {
  if (!open) return <circle cx={x} cy={y} r={r * 0.75} fill={BUD} stroke={CROWN_DARK} strokeWidth="0.6" />;
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={x} cy={y - r * 0.8} rx={r * 0.5} ry={r * 0.8} fill={PETAL} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.42} fill={HEART} />
    </g>
  );
}

/** "Cây có quả" and "Quả chín": the same fruit, green then red, with a stalk and a leaf on it. */
function Fruit({ x, y, r, ripe }: { x: number; y: number; r: number; ripe: boolean }) {
  return (
    <g>
      <path d={`M${x},${y - r} L${x},${y - r - 2.6}`} stroke={TRUNK} strokeWidth="1.3" strokeLinecap="round" />
      <ellipse cx={x + r * 0.7} cy={y - r - 1.6} rx={r * 0.62} ry={r * 0.34} fill={LEAF} transform={`rotate(-24 ${x + r * 0.7} ${y - r - 1.6})`} />
      <circle cx={x} cy={y} r={r} fill={ripe ? FRUIT_RED : FRUIT_GREEN} />
      <path
        d={`M${x - r * 0.55},${y + r * 0.2} a${r * 0.75},${r * 0.75} 0 0 0 ${r * 1.1},0 a${r},${r} 0 0 1 ${-r * 1.1},0`}
        fill={ripe ? FRUIT_RED_DARK : FRUIT_GREEN_DARK}
        opacity="0.55"
      />
      <ellipse cx={x - r * 0.33} cy={y - r * 0.36} rx={r * 0.24} ry={r * 0.17} fill="#fff" opacity="0.75" transform={`rotate(-28 ${x - r * 0.33} ${y - r * 0.36})`} />
    </g>
  );
}

export function Plant({ level, size = 28, className }: { level: number; size?: number; className?: string }) {
  const n = Math.min(LEVELS.length, Math.max(1, Math.round(level)));
  const name = LEVELS[n - 1]!.name;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={name}
      focusable="false"
    >
      <title>{name}</title>
      {/* The ground grows with the plant, so a seed is not a hill with a speck on it. */}
      <ellipse cx="24" cy="41" rx={n <= 2 ? 10 : n <= 5 ? 13 : 15.5} ry={n <= 2 ? 3.4 : 4.4} fill={SOIL} />
      <ellipse cx="24" cy="39.8" rx={n <= 2 ? 10 : n <= 5 ? 13 : 15.5} ry={n <= 2 ? 2.6 : 3.3} fill={SOIL_DARK} opacity="0.45" />

      {n === 1 ? (
        <>
          {/* A seed the size of a conker, sitting on top of the earth where it can be seen. */}
          <ellipse cx="24" cy="33.5" rx="8.5" ry="7" fill={SEED} />
          <ellipse cx="21.4" cy="31" rx="2.6" ry="1.9" fill="#a9754b" transform="rotate(-24 21.4 31)" />
          <path d="M24,27 L24,40" stroke="#5e3a20" strokeWidth="1.3" opacity="0.55" />
        </>
      ) : null}

      {n === 2 ? (
        <>
          <ellipse cx="24" cy="36.5" rx="6.4" ry="4.6" fill={SEED} />
          <path d="M24,36 C24,29 23.6,24 25.2,20.6" stroke={STEM} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M25.2,20.4 C29,16.6 34.6,19.4 32.6,24 C31.4,26.8 27.2,27.2 25.4,24.4" fill={LEAF} />
        </>
      ) : null}

      {n === 3 ? (
        <>
          <path d="M24,38.5 L24,24" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="16.5" cy="23" rx="7.5" ry="4.6" fill={LEAF} transform="rotate(-18 16.5 23)" />
          <ellipse cx="31.5" cy="23" rx="7.5" ry="4.6" fill={LEAF_DARK} transform="rotate(18 31.5 23)" />
        </>
      ) : null}

      {/* 4 is a narrow little thing; 5 is visibly taller and twice as broad, so they differ at 20px. */}
      {n === 4 ? (
        <>
          <path d="M24,38.5 L24,20" stroke={STEM} strokeWidth="2.8" strokeLinecap="round" />
          <Leaves y={31} w={8} />
          <Leaves y={24.5} w={6.5} />
          <ellipse cx="24" cy="19" rx="3" ry="4" fill={LEAF} />
        </>
      ) : null}

      {n === 5 ? (
        <>
          <path d="M24,38.5 L24,11" stroke={STEM} strokeWidth="3.4" strokeLinecap="round" />
          <Leaves y={33} w={14} />
          <Leaves y={25.5} w={12.5} />
          <Leaves y={18} w={10} />
          <ellipse cx="24" cy="10.5" rx="3.8" ry="5" fill={LEAF} />
        </>
      ) : null}

      {n >= 6 ? (
        <>
          <path d="M22.4,38.5 C22.4,30 21.6,26 24,22 C26.4,26 25.6,30 25.6,38.5 Z" fill={TRUNK} />
          <path d="M24,27 L18,22 M24,25 L30,20" stroke={TRUNK} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16.5" cy="18.5" r="7.5" fill={CROWN_DARK} />
          <circle cx="31.5" cy="18.5" r="7.5" fill={CROWN_DARK} />
          <circle cx="24" cy="13.5" r="9.5" fill={CROWN} />
          <circle cx="19" cy="20" r="6.5" fill={CROWN} />
          <circle cx="29" cy="20" r="6.5" fill={CROWN} />
        </>
      ) : null}

      {n === 7 ? (
        <>
          <Flower x={16} y={14} r={3.2} open={false} />
          <Flower x={31} y={15} r={3.2} open={false} />
          <Flower x={24} y={8.5} r={3.4} open={false} />
        </>
      ) : null}

      {n === 8 ? (
        <>
          <Flower x={15.5} y={14} r={4} open />
          <Flower x={32} y={15} r={4} open />
          <Flower x={24} y={8} r={4.4} open />
          <Flower x={24} y={21} r={3.2} open />
        </>
      ) : null}

      {/* The blossom sets fruit: still small and green, with one flower left over. */}
      {n === 9 ? (
        <>
          <Flower x={24} y={7.5} r={3.4} open />
          <Fruit x={15.5} y={16} r={3.6} ripe={false} />
          <Fruit x={31.5} y={17} r={3.6} ripe={false} />
          <Fruit x={24} y={22.5} r={3.2} ripe={false} />
        </>
      ) : null}

      {/* Ripe, and heavier: the fruit hangs lower and there is more of it. This is also every level past it. */}
      {n >= 10 ? (
        <>
          <Fruit x={14.5} y={17.5} r={4.3} ripe />
          <Fruit x={32.5} y={18.5} r={4.3} ripe />
          <Fruit x={23.5} y={23} r={4.6} ripe />
          <Fruit x={24} y={9} r={3.8} ripe />
        </>
      ) : null}
    </svg>
  );
}
