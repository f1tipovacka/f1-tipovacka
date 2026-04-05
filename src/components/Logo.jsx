export default function Logo({ className = "" }) {
  return (
    <svg viewBox="0 0 800 300" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* main wing */}
        <path d="M120 210 Q400 170 680 210" />
        <path d="M140 225 Q400 190 660 225" />
        <path d="M160 240 Q400 210 640 240" />

        {/* center nose */}
        <path d="M390 100 L410 100 L420 210 L380 210 Z" />

        {/* supports */}
        <path d="M260 170 L360 210" />
        <path d="M540 170 L440 210" />
      </g>
    </svg>
  );
}