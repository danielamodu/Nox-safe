const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "bg-primary text-black" },
  1: { label: "Executed", color: "bg-green-400 text-black" },
  2: { label: "Rejected", color: "bg-red-400 text-white" },
};

export function StatusBadge({ status }: { status: number }) {
  const info = STATUS_MAP[status] ?? { label: "Unknown", color: "bg-gray-400 text-black" };
  return (
    <span className={`badge-brutal ${info.color}`}>
      {info.label}
    </span>
  );
}
