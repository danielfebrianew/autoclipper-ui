"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function OutputsPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`${API}/api/outputs`)
      .then((r) => r.json())
      .then((d) => { setFiles(d.files ?? []); setLoading(false); })
      .catch(() => { setError("Tidak bisa connect ke API."); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Output Gallery</h1>
          <p className="text-sm text-gray-500 mt-1">{files.length} clip{files.length !== 1 ? "s" : ""} tersedia</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            Refresh
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Render baru
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-gray-500">Memuat...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🎬</p>
          <p className="text-gray-500 text-sm">Belum ada output. Render clip dulu!</p>
          <Link href="/" className="inline-block px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg mt-2">
            Mulai render
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((f) => {
            const url = `${API}/api/outputs/${encodeURIComponent(f)}`;
            const isPlaying = playing === f;
            const label = f.replace(/\.mp4$/i, "").replace(/_/g, " ");
            return (
              <div key={f} className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden group">
                <div
                  className="relative bg-black cursor-pointer"
                  onClick={() => setPlaying(isPlaying ? null : f)}
                >
                  {isPlaying ? (
                    <video
                      src={url}
                      controls
                      autoPlay
                      className="w-full"
                      style={{ maxHeight: "280px", objectFit: "contain" }}
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={url}
                        muted
                        className="w-full opacity-70 group-hover:opacity-90 transition-opacity"
                        style={{ maxHeight: "280px", objectFit: "contain" }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                          <span className="text-white text-xl pl-1">▶</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-xs text-gray-300 font-medium leading-snug line-clamp-2" title={label}>{label}</p>
                  <a
                    href={url}
                    download={f}
                    className="block text-center text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
