"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AvatarUpload() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const res = await fetch("/api/avatar", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setMessage("Avatar disimpan.");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Unggah gagal.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Unggah avatar
        <input
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <small className="muted">
        JPG, PNG, WebP · maksimal 2 MB · dipotong persegi
      </small>
      <button className="button outline" disabled={busy}>
        {busy ? "Mengunggah..." : "Simpan foto"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
