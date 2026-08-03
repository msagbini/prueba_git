import { socialLinks } from "@/lib/social";

export default function SocialIcons() {
  return (
    <div className="flex gap-2">
      {socialLinks.map((s) => (
        <a
          key={s.label}
          href={s.href}
          aria-label={s.label}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-berry/20 text-sm transition hover:bg-blush"
        >
          {s.icon}
        </a>
      ))}
    </div>
  );
}
