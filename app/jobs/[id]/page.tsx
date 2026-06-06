"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SSEMessage {
  log: string;
  status: string;
  outputs?: string[];
  done?: boolean;
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState("connecting");
  const [outputs, setOutputs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/jobs/${id}/stream`);

    es.onmessage = (event) => {
      const data: SSEMessage = JSON.parse(event.data);
      setStatus(data.status);
      if (data.log) setLogs((prev) => [...prev, data.log]);
      if (data.done) {
        setOutputs(data.outputs ?? []);
        es.close();
      }
    };

    es.onerror = () => {
      setStatus("error");
      es.close();
    };

    return () => es.close();
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const statusColor: Record<string, string> = {
    connecting: "text-gray-400",
    pending: "text-gray-400",
    running: "text-yellow-400",
    done: "text-green-400",
    error: "text-red-400",
  };

  const statusLabel: Record<string, string> = {
    connecting: "Connecting...",
    pending: "Menunggu",
    running: "Processing...",
    done: "Selesai",
    error: "Error",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Render Job</h1>
          <p className="text-xs text-gray-600 font-mono mt-1">{id}</p>
        </div>
        <span className={`text-sm font-semibold ${statusColor[status] ?? "text-gray-400"}`}>
          {status === "running" && (
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-2 animate-pulse" />
          )}
          {statusLabel[status] ?? status}
        </span>
      </div>

      {/* Log terminal */}
      <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#1a1a1a]">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-2 text-xs text-gray-600 font-mono">render log</span>
        </div>
        <div className="h-96 overflow-y-auto p-4 font-mono text-xs text-gray-300 space-y-0.5">
          {logs.length === 0 ? (
            <span className="text-gray-600">Menunggu output...</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="leading-5 whitespace-pre-wrap break-all">{line || " "}</div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Output files */}
      {outputs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Output Files</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outputs.map((f) => (
              <div key={f} className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 space-y-3">
                <p className="text-sm text-white font-medium truncate">{f}</p>
                <video
                  src={`${API}/api/outputs/${encodeURIComponent(f)}`}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: "200px" }}
                />
                <a
                  href={`${API}/api/outputs/${encodeURIComponent(f)}`}
                  download={f}
                  className="block text-center text-xs px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            ← Render lagi
          </Link>
          <Link
            href="/outputs"
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Lihat semua output →
          </Link>
        </div>
      )}

      {status === "error" && (
        <Link
          href="/"
          className="inline-block px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          ← Coba lagi
        </Link>
      )}
    </div>
  );
}
