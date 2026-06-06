"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Speaker {
  name: string;
  role: string;
  position: string;
  description: string;
}

interface Clip {
  clip_id: number;
  start_time: string;
  end_time: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  suggested_caption: string;
  viral_score: number;
  speaker: string;
  speakers_visible: string[];
  interaction_type: string;
  hook: string;
  summary: string;
  category: string;
  energy_level: string;
  transcript_excerpt?: string;
  end_cue?: string;
  timestamp_adjustments?: unknown[];
}

interface ClipsJson {
  video_title?: string;
  video_duration?: string;
  video_duration_seconds?: number;
  source_url?: string;
  heatmap_available?: boolean;
  speakers?: Speaker[];
  clips: Clip[];
}

function energyColor(level: string) {
  if (level === "high") return "text-green-400 bg-green-400/10";
  if (level === "medium") return "text-yellow-400 bg-yellow-400/10";
  return "text-gray-400 bg-white/5";
}

function viralColor(score: number) {
  if (score >= 9) return "text-green-400";
  if (score >= 7) return "text-yellow-400";
  return "text-red-400";
}

function tsToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export default function HomePage() {
  const [videos, setVideos] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [parsedData, setParsedData] = useState<ClipsJson | null>(null);
  const [parseError, setParseError] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [editedClips, setEditedClips] = useState<Clip[]>([]);
  const [channelName, setChannelName] = useState("@channelku");
  const [sourceCredit, setSourceCredit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<"running" | "done" | "error" | null>(null);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [jobOutputs, setJobOutputs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [submitError, setSubmitError] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [heatmapAvailable, setHeatmapAvailable] = useState(false);
  const [renderMode, setRenderMode] = useState<"single" | "split">("single");
  const [activeTab, setActiveTab] = useState<"clips" | "preview">("clips");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [applySuccess, setApplySuccess] = useState(false);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [jobLogs]);

  useEffect(() => {
    fetch(`${API}/api/inputs`)
      .then((r) => r.json())
      .then((d) => {
        setVideos(d.files ?? []);
        if (d.files?.length > 0) setSelectedVideo(d.files[0]);
      })
      .catch(() => setSubmitError("Tidak bisa connect ke API. Pastikan FastAPI sudah running di port 8000."));
  }, []);

  async function handleGenerate() {
    setGenerateError("");
    if (!youtubeUrl.trim()) { setGenerateError("Masukkan YouTube URL dulu."); return; }
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/generate-clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });
      if (!res.ok) {
        const err = await res.json();
        setGenerateError(err.detail ?? "Generate gagal.");
        return;
      }
      const { clips_json } = await res.json();
      setJsonText(JSON.stringify(clips_json, null, 2));
      setHeatmapAvailable(clips_json.heatmap_available ?? false);
      setGenerateError("");
    } catch {
      setGenerateError("Tidak bisa connect ke API.");
    } finally {
      setGenerating(false);
    }
  }

  function handleParse() {
    setParseError("");
    if (!jsonText.trim()) { setParseError("Input kosong."); return; }
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.clips?.length) { setParseError("Key 'clips' tidak ditemukan atau kosong."); return; }
      setParsedData(parsed);
      setEditedClips(parsed.clips.map((c: Clip) => ({ ...c })));
      setExcluded(new Set());
      setPreviewIndex(0);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "JSON tidak valid.");
    }
  }

  function toggleClip(id: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateEditedClip(index: number, field: "start_time" | "end_time", value: string) {
    setEditedClips((prev) => {
      const next = [...prev];
      const clip = { ...next[index], [field]: value };
      clip.start_seconds = tsToSeconds(clip.start_time);
      clip.end_seconds = tsToSeconds(clip.end_time);
      clip.duration_seconds = Math.max(0, clip.end_seconds - clip.start_seconds);
      next[index] = clip;
      return next;
    });
  }

  function handleApplyChanges() {
    if (!parsedData) return;
    const updated = { ...parsedData, clips: editedClips };
    setParsedData(updated);
    setJsonText(JSON.stringify(updated, null, 2));
    setApplySuccess(true);
    if (applyTimer.current) clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => setApplySuccess(false), 3000);
  }

  async function handleRender() {
    if (!selectedVideo) { setSubmitError("Pilih video dulu."); return; }
    if (!parsedData) { setSubmitError("Parse JSON dulu."); return; }
    if (!channelName.trim() || !sourceCredit.trim()) {
      setSubmitError("Isi channel name dan source credit.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    const clipsToRender = parsedData.clips.filter((c) => !excluded.has(c.clip_id));
    try {
      const res = await fetch(`${API}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_filename: selectedVideo,
          clips_json: { ...parsedData, clips: clipsToRender },
          channel_name: channelName,
          source_credit: sourceCredit,
          mode: renderMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.detail ?? "Render gagal.");
        setSubmitting(false);
        return;
      }
      const { job_id } = await res.json();
      setJobStatus("running");
      setJobLogs([]);
      setJobOutputs([]);
      setSubmitting(false);

      const es = new EventSource(`${API}/api/jobs/${job_id}/stream`);
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setJobStatus(data.status);
        if (data.log) setJobLogs((prev) => [...prev, data.log]);
        if (data.done) {
          setJobOutputs(data.outputs ?? []);
          es.close();
        }
      };
      es.onerror = () => { setJobStatus("error"); es.close(); };
    } catch {
      setSubmitError("Tidak bisa connect ke API.");
      setSubmitting(false);
    }
  }

  const includedCount = parsedData
    ? parsedData.clips.filter((c) => !excluded.has(c.clip_id)).length
    : 0;
  const maxDur = parsedData
    ? Math.max(...parsedData.clips.map((c) => c.duration_seconds), 1)
    : 1;
  const hasSplitClips = parsedData?.clips.some((c) => c.speakers_visible?.length > 1) ?? false;

  const previewClip = editedClips[previewIndex];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && previewClip) {
      videoRef.current.currentTime = previewClip.start_seconds;
    }
  }, [previewIndex, previewClip?.start_seconds]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Clip Studio</h1>
        <p className="text-sm text-gray-500 mt-1">Generate timestamps dengan AI, preview & edit, render.</p>
      </div>

      {/* Video & Watermark */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Video Lokal</label>
          {videos.length === 0 ? (
            <p className="text-sm text-yellow-400">Taruh video di folder <code>input/</code></p>
          ) : (
            <select
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
            >
              {videos.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Watermark</label>
          <input
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            placeholder="@namachannel"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
          <input
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
            placeholder="Source: youtube.com/@sumber"
            value={sourceCredit}
            onChange={(e) => setSourceCredit(e.target.value)}
          />
        </div>
      </div>

      {/* Generate with AI */}
      <div className="space-y-3 bg-[#111] border border-violet-500/20 rounded-xl p-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-violet-400">Generate with AI</label>
        <input
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500"
          placeholder="YouTube URL — contoh: https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {generating ? "Menganalisis video..." : "✨ Generate Clips"}
          </button>
          {generating && (
            <span className="text-xs text-gray-500">
              Mengambil transcript + heatmap lalu analisis dengan Gemini...
            </span>
          )}
        </div>
        {generateError && <p className="text-sm text-red-400">{generateError}</p>}
        {heatmapAvailable && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            <span>🔥</span>
            <span>Heatmap engagement tersedia — AI memilih clips berdasarkan engagement peak</span>
          </div>
        )}
      </div>

      {/* JSON Input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">JSON Input</label>
        <textarea
          className="w-full h-52 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-700 focus:outline-none focus:border-violet-500 resize-none"
          placeholder={'{\n  "video_title": "...",\n  "clips": [...]\n}'}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={handleParse}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Parse JSON
          </button>
          <button
            onClick={() => {
              setJsonText(""); setParsedData(null); setParseError("");
              setExcluded(new Set()); setEditedClips([]); setPreviewIndex(0);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
        {parseError && <p className="text-sm text-red-400">{parseError}</p>}
      </div>

      {/* Clips + Preview tabs */}
      {parsedData && (
        <div className="space-y-4">
          <div className="flex items-center gap-6 py-3 border-y border-white/10 text-sm text-gray-400">
            <span>{includedCount}/{parsedData.clips.length} clips dipilih</span>
            <span>
              Total: {parsedData.clips
                .filter((c) => !excluded.has(c.clip_id))
                .reduce((s, c) => s + c.duration_seconds, 0)}s
            </span>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
            {(["clips", "preview"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab === "clips" ? "Clips" : "Preview & Edit"}
              </button>
            ))}
          </div>

          {/* Tab: Clips */}
          {activeTab === "clips" && (
            <div className="space-y-2">
              {parsedData.clips.map((clip) => {
                const included = !excluded.has(clip.clip_id);
                const pct = Math.round((clip.duration_seconds / maxDur) * 100);
                return (
                  <div
                    key={clip.clip_id}
                    className={`flex items-center gap-3 bg-[#1a1a1a] rounded-xl p-4 border border-white/5 transition-opacity ${included ? "opacity-100" : "opacity-30"}`}
                  >
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleClip(clip.clip_id)}
                      className="w-4 h-4 accent-violet-500 shrink-0"
                    />
                    <span className="text-xs font-bold text-gray-500 w-6 shrink-0">#{clip.clip_id}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm text-white truncate">{clip.suggested_caption}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {clip.start_time} → {clip.end_time} · {clip.duration_seconds}s
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className={`text-sm font-bold ${viralColor(clip.viral_score)}`}>{clip.viral_score}/10</p>
                      <p className="text-xs text-gray-500">{clip.speaker}</p>
                      {clip.energy_level && (
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${energyColor(clip.energy_level)}`}>
                          {clip.energy_level}
                        </span>
                      )}
                      {clip.speakers_visible?.length > 1 && (
                        <p className="text-xs text-violet-400">{clip.speakers_visible.join(", ")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Preview & Edit */}
          {activeTab === "preview" && previewClip && (
            <div className="space-y-4">
              {/* Clip selector */}
              <select
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                value={previewIndex}
                onChange={(e) => setPreviewIndex(Number(e.target.value))}
              >
                {editedClips.map((c, i) => (
                  <option key={c.clip_id} value={i}>
                    #{c.clip_id} — {c.suggested_caption?.slice(0, 60)}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Local video preview */}
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  {selectedVideo ? (
                    <video
                      ref={videoRef}
                      key={selectedVideo}
                      src={`${API}/api/inputs/${encodeURIComponent(selectedVideo)}`}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                      Pilih video di dropdown atas untuk preview
                    </div>
                  )}
                </div>

                {/* Edit panel */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Start Time</label>
                      <input
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-violet-500"
                        value={previewClip.start_time}
                        onChange={(e) => updateEditedClip(previewIndex, "start_time", e.target.value)}
                        placeholder="MM:SS"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase tracking-wider">End Time</label>
                      <input
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-violet-500"
                        value={previewClip.end_time}
                        onChange={(e) => updateEditedClip(previewIndex, "end_time", e.target.value)}
                        placeholder="MM:SS"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">
                    Durasi: {previewClip.duration_seconds}s
                  </p>

                  <div className="bg-[#1a1a1a] rounded-lg p-3 space-y-2 text-sm">
                    <p className="text-gray-400"><span className="text-gray-600">Hook:</span> {previewClip.hook}</p>
                    <p className="text-gray-400"><span className="text-gray-600">Summary:</span> {previewClip.summary}</p>
                    <div className="flex flex-wrap gap-2 text-xs pt-1">
                      <span className={viralColor(previewClip.viral_score)}>{previewClip.viral_score}/10 viral</span>
                      <span className="text-gray-600">{previewClip.speaker}</span>
                      <span className="text-gray-600">{previewClip.category}</span>
                      {previewClip.interaction_type && (
                        <span className="text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{previewClip.interaction_type}</span>
                      )}
                      {previewClip.energy_level && (
                        <span className={`px-1.5 py-0.5 rounded font-medium ${energyColor(previewClip.energy_level)}`}>
                          {previewClip.energy_level} energy
                        </span>
                      )}
                    </div>
                    {previewClip.end_cue && (
                      <p className="text-xs text-gray-500"><span className="text-gray-600">End cue:</span> {previewClip.end_cue}</p>
                    )}
                  </div>

                  {previewClip.transcript_excerpt && (
                    <div className="bg-[#111] border border-white/5 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1 uppercase tracking-wider">Transcript</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{previewClip.transcript_excerpt}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation + Apply */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm rounded-lg transition-colors"
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => setPreviewIndex((i) => Math.min(editedClips.length - 1, i + 1))}
                    disabled={previewIndex === editedClips.length - 1}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm rounded-lg transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
                <button
                  onClick={handleApplyChanges}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {applySuccess ? "✓ JSON Updated!" : "↩ Apply Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Render */}
          <div className="pt-2 border-t border-white/10 space-y-4">
            {/* Mode toggle */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Mode Render</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRenderMode("single")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    renderMode === "single"
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-[#1a1a1a] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  🎯 Single Speaker
                </button>
                {hasSplitClips ? (
                  <button
                    onClick={() => setRenderMode("split")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      renderMode === "split"
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-[#1a1a1a] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    🪟 Split Screen
                  </button>
                ) : (
                  <button
                    disabled
                    title="Tidak ada clip dengan 2 speaker terdeteksi"
                    className="flex-1 py-2 px-3 rounded-lg text-sm font-medium border bg-[#1a1a1a] border-white/5 text-gray-600 cursor-not-allowed"
                  >
                    🪟 Split Screen
                  </button>
                )}
              </div>
              {renderMode === "split" && (
                <p className="text-xs text-gray-600">
                  60% atas: dua speaker side-by-side · 40% bawah: blank untuk overlay di CapCut
                </p>
              )}
              {!hasSplitClips && (
                <p className="text-xs text-gray-600">Split Screen membutuhkan clip dengan 2 speaker terdeteksi</p>
              )}
            </div>

            {submitError && <p className="text-sm text-red-400">{submitError}</p>}
            <button
              onClick={handleRender}
              disabled={submitting || includedCount === 0}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              {submitting ? "Memulai render..." : `🚀 Render ${includedCount} Clip${includedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {submitError && !parsedData && (
        <p className="text-sm text-red-400">{submitError}</p>
      )}

      {/* Render progress card — inline, no modal */}
      {jobStatus && (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {jobStatus === "running" && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
              {jobStatus === "done"    && <span className="w-2 h-2 rounded-full bg-green-400" />}
              {jobStatus === "error"   && <span className="w-2 h-2 rounded-full bg-red-400" />}
              <span className="text-sm font-semibold text-white">
                {jobStatus === "running" && "Rendering..."}
                {jobStatus === "done"    && "Render selesai!"}
                {jobStatus === "error"   && "Render error"}
              </span>
            </div>
            {jobStatus !== "running" && (
              <button
                onClick={() => { setJobStatus(null); setJobLogs([]); setJobOutputs([]); }}
                className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
              >
                ×
              </button>
            )}
          </div>

          {/* Log terminal */}
          <div className="h-56 overflow-y-auto p-4 font-mono text-xs text-gray-300 space-y-0.5 bg-[#0a0a0a]">
            {jobLogs.length === 0 ? (
              <span className="text-gray-600">Menunggu output...</span>
            ) : (
              jobLogs.map((line, i) => (
                <div key={i} className="leading-5 whitespace-pre-wrap break-all">{line || " "}</div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {/* Output files */}
          {jobOutputs.length > 0 && (
            <div className="px-5 py-4 border-t border-white/10 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Output</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {jobOutputs.map((f) => (
                  <div key={f} className="bg-[#1a1a1a] rounded-xl p-3 space-y-2">
                    <p className="text-xs text-white truncate">{f.replace(/\.mp4$/i, "").replace(/_/g, " ")}</p>
                    <video
                      src={`${API}/api/outputs/${encodeURIComponent(f)}`}
                      controls
                      className="w-full rounded-lg"
                      style={{ maxHeight: "160px" }}
                    />
                    <a
                      href={`${API}/api/outputs/${encodeURIComponent(f)}`}
                      download={f}
                      className="block text-center text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {jobStatus !== "running" && (
            <div className="flex gap-3 px-5 py-4 border-t border-white/10">
              <button
                onClick={() => { setJobStatus(null); setJobLogs([]); setJobOutputs([]); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                Tutup
              </button>
              <a
                href="/outputs"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Lihat semua output →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
