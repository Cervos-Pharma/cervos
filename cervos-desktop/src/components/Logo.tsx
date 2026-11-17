import { APP_NAME } from "../lib/branding";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const LOGO_URL = "/cervos-company-logo-circular.svg";

export default function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <img
      src={LOGO_URL}
      alt={APP_NAME}
      className={`object-contain ${SIZE_CLASSES[size]} ${className}`}
      onError={(e) => {
        // Fallback to logo.png if SVG fails
        (e.target as HTMLImageElement).src = "/logo.png";
      }}
    />
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt={APP_NAME}
      className={`object-contain h-8 w-8 ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/logo.png";
      }}
    />
  );
}
