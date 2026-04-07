// frontend/src/components/Header.tsx
import { OrbitrieveIcon } from "./OrbitrieveIcon";

interface HeaderProps {
  onNewChat: () => void;
}

export function Header({ onNewChat: _onNewChat }: HeaderProps): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        backgroundColor: "#111111",
        borderBottom: "1px solid #2a2a2a",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <OrbitrieveIcon size={26} />
        <span
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: "#F5A623",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: "0.01em",
          }}
        >
          Orbitrieve
        </span>
      </div>
    </header>
  );
}
