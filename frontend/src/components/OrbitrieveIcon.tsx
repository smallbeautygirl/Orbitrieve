interface OrbitrieveIconProps {
  size?: number
}

export function OrbitrieveIcon({ size = 32 }: OrbitrieveIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Orbitrieve"
    >
      <circle cx="16" cy="16" r="15" stroke="#F5C518" strokeWidth="2" />
      <circle cx="16" cy="16" r="6" fill="#F5C518" />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6"
        stroke="#F5C518"
        strokeWidth="1.5"
        fill="none"
        transform="rotate(-30 16 16)"
      />
    </svg>
  )
}
