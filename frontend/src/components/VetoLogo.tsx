export function VetoLogo({ size = 24 }: { size?: number }) {
  return (
    <img
      src="/veto-darkmode-icon.png"
      alt="Veto"
      width={size}
      height={size}
      className="inline-block"
    />
  );
}
