interface LogoProps {
  className?: string;
}

export function Logo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main pad */}
      <ellipse cx="24" cy="33" rx="12" ry="9" />
      {/* Toe beans */}
      <circle cx="9" cy="17" r="5" />
      <circle cx="19" cy="9" r="5.5" />
      <circle cx="29" cy="9" r="5.5" />
      <circle cx="39" cy="17" r="5" />
    </svg>
  );
}
