"use client";

export function BrandLogo({
  className = "",
  alt = "OrionX",
  priority = false,
  width = 138,
  height = 36,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <span className={`brand-logo-wrap ${className}`.trim()}>
      <img
        src="/orionx-logo-dark.png"
        alt={alt}
        className="brand-logo-img brand-logo-dark"
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
      <img
        src="/orionx-logo-light.png"
        alt={alt}
        className="brand-logo-img brand-logo-light"
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </span>
  );
}
