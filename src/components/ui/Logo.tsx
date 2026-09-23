import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export default function Logo({ className = "w-32 h-32", ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Birrete (Gorro de graduación) */}
      <polygon 
        points="100,30 50,50 100,70 150,50" 
        fill="white" 
        stroke="#E5E7EB" 
        strokeWidth="1" 
      />
      {/* Borla del birrete */}
      <path 
        d="M135,56 L135,80 C135,85 142,85 142,80 L142,53" 
        fill="white" 
        stroke="#E5E7EB" 
        strokeWidth="1" 
      />
      <circle cx="138.5" cy="82" r="4" fill="white" stroke="#E5E7EB" strokeWidth="1" />

      {/* Cabeza del estudiante */}
      <circle 
        cx="100" 
        cy="90" 
        r="18" 
        fill="white" 
        stroke="#E5E7EB" 
        strokeWidth="1" 
      />

      {/* Cuerpo/Hombros del estudiante */}
      <path 
        d="M 65,130 C 65,105 135,105 135,130 L 100,160 Z" 
        fill="white" 
        stroke="#E5E7EB" 
        strokeWidth="1" 
      />

      {/* Páginas superiores del libro (Turquesa) */}
      <path 
        d="M 95,145 C 75,120 35,115 25,115 L 25,130 C 40,130 75,135 95,160 Z" 
        fill="#0097A7" 
      />
      <path 
        d="M 105,145 C 125,120 165,115 175,115 L 175,130 C 160,130 125,135 105,160 Z" 
        fill="#0097A7" 
      />

      {/* Páginas inferiores del libro (Turquesa) */}
      <path 
        d="M 100,165 C 80,140 40,135 15,135 L 15,155 C 40,155 80,160 100,180 C 120,160 160,155 185,155 L 185,135 C 160,135 120,140 100,165 Z" 
        fill="#0097A7" 
      />
    </svg>
  );
}