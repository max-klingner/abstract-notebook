import { TAG_COLORS } from "../lib/colors";

export default function ColorSelect({
  tagId,
  setTagColor,
}: {
  tagId: number;
  setTagColor: (id: number, color: string) => void;
}) {
  return (
    <div className="flex self-end gap-1.5 rounded-full border border-ink/10 bg-black/30 px-2 py-1.5">
      {TAG_COLORS.map((c) => (
        <span
          key={c}
          className="w-4 h-4 cursor-pointer rounded-full transition hover:scale-125"
          style={{ backgroundColor: c }}
          onPointerDown={(e) => {
            e.preventDefault();
            setTagColor(tagId, c);
          }}
        />
      ))}
    </div>
  );
}
