import Image from "next/image";

const sourceWidth = 2172;
const sourceHeight = 724;
const mark = { x: 261, y: 217, width: 1628, height: 313 };

interface LogoProps {
  className?: string;
  priority?: boolean;
}

export function Logo({ className = "h-7", priority = false }: LogoProps) {
  return (
    <span
      className={`relative inline-block overflow-hidden align-middle ${className}`}
      style={{ aspectRatio: `${mark.width} / ${mark.height}` }}
    >
      <Image
        src="/formsquid.png"
        alt="FormSquid"
        width={sourceWidth}
        height={sourceHeight}
        priority={priority}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: `${(sourceWidth / mark.width) * 100}%`,
          height: "auto",
          left: `${(-mark.x / mark.width) * 100}%`,
          top: `${(-mark.y / mark.height) * 100}%`,
        }}
      />
    </span>
  );
}
