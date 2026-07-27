import Image from "next/image";

interface ParticipantAvatarProps {
  avatarUrl: string | null;
  name: string;
  pendingCheckIn?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-lg",
  lg: "h-20 w-20 text-2xl",
};

export function ParticipantAvatar({
  avatarUrl,
  name,
  pendingCheckIn = false,
  size = "md",
  className = "",
}: ParticipantAvatarProps) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full bg-sage font-semibold text-moss ${sizeClasses[size]} ${className}`}
    >
      {avatarUrl ? (
        <Image
          alt={`${name}'s profile photo`}
          className="rounded-full object-cover"
          fill
          sizes={size === "lg" ? "80px" : size === "md" ? "48px" : "40px"}
          src={avatarUrl}
        />
      ) : (
        <span aria-hidden>{name.trim().slice(0, 1).toUpperCase() || "?"}</span>
      )}
      {pendingCheckIn ? (
        <>
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-cream bg-[#C94735] shadow-sm"
          />
          <span className="sr-only">Weekly check-in pending</span>
        </>
      ) : null}
    </span>
  );
}
