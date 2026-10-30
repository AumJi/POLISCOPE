import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Info,
  LineChart as LineChartIcon,
  LoaderCircle,
  Menu,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const ARTICLE_EXCERPT_NOTICE = "ข้อมูลข่าวที่แสดงเป็นเนื้อหาย่อจากสำนักข่าว หากต้องการอ่านข่าวฉบับเต็ม กรุณาเปิดเว็บไซต์ต้นฉบับ";

export function getSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function getOriginalArticleText(article) {
  if (typeof article?.content === "string" && article.content.trim()) return { text: article.content.trim(), isExcerpt: false };
  if (typeof article?.description === "string" && article.description.trim()) return { text: article.description.trim(), isExcerpt: true };
  return { text: "", isExcerpt: false };
}

export function hasPoliticalCategory(category) {
  const values = Array.isArray(category) ? category : String(category || "").split(",");
  return values.map((value) => String(value).trim().toLowerCase()).includes("politics");
}

function formatDate(value) {
  if (!value) return "ไม่ระบุวันที่";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "ไม่ระบุวันที่" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "ข้อมูลไม่เพียงพอ";
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

async function apiJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดข้อมูลได้");
  return payload;
}

async function readSseStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("ไม่พบ stream จากเซิร์ฟเวอร์");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const eventText of events) {
      const event = eventText.match(/^event:\s*(.+)$/m)?.[1];
      const data = eventText.match(/^data:\s*(.+)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
    if (done) break;
  }
}

function Brand() {
  return <a href="/dashboard" className="flex items-center gap-3" aria-label="MARKETSCOPE dashboard">
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-white shadow-sm"><Activity size={21} /></span>
    <span><span className="block text-base font-bold tracking-[0.16em] text-navy">MARKETSCOPE</span><span className="block text-[11px] font-medium text-slate-500">มองข่าวให้เห็นแนวโน้ม</span></span>
  </a>;
}

function Header({ search, setSearch }) {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
      <Brand />
      <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-500 md:flex"><a href="/dashboard" className="hover:text-navy">Dashboard</a><a href="/news" className="hover:text-navy">ข่าวลงทุน</a><a href="/market/XAUUSD" className="hover:text-navy">Market Explorer</a></nav>
      <div className="hidden min-w-0 flex-1 justify-end sm:flex md:max-w-sm"><label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch?.(event.target.value)} placeholder="ค้นหาข่าวหรือสินทรัพย์" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-poliscope focus:bg-white focus:ring-4 focus:ring-blue-100" /></label></div>
      <button onClick={() => setOpen((value) => !value)} className="rounded-xl p-2 text-navy sm:hidden" aria-label="เปิดเมนู">{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:hidden"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch?.(event.target.value)} placeholder="ค้นหาข่าวหรือสินทรัพย์" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none" /></label><div className="mt-4 flex gap-4 text-sm font-semibold"><a href="/dashboard">Dashboard</a><a href="/news">ข่าวลงทุน</a><a href="/market/XAUUSD">Market Explorer</a></div></div>}
  </header>;
}

function MetricCard({ label, value, detail, icon: Icon }) {
  return <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-slate-500">{label}</span><span className="rounded-xl bg-blue-50 p-2 text-poliscope"><Icon size={18} /></span></div><p className="mt-4 text-3xl font-bold tracking-tight text-navy">{value}</p>{detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}</div>;
}

function Panel({ title, eyebrow, children, action }) {
  const displayEyebrow = eyebrow === "Reviewed associations" ? "Reviewed + AI suggestions" : eyebrow;
  return <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div>{displayEyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">{displayEyebrow}</p>}<h2 className="mt-1 text-xl font-bold text-navy">{title}</h2></div>{action}</div>{children}</section>;
}

function RangeButtons({ value, onChange, values = ["7d", "30d", "90d"] }) {
  return <div className="flex gap-2">{values.map((item) => <button key={item} onClick={() => onChange(item)} className={`rounded-xl px-3 py-2 text-xs font-bold ${value === item ? "bg-navy text-white" : "bg-slate-50 text-slate-500 hover:bg-blue-50"}`}>{item.replace("d", " วัน")}</button>)}</div>;
}

function AssetTag({ asset }) {
  if (!asset) return null;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${asset.isReviewed ? "bg-blue-50 text-poliscope" : "bg-amber-50 text-amber-700"}`}>{asset.symbol}{asset.isReviewed ? "" : " · รอตรวจสอบ"}</span>;
}

function AssetCard({ asset, selected, onClick }) {
  const change = asset.periodChange;
  return <button onClick={onClick} className={`rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${selected ? "border-poliscope ring-2 ring-blue-100" : "border-slate-200/80"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-poliscope">{asset.symbol}</p><h3 className="mt-2 font-bold text-navy">{asset.name}</h3></div><span className="rounded-xl bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">{asset.assetType === "etf" ? "ETF" : asset.assetType}</span></div><p className="mt-6 text-2xl font-bold text-navy">{asset.latest ? formatPrice(asset.latest.close) : "—"}</p><p className="mt-1 text-xs text-slate-400">{asset.latest ? `${asset.quoteCurrency} · ${asset.unit} · ${formatDate(asset.latest.priceDate)}` : "ยังไม่มีข้อมูลราคา"}</p>{change !== undefined && <p className={`mt-4 text-sm font-bold ${change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{change >= 0 ? <TrendingUp className="mr-1 inline" size={15} /> : <TrendingDown className="mr-1 inline" size={15} />}{formatPercent(change)} ในช่วงที่เลือก</p>}</button>;
}

function PriceChart({ observations, analytics }) {
  const data = observations.map((item, index) => ({ ...item, label: item.priceDate.slice(5), sma7: analytics?.movingAverages?.sma7?.[index]?.value, sma30: analytics?.movingAverages?.sma30?.[index]?.value }));
  if (!data.length) return <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">ยังไม่มีประวัติราคาในช่วงนี้</div>;
  return <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => [formatPrice(value), name === "close" ? "ราคาปิด" : name.toUpperCase()]} /><Line type="monotone" dataKey="close" stroke="#13213A" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="sma7" stroke="#3157A5" strokeWidth={1.8} dot={false} connectNulls /><Line type="monotone" dataKey="sma30" stroke="#F59E0B" strokeWidth={1.8} dot={false} connectNulls /></LineChart></ResponsiveContainer></div>;
}

function NewsVolumeChart({ timeline }) {
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline}><defs><linearGradient id="marketNewsVolume" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3157A5" stopOpacity={0.3} /><stop offset="95%" stopColor="#3157A5" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [value, "ข่าวลงทุน"]} /><Area type="monotone" dataKey="articleCount" stroke="#3157A5" fill="url(#marketNewsVolume)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div>;
}

function NewsCard({ article, onOpen }) {
  const imageUrl = getSafeExternalUrl(article.imageUrl);
  const pending = article.assets?.some((asset) => asset.isReviewed === false);
  return <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft"><div className="relative h-44 overflow-hidden bg-gradient-to-br from-navy to-poliscope">{imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/70"><BarChart3 size={38} /></div>}<span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy">ข่าวลงทุน</span></div><div className="flex flex-1 flex-col p-5"><div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "ไม่ระบุแหล่งข่าว"}</span><span>{formatDate(article.publishedAt)}</span></div><h3 className="mt-3 line-clamp-3 text-lg font-bold leading-8 text-navy">{article.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{article.description || "ไม่มีคำอธิบายจาก provider"}</p><div className="mt-auto pt-5">{article.assets?.length ? <div className="mb-4 flex flex-wrap gap-2">{article.assets.map((asset) => <AssetTag key={`${article.id}-${asset.symbol}`} asset={asset} />)}</div> : <p className="mb-4 text-xs text-slate-400">ยังไม่พบสินทรัพย์ที่ระบุชัดเจน</p>}{pending && <p className="mb-4 text-xs font-semibold text-amber-700">แท็กสินทรัพย์บางรายการรอตรวจสอบ</p>}<button onClick={() => onOpen(article)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-navy transition group-hover:bg-blue-50 group-hover:text-poliscope">อ่านรายละเอียด <ArrowRight size={17} /></button></div></div></article>;
}

function SummaryPanel({ article }) {
  const [state, setState] = useState({ status: "idle", text: "", cached: false, error: "" });
  const summarize = async () => {
    setState({ status: "loading", text: "", cached: false, error: "" });
    try {
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId: article.id }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "ไม่สามารถเริ่มสรุปข่าวได้");
      await readSseStream(response, (event, data) => {
        if (event === "delta") setState((current) => ({ ...current, status: "streaming", text: current.text + (data.text || "") }));
        if (event === "complete") setState({ status: "complete", text: data.summary || "", cached: Boolean(data.cached), error: "" });
        if (event === "error") throw new Error(data.error || "การสรุปล้มเหลว");
      });
    } catch (error) { setState((current) => ({ ...current, status: "error", error: error.message })); }
  };
  return <section className="mt-7 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6" aria-live="polite"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-bold text-poliscope"><Sparkles size={17} /> สรุปข่าวด้วย Typhoon AI</div><p className="mt-1 text-xs leading-5 text-slate-500">สรุปจากข้อความที่ provider ส่งมาเท่านั้น ไม่ใช่คำแนะนำการลงทุน</p></div>{state.status === "complete" && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Check size={13} />{state.cached ? "ใช้สรุปที่บันทึกไว้" : "บันทึกแล้ว"}</span>}</div>{state.status === "idle" && <button onClick={summarize} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-poliscope px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy"><Sparkles size={16} /> สรุปข่าวด้วย Typhoon AI</button>}{state.status === "loading" && <div className="mt-5 flex items-center gap-3 rounded-xl bg-white p-4 text-sm text-slate-600"><LoaderCircle className="animate-spin text-poliscope" size={18} /> กำลังเชื่อมต่อ Typhoon…</div>}{(state.status === "streaming" || state.status === "complete") && <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm">{state.text}{state.status === "streaming" && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-poliscope align-middle" />}</div>}{state.status === "error" && <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><div className="flex items-start gap-2"><Info size={17} />{state.error}</div><button onClick={summarize} className="mt-3 flex items-center gap-2 font-semibold"><RefreshCw size={15} /> ลองอีกครั้ง</button></div>}<p className="mt-4 text-[11px] leading-5 text-slate-500">คำเตือน: สรุปนี้ไม่ใช่การพยากรณ์ราคาและไม่ใช่คำแนะนำซื้อขาย ควรอ่านข้อมูลต้นฉบับประกอบ</p></section>;
}

function ArticleDrawer({ article, onClose }) {
  if (!article) return null;
  const original = getOriginalArticleText(article);
  const originalUrl = getSafeExternalUrl(article.originalUrl);
  return <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="ปิดรายละเอียด" onClick={onClose} /><aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={17} /> กลับไปยังข่าว</button><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิด"><X size={20} /></button></div><div className="p-5 sm:p-7"><div className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-poliscope">{getSafeExternalUrl(article.imageUrl) ? <img src={getSafeExternalUrl(article.imageUrl)} alt="" className="max-h-72 w-full object-cover" /> : <div className="flex h-48 items-center justify-center text-white/70"><BarChart3 size={42} /></div>}</div><div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "ไม่ระบุแหล่งข่าว"}</span><span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDate(article.publishedAt)}</span></div><div className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-poliscope">ข่าวลงทุน</div><h2 className="mt-4 text-2xl font-bold leading-10 text-navy sm:text-3xl">{article.title}</h2><section className="mt-7 border-t border-slate-100 pt-6"><h3 className="text-sm font-bold uppercase tracking-[0.16em] text-poliscope">ข่าวต้นฉบับ</h3>{article.description && <p className="mt-4 text-base leading-8 text-slate-700">{article.description}</p>}<div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">เนื้อหาที่มีจาก provider</p><p className="mt-2 whitespace-pre-wrap text-base leading-8 text-slate-700">{original.text || "ไม่พบเนื้อหาเพิ่มเติมจาก provider"}</p>{original.isExcerpt && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{ARTICLE_EXCERPT_NOTICE}</p>}</div></section>{article.assets?.length > 0 && <section className="mt-7 border-t border-slate-100 pt-5"><div className="flex items-center gap-2 text-sm font-semibold text-navy"><ShieldCheck size={17} className="text-emerald-600" /> สินทรัพย์ที่เกี่ยวข้อง</div><div className="mt-3 flex flex-wrap gap-2">{article.assets.map((asset) => <AssetTag key={`${article.id}-drawer-${asset.symbol}`} asset={asset} />)}</div></section>}<SummaryPanel article={article} />{originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3.5 text-sm font-bold text-white hover:bg-poliscope">อ่านข่าวต้นฉบับจากสำนักข่าว <ExternalLink size={16} /></a> : <p className="mt-5 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">ไม่สามารถเปิดลิงก์ต้นฉบับที่ไม่ถูกต้องได้</p>}</div></aside></div>;
}

function useInvestmentNews(asset) {
  const [state, setState] = useState({ articles: [], total: 0, loading: true, error: "" });
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try { const params = new URLSearchParams({ category: "investment", includeUnreviewed: "true", limit: "20" }); if (asset) params.set("asset", asset); const payload = await apiJson(`/api/news?${params}`); setState({ articles: payload.articles || [], total: payload.meta?.total || 0, loading: false, error: "" }); } catch (error) { setState({ articles: [], total: 0, loading: false, error: error.message }); }
  };
  useEffect(() => { load(); }, [asset]);
  return { ...state, reload: load };
}

function NewsList({ asset, limit = 6 }) {
  const [selected, setSelected] = useState(null);
  const news = useInvestmentNews(asset);
  return <div>{news.loading && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-slate-200" />)}</div>}{!news.loading && news.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{news.error}<button onClick={news.reload} className="ml-3 font-bold underline">ลองอีกครั้ง</button></div>}{!news.loading && !news.error && news.articles.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">ยังไม่มีข่าวลงทุนที่รวบรวมได้</div>}{!news.loading && !news.error && news.articles.length > 0 && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{news.articles.slice(0, limit).map((article) => <NewsCard key={article.id} article={article} onOpen={setSelected} />)}</div>}<ArticleDrawer article={selected} onClose={() => setSelected(null)} /></div>;
}

function DashboardPage() {
  const [assets, setAssets] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("XAUUSD");
  const [range, setRange] = useState("30d");
  const [market, setMarket] = useState({ observations: [], analytics: null, loading: true });
  const [overview, setOverview] = useState(null);
  const [volume, setVolume] = useState([]);
  const [assetNews, setAssetNews] = useState([]);
  const [includeUnreviewedAssets, setIncludeUnreviewedAssets] = useState(true);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState("");
  const selectedAsset = assets.find((asset) => asset.symbol === selectedSymbol);

  useEffect(() => { Promise.all([apiJson("/api/markets"), apiJson(`/api/analytics/overview?range=${range}`), apiJson(`/api/analytics/news-volume?range=${range}`), apiJson(`/api/analytics/asset-news?range=${range}&includeUnreviewed=${includeUnreviewedAssets}`), apiJson(`/api/analytics/investment-topics?range=${range}`)]).then(([marketData, overviewData, volumeData, assetData, topicData]) => { setAssets(marketData.assets || []); setOverview(overviewData.overview); setVolume(volumeData.timeline || []); setAssetNews(assetData.assets || []); setTopics(topicData.topics || []); }).catch((loadError) => setError(loadError.message)); }, [range, includeUnreviewedAssets]);
  useEffect(() => { if (!selectedSymbol) return; setMarket((current) => ({ ...current, loading: true })); Promise.all([apiJson(`/api/markets/${selectedSymbol}/history?range=${range}`), apiJson(`/api/markets/${selectedSymbol}/analytics?range=${range}`)]).then(([history, analytics]) => setMarket({ observations: history.observations || [], analytics: analytics.analytics, loading: false })).catch((loadError) => setMarket({ observations: [], analytics: null, loading: false, error: loadError.message })); }, [selectedSymbol, range]);

  const cards = useMemo(() => assets.map((asset) => ({ ...asset, periodChange: asset.symbol === selectedSymbol ? market.analytics?.percentageChange : undefined })), [assets, selectedSymbol, market.analytics]);
  return <div className="min-h-screen bg-canvas text-navy"><Header search="" /><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-poliscope">MARKETSCOPE</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">ภาพรวมตลาดและข่าวลงทุน</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">เข้าใจข่าวลงทุน มองเห็นแนวโน้มตลาด จากราคาย้อนหลังและแหล่งข่าวที่ตรวจสอบย้อนกลับได้</p></div><RangeButtons value={range} onChange={setRange} /></div>{error && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="ข่าวลงทุนที่รวบรวม" value={overview?.totalArticlesInRange ?? "—"} detail={`ในช่วง ${range.replace("d", " วัน")}`} icon={Newspaper} /><MetricCard label="สินทรัพย์ที่ติดตาม" value={overview?.totalAssets ?? "—"} detail="Gold · Oil · FX · Stocks · ETF" icon={BarChart3} /><MetricCard label="สำนักข่าว" value={overview?.totalSources ?? "—"} detail="จากข้อมูลที่จัดเก็บ" icon={Activity} /><MetricCard label="ข่าวที่สรุปด้วย Typhoon" value={overview?.totalSummarizedArticles ?? "—"} detail="สรุปที่บันทึกสำเร็จ" icon={Sparkles} /></div><section className="mt-8"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">Market overview</p><h2 className="mt-1 text-2xl font-bold">สินทรัพย์ที่ติดตาม</h2></div><p className="text-xs text-slate-400">ราคาล่าสุดที่มีในฐานข้อมูล ไม่ใช่ราคา real-time</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{cards.map((asset) => <AssetCard key={asset.symbol} asset={asset} selected={asset.symbol === selectedSymbol} onClick={() => setSelectedSymbol(asset.symbol)} />)}</div></section><div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]"><Panel title={`${selectedAsset?.name || selectedSymbol} · ประวัติราคา`} eyebrow="Price history" action={<RangeButtons value={range} onChange={setRange} />}><div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-navy" /> ราคาปิด</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-poliscope" /> SMA 7 observations</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-500" /> SMA 30 observations</span></div>{market.loading ? <div className="h-80 animate-pulse rounded-2xl bg-slate-100" /> : <PriceChart observations={market.observations} analytics={market.analytics} />}<p className="mt-4 text-xs leading-5 text-slate-400">SMA คำนวณจากจำนวนวันซื้อขายที่มีข้อมูลจริง ไม่ใช่จำนวนวันปฏิทิน</p></Panel><Panel title="สถิติช่วงที่เลือก" eyebrow="Deterministic analytics"><div className="space-y-4">{[["การเปลี่ยนแปลง", formatPercent(market.analytics?.percentageChange)], ["SMA 7", formatPrice(market.analytics?.sma7)], ["SMA 30", formatPrice(market.analytics?.sma30)], ["Realized volatility", market.analytics?.volatility == null ? "ข้อมูลไม่เพียงพอ" : `${(market.analytics.volatility * 100).toFixed(2)}%`]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-sm text-slate-500">{label}</span><strong className="text-sm text-navy">{value}</strong></div>)}</div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">ความผันผวนเป็นส่วนเบี่ยงเบนมาตรฐานของ daily returns ที่มีจริง ไม่ใช่การคาดการณ์ราคา</div></Panel></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Panel title="จำนวนข่าวลงทุน" eyebrow="Market news analytics" action={<RangeButtons value={range === "90d" ? "30d" : range} onChange={setRange} values={["7d", "30d"]} />}><NewsVolumeChart timeline={volume} /></Panel><Panel title="ข่าวตามสินทรัพย์" eyebrow="Reviewed associations"><div className="space-y-3">{assetNews.map((item) => <a key={item.symbol} href={`/market/${item.symbol}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 hover:bg-blue-50"><span className="text-sm font-semibold text-navy">{item.name}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-poliscope">{item.articleCount} ข่าว</span></a>)}</div><p className="mt-4 text-xs text-slate-400">นับเฉพาะ article-assets ที่ผ่านการตรวจสอบแล้ว ไม่ใช่ความนิยมของสินทรัพย์</p></Panel></div><Panel title="ประเด็นตลาดที่ถูกกล่าวถึงบ่อย" eyebrow="Keyword-based analysis"><div className="flex flex-wrap gap-3">{topics.length ? topics.map((topic) => <span key={topic.keyword} className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-poliscope">{topic.keyword} <span className="ml-2 text-xs text-slate-500">{topic.articleCount} ข่าว</span></span>) : <p className="text-sm text-slate-400">ยังไม่มีหัวข้อซ้ำเพียงพอ</p>}</div><p className="mt-5 text-xs leading-5 text-slate-400">การวิเคราะห์นี้นับคำจากพาดหัวข่าว ไม่ใช่การจัดกลุ่มเหตุการณ์หรือคำแนะนำการลงทุน</p></Panel><section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">Latest intelligence</p><h2 className="mt-1 text-2xl font-bold">ข่าวลงทุนล่าสุด</h2></div><a href="/news" className="flex items-center gap-1 text-sm font-semibold text-poliscope">ดูทั้งหมด <ArrowRight size={16} /></a></div><NewsList asset={selectedSymbol} limit={3} /></section><p className="mt-8 text-xs leading-6 text-slate-400">ข้อมูลตลาดเป็นราคาย้อนหลังที่เก็บจาก provider ตามรอบ ingestion ไม่ใช่ราคา real-time และไม่ใช่คำแนะนำซื้อขาย</p></main></div>;
}

function InvestmentNewsPage() {
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState("");
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState(null);
  const news = useInvestmentNews(asset);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? news.articles.filter((item) => [item.title, item.description, item.source?.name, ...(item.assets || []).map((a) => a.symbol)].filter(Boolean).join(" ").toLowerCase().includes(q)) : news.articles; }, [news.articles, search]);
  useEffect(() => { apiJson("/api/markets").then((payload) => setAssets(payload.assets || [])).catch(() => {}); }, []);
  return <div className="min-h-screen bg-canvas text-navy"><Header search={search} setSearch={setSearch} /><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">Investment news</p><h1 className="mt-2 text-4xl font-bold">ข่าวลงทุน</h1><p className="mt-3 text-sm text-slate-500">ข่าวที่ถูกจัดหมวดการเงินและการลงทุนโดย provider พร้อมลิงก์ต้นฉบับ</p></div><a href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-poliscope"><ArrowLeft size={16} /> กลับ Dashboard</a></div><div className="mt-7 flex gap-2 overflow-x-auto pb-2"><button onClick={() => setAsset("")} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${!asset ? "bg-navy text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>ทุกสินทรัพย์</button>{assets.map((item) => <button key={item.symbol} onClick={() => setAsset(item.symbol)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${asset === item.symbol ? "bg-navy text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{item.symbol}</button>)}</div><div className="mt-8 flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />{news.loading ? "กำลังโหลดข่าว" : `${filtered.length} จาก ${news.total} ข่าวลงทุน`}</div><div className="mt-6">{news.loading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-slate-200" />)}</div> : news.error ? <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">{news.error}</div> : filtered.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{filtered.map((article) => <NewsCard key={article.id} article={article} onOpen={setSelected} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Newspaper className="mx-auto text-slate-400" size={34} /><h2 className="mt-4 font-bold">ยังไม่พบข่าวลงทุน</h2><p className="mt-2 text-sm text-slate-500">ระบบจะแสดงเฉพาะข่าวที่ provider จัดหมวดการเงินและลงทุน ไม่สร้างข่าวเติมผลลัพธ์</p></div>}</div></main><ArticleDrawer article={selected} onClose={() => setSelected(null)} /></div>;
}

function MarketExplorer({ symbol }) {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState({ history: [], analytics: null, loading: true, error: "" });
  const [asset, setAsset] = useState(null);
  useEffect(() => { Promise.all([apiJson(`/api/markets/${symbol}/history?range=${range}`), apiJson(`/api/markets/${symbol}/analytics?range=${range}`), apiJson("/api/markets")]).then(([history, analytics, assets]) => { setData({ history: history.observations || [], analytics: analytics.analytics, loading: false, error: "" }); setAsset((assets.assets || []).find((item) => item.symbol === symbol)); }).catch((error) => setData({ history: [], analytics: null, loading: false, error: error.message })); }, [symbol, range]);
  return <div className="min-h-screen bg-canvas text-navy"><Header search="" /><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10"><a href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-poliscope"><ArrowLeft size={16} /> กลับ Dashboard</a><div className="mt-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">Market explorer</p><h1 className="mt-2 text-4xl font-bold">{asset?.name || symbol}</h1><p className="mt-3 text-sm text-slate-500">{asset?.quoteCurrency} · {asset?.unit} · ราคาย้อนหลังจากข้อมูลที่บันทึกไว้</p></div><RangeButtons value={range} onChange={setRange} /></div>{data.error && <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">{data.error}</div>}<div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]"><Panel title="Price history" eyebrow={range}>{data.loading ? <div className="h-80 animate-pulse rounded-2xl bg-slate-100" /> : <PriceChart observations={data.history} analytics={data.analytics} />}<p className="mt-4 text-xs leading-5 text-slate-400">เส้น SMA ใช้ข้อมูลรายวันที่มีจริง และไม่มีการเติมข้อมูลวันหยุด</p></Panel><Panel title="Analytics" eyebrow="Calculated from stored observations"><div className="space-y-4">{[["ล่าสุด", formatPrice(data.analytics?.latestClose)], ["เปลี่ยนแปลง", formatPercent(data.analytics?.percentageChange)], ["SMA 7", formatPrice(data.analytics?.sma7)], ["SMA 30", formatPrice(data.analytics?.sma30)], ["Volatility", data.analytics?.volatility == null ? "ข้อมูลไม่เพียงพอ" : `${(data.analytics.volatility * 100).toFixed(2)}%`]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-sm text-slate-500">{label}</span><strong className="text-sm">{value}</strong></div>)}</div></Panel></div><section className="mt-8"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-poliscope">Related coverage</p><h2 className="mt-1 text-2xl font-bold">ข่าวที่เกี่ยวข้องกับ {symbol}</h2></div><NewsList asset={symbol} limit={6} /></section></main></div>;
}

function App() {
  const [pathname] = useState(() => window.location.pathname);
  if (pathname === "/news") return <InvestmentNewsPage />;
  if (pathname.startsWith("/market/")) return <MarketExplorer symbol={pathname.split("/")[2]?.toUpperCase() || "XAUUSD"} />;
  return <DashboardPage />;
}

export default App;
