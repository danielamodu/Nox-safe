import { useState } from "react";
import { isAddress } from "viem";
import { useSafe } from "../hooks/useSafe";

export function SafeInput() {
  const { safeAddress, setSafeAddress } = useSafe();
  const [draft, setDraft] = useState(safeAddress);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setSafeAddress("");
      setError("");
      return;
    }
    if (!isAddress(trimmed)) {
      setError("Invalid Ethereum address");
      return;
    }
    setError("");
    setSafeAddress(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-start">
      <div className="flex-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          placeholder="0x... Safe address"
          className="input-brutal font-mono text-sm"
        />
        {error && (
          <p className="text-red-400 text-xs mt-1 font-body">{error}</p>
        )}
      </div>
      <button type="submit" className="btn-accent text-sm !py-3 whitespace-nowrap">
        Set Safe
      </button>
    </form>
  );
}
