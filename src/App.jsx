import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Menu,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const ARTICLE_EXCERPT_NOTICE = "ข้อมูลข่าวที่แสดงเป็นเนื้อหาย่อจากสำนักข่าว หากต้องการอ่านข่าวฉบับเต็ม กรุณาเปิดเว็บไซต์ต้นฉบับ";

export function getSafeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getOriginalArticleText(article) {
  const content = typeof article?.content === "string" ? article.content.trim() : "";
  if (content) return { text: content, isExcerpt: false };
  const description = typeof article?.description === "string" ? article.description.trim() : "";
  return { text: description, isExcerpt: Boolean(description) };
}

const formatDate = (value) => {
  if (!value) return "ไม่ระบุวันที่";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "ไม่ระบุวันที่";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const truncate = (value, length = 160) => {
  if (!value) return "ยังไม่มีคำอธิบายจากผู้ให้บริการข่าว";
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
};

export function hasPoliticalCategory(category) {
  const values = Array.isArray(category) ? category : String(category || "").split(",");
  return values.some((value) => String(value).trim().toLowerCase() === "politics");
}

function PartyTags({ article, compact = false }) {
  if (!article.parties?.length) {
    return <p className={`${compact ? "text-xs" : "text-sm"} text-slate-400`}>ไม่พบพรรคการเมืองที่ระบุชัดเจน</p>;
  }
  return <div className="flex flex-wrap items-center gap-2">
    <ShieldCheck size={16} className="text-emerald-600" aria-label="พรรคการเมืองที่เกี่ยวข้อง" />
    {article.parties.map((party) => {
      const isReviewed = party.isReviewed !== false;
      return <span key={`${article.id}-${party.code}`} className={`rounded-full px-2.5 py-1 text-xs font-medium ${isReviewed ? "bg-blue-50 text-poliscope" : "border border-amber-200 bg-amber-50 text-amber-800"}`}>
        {party.shortName || party.name}{!isReviewed && <span className="ml-1.5 font-semibold">AI แนะนำ · รอตรวจสอบ</span>}
      </span>;
    })}
  </div>;
}

async function readSseStream(response, onEvent) {
  if (!response.body) throw new Error("เบราว์เซอร์ไม่รองรับการสตรีมผลลัพธ์");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (rawEvent) => {
    const lines = rawEvent.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!data) return;
    onEvent(event, JSON.parse(data));
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      consume(buffer.slice(0, separatorIndex));
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf("\n\n");
    }
    if (done) break;
  }

  if (buffer.trim()) consume(buffer);
}

function Brand() {
  return (
    <a href="#top" className="flex items-center gap-3" aria-label="POLISCOPE หน้าหลัก">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
        <Newspaper size={20} strokeWidth={2.5} />
      </span>
      <span>
        <span className="block text-base font-bold tracking-[0.18em] text-navy">POLISCOPE</span>
        <span className="block text-[11px] font-medium text-slate-500">มองข่าวให้รอบด้าน</span>
      </span>
    </a>
  );
}

function Header({ search, setSearch, onRefresh, mobileOpen, setMobileOpen }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex">
          <a className="text-navy" href="#latest">ข่าวล่าสุด</a>
          <a href="/analytics" className="transition hover:text-navy">ภาพรวมข่าว</a>
          <a href="#about" className="transition hover:text-navy">เกี่ยวกับ POLISCOPE</a>
        </nav>
        <div className="hidden min-w-0 flex-1 justify-end gap-3 sm:flex md:max-w-sm">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาข่าวในหน้านี้"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-poliscope focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <button onClick={onRefresh} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:border-poliscope hover:text-poliscope" aria-label="โหลดข่าวใหม่" title="โหลดข่าวใหม่">
            <RefreshCw size={18} />
          </button>
        </div>
        <button onClick={() => setMobileOpen((open) => !open)} className="rounded-xl p-2 text-navy sm:hidden" aria-label="เปิดเมนู">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:hidden">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาข่าวในหน้านี้" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:border-poliscope" />
          </label>
          <div className="mt-4 flex items-center justify-between text-sm">
            <a href="#latest" className="font-medium text-navy" onClick={() => setMobileOpen(false)}>ข่าวล่าสุด</a>
            <button onClick={onRefresh} className="flex items-center gap-2 text-slate-500"><RefreshCw size={16} /> โหลดใหม่</button>
          </div>
        </div>
      )}
    </header>
  );
}

function PartyChip({ party, active, onClick }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-navy bg-navy text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-poliscope"}`}>
      {party.name || party.shortName || party.code}{Number.isFinite(Number(party.articleCount)) && <span className="ml-2 text-xs opacity-70">({Number(party.articleCount).toLocaleString("th-TH")})</span>}
    </button>
  );
}

function ArticleImage({ article }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = getSafeExternalUrl(article.imageUrl);
  if (!imageUrl || failed) {
    return <div className="flex h-full min-h-48 items-center justify-center bg-gradient-to-br from-navy via-[#20375f] to-poliscope text-white/80"><Newspaper size={38} strokeWidth={1.5} /></div>;
  }
  return <img src={imageUrl} alt="" className="h-full min-h-48 w-full object-cover" onError={() => setFailed(true)} />;
}

function NewsCard({ article, onOpen }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative h-48 overflow-hidden"><ArticleImage article={article} />{hasPoliticalCategory(article.category) && <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy backdrop-blur">การเมือง</div>}</div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "แหล่งข่าวไม่ระบุ"}</span><span className="flex shrink-0 items-center gap-1"><Clock3 size={13} /> {formatDate(article.publishedAt)}</span></div>
        <h3 className="mt-3 line-clamp-3 text-lg font-bold leading-8 text-navy">{article.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{truncate(article.description)}</p>
        <div className="mt-auto pt-5">
          {!article.parties?.length && <p className="mb-4 text-xs text-slate-400">ไม่พบพรรคการเมืองที่ระบุชัดเจน</p>}
          {article.parties?.some((party) => party.isReviewed === false) && <p className="mb-4 text-xs font-semibold text-amber-700">AI แนะนำ · รอตรวจสอบ</p>}
          {article.parties?.length > 0 && <div className="mb-4"><PartyTags article={article} compact /></div>}
          <button onClick={() => onOpen(article)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-navy transition group-hover:bg-blue-50 group-hover:text-poliscope">อ่านรายละเอียด <ArrowUpRight size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="h-48 animate-pulse bg-slate-200" /><div className="space-y-3 p-5"><div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" /><div className="h-6 w-5/6 animate-pulse rounded bg-slate-200" /><div className="h-4 w-full animate-pulse rounded bg-slate-100" /><div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" /></div></div>;
}

function SummaryPanel({ article }) {
  const [state, setState] = useState({ status: "idle", text: "", cached: false, saved: false, error: "" });

  const summarize = async () => {
    setState({ status: "loading", text: "", cached: false, saved: false, error: "" });
    try {
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId: article.id }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "ไม่สามารถเริ่มสรุปข่าวได้");
      }
      await readSseStream(response, (event, data) => {
        if (event === "delta") setState((current) => ({ ...current, status: "streaming", text: current.text + (data.text || "") }));
        if (event === "complete") setState({ status: "complete", text: data.summary || "", cached: Boolean(data.cached), saved: Boolean(data.saved), error: "" });
        if (event === "error") throw new Error(data.error || "การสรุปข่าวล้มเหลว");
      });
    } catch (error) {
      setState((current) => ({ ...current, status: "error", error: error.message || "เกิดข้อผิดพลาด" }));
    }
  };

  return <section className="mt-7 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6" aria-live="polite">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-bold text-poliscope"><Sparkles size={17} /> สรุปด้วย Typhoon AI</div><p className="mt-1 text-xs leading-5 text-slate-500">สรุปจากข้อความข่าวต้นฉบับที่ผู้ให้บริการส่งมาเท่านั้น</p></div>{state.status === "complete" && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Check size={13} /> {state.cached ? "เรียกจากที่บันทึกไว้" : "บันทึกแล้ว"}</span>}</div>
    {state.status === "idle" && <button onClick={summarize} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-poliscope px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy"><Sparkles size={16} /> สรุปด้วย Typhoon AI</button>}
    {state.status === "loading" && <div className="mt-5 flex items-center gap-3 rounded-xl bg-white p-4 text-sm text-slate-600"><LoaderCircle className="animate-spin text-poliscope" size={18} /> กำลังเชื่อมต่อกับ Typhoon…</div>}
    {(state.status === "streaming" || state.status === "complete") && <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm">{state.text}{state.status === "streaming" && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-poliscope align-middle" />}</div>}
    {state.status === "error" && <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 shrink-0" size={17} /> <span>{state.error}</span></div><button onClick={summarize} className="mt-3 flex items-center gap-2 font-semibold text-red-800"><RefreshCw size={15} /> ลองอีกครั้ง</button></div>}
    <p className="mt-4 text-[11px] leading-5 text-slate-500">คำเตือน: AI อาจสรุปคลาดเคลื่อน โปรดอ่านข่าวต้นฉบับและตรวจสอบข้อมูลก่อนใช้งาน</p>
  </section>;
}

function LegacyArticleDrawer({ article, onClose }) {
  if (!article) return null;
  const original = getOriginalArticleText(article);
  const originalUrl = getSafeExternalUrl(article.originalUrl);
  return <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="รายละเอียดข่าว">
    <button className="absolute inset-0 cursor-default" aria-label="ปิดรายละเอียดข่าว" onClick={onClose} />
    <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-3xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-navy"><ArrowLeft size={17} /> กลับไปยังข่าวทั้งหมด</button><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-navy" aria-label="ปิด"><X size={20} /></button></div>
      <div className="p-5 sm:p-7"><div className="overflow-hidden rounded-2xl"><ArticleImage key={article.id} article={article} /></div><div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "แหล่งข่าวไม่ระบุ"}</span><span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDate(article.publishedAt)}</span></div><div className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-poliscope">การเมือง</div><h2 className="mt-4 text-2xl font-bold leading-10 text-navy sm:text-3xl">{article.title}</h2><section className="mt-7 border-t border-slate-100 pt-6"><h3 className="text-sm font-bold uppercase tracking-[0.16em] text-poliscope">ข่าวต้นฉบับ</h3>{article.description && <div className="mt-4"><p className="text-xs font-semibold text-slate-500">คำอธิบายจากสำนักข่าว</p><p className="mt-2 text-base leading-8 text-slate-700">{article.description}</p></div>}<div className="mt-5"><p className="text-xs font-semibold text-slate-500">เนื้อหาที่มีจากสำนักข่าว</p>{original.text ? <p className="mt-2 whitespace-pre-wrap text-base leading-8 text-slate-700">{original.text}</p> : <p className="mt-2 text-base leading-8 text-slate-500">ไม่พบเนื้อหาเพิ่มเติมจากผู้ให้บริการข่าว</p>}{original.isExcerpt && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{ARTICLE_EXCERPT_NOTICE}</p>}</div></section>{article.parties?.length > 0 && <div className="mt-7 border-t border-slate-100 pt-5"><div className="flex items-center gap-2 text-sm font-semibold text-navy"><ShieldCheck size={17} className="text-emerald-600" /> พรรคการเมืองที่เกี่ยวข้อง (ตรวจสอบแล้ว)</div><div className="mt-3 flex flex-wrap gap-2">{article.parties.map((party) => <span key={`${article.id}-drawer-${party.code}`} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-poliscope">{party.name}</span>)}</div></div>}<SummaryPanel article={article} />{originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3.5 text-sm font-bold text-white transition hover:bg-poliscope">อ่านข่าวฉบับเต็มจากสำนักข่าว <ExternalLink size={16} /></a> : <p className="mt-5 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">ไม่สามารถเปิดลิงก์ต้นฉบับที่ไม่ถูกต้องได้</p>}<p className="mt-3 text-center text-xs text-slate-400">ที่มา: {article.source?.websiteUrl || "ไม่ระบุเว็บไซต์"}</p></div>
    </aside>
  </div>;
}

function ArticleDrawer({ article, onClose }) {
  if (!article) return null;
  const original = getOriginalArticleText(article);
  const originalUrl = getSafeExternalUrl(article.originalUrl);
  return <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="รายละเอียดข่าว">
    <button className="absolute inset-0 cursor-default" aria-label="ปิดรายละเอียดข่าว" onClick={onClose} />
    <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-3xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-navy"><ArrowLeft size={17} /> กลับไปยังข่าวทั้งหมด</button><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-navy" aria-label="ปิด"><X size={20} /></button></div>
      <div className="p-5 sm:p-7">
        <div className="overflow-hidden rounded-2xl"><ArticleImage key={article.id} article={article} /></div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "แหล่งข่าวไม่ระบุ"}</span><span className="flex items-center gap-1"><CalendarDays size={14} /> {formatDate(article.publishedAt)}</span></div>
        {hasPoliticalCategory(article.category) && <div className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-poliscope">การเมือง</div>}
        <h2 className="mt-4 text-2xl font-bold leading-10 text-navy sm:text-3xl">{article.title}</h2>
        <section className="mt-7 border-t border-slate-100 pt-6"><h3 className="text-sm font-bold uppercase tracking-[0.16em] text-poliscope">ข่าวต้นฉบับ</h3>{article.description && <div className="mt-4"><p className="text-xs font-semibold text-slate-500">คำอธิบายจากสำนักข่าว</p><p className="mt-2 text-base leading-8 text-slate-700">{article.description}</p></div>}<div className="mt-5"><p className="text-xs font-semibold text-slate-500">เนื้อหาที่มีจากสำนักข่าว</p>{original.text ? <p className="mt-2 whitespace-pre-wrap text-base leading-8 text-slate-700">{original.text}</p> : <p className="mt-2 text-base leading-8 text-slate-500">ไม่พบเนื้อหาเพิ่มเติมจากผู้ให้บริการข่าว</p>}{original.isExcerpt && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{ARTICLE_EXCERPT_NOTICE}</p>}</div></section>
        <section className="mt-7 border-t border-slate-100 pt-5"><div className="text-sm font-semibold text-navy">พรรคการเมืองที่เกี่ยวข้อง</div><div className="mt-3"><PartyTags article={article} /></div></section>
        <SummaryPanel article={article} />
        {originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3.5 text-sm font-bold text-white transition hover:bg-poliscope">อ่านข่าวฉบับเต็มจากสำนักข่าว <ExternalLink size={16} /></a> : <p className="mt-5 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">ไม่สามารถเปิดลิงก์ต้นฉบับที่ไม่ถูกต้องได้</p>}
        <p className="mt-3 text-center text-xs text-slate-400">ที่มา: {article.source?.websiteUrl || "ไม่ระบุเว็บไซต์"}</p>
      </div>
    </aside>
  </div>;
}

function AnalyticsMetric({ label, value, detail }) {
  return <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-navy">{Number(value || 0).toLocaleString("th-TH")}</p>{detail && <p className="mt-2 text-xs text-slate-400">{detail}</p>}</div>;
}

function AnalyticsCard({ title, description, children, action }) {
  return <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-navy">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}</div>{action}</div><div className="mt-5">{children}</div></section>;
}

function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [partyFilter, setPartyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [partyData, setPartyData] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [topicData, setTopicData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drilldown, setDrilldown] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ range });
    if (partyFilter) query.set("party", partyFilter);
    if (sourceFilter) query.set("source", sourceFilter);
    if (includeUnreviewed) query.set("includeUnreviewed", "true");
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/analytics/overview?${query}`).then((response) => response.json().then((payload) => ({ response, payload }))),
      fetch(`/api/analytics/timeline?${query}`).then((response) => response.json().then((payload) => ({ response, payload }))),
      fetch(`/api/analytics/parties?${query}`).then((response) => response.json().then((payload) => ({ response, payload }))),
      fetch(`/api/analytics/sources?${query}`).then((response) => response.json().then((payload) => ({ response, payload }))),
      fetch(`/api/analytics/topics?${query}`).then((response) => response.json().then((payload) => ({ response, payload }))),
    ]).then(([overviewResult, timelineResult, partiesResult, sourcesResult, topicsResult]) => {
      if (!active) return;
      const failed = [overviewResult, timelineResult, partiesResult, sourcesResult, topicsResult].find((result) => !result.response.ok);
      if (failed) throw new Error(failed.payload.error || "ไม่สามารถโหลดข้อมูลวิเคราะห์ได้");
      setOverview(overviewResult.payload.overview);
      setTimeline(timelineResult.payload.timeline || []);
      setPartyData(partiesResult.payload.parties || []);
      setSourceData(sourcesResult.payload.sources || []);
      setTopicData(topicsResult.payload);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "ไม่สามารถโหลดข้อมูลวิเคราะห์ได้");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [range, partyFilter, sourceFilter, includeUnreviewed]);

  useEffect(() => {
    let active = true;
    if (!drilldown) {
      setRelatedArticles([]);
      return undefined;
    }
    setRelatedLoading(true);
    const load = drilldown.kind === "topic"
      ? Promise.all((drilldown.articleIds || []).map((id) => fetch(`/api/news/${encodeURIComponent(id)}?includeUnreviewed=true`).then((response) => response.ok ? response.json() : null))).then((items) => items.filter(Boolean).map((item) => item.article))
      : fetch(`/api/news?includeUnreviewed=true&${drilldown.kind === "party" ? "party" : "source"}=${encodeURIComponent(drilldown.value)}`).then((response) => response.json()).then((payload) => payload.articles || []);
    load.then((articles) => { if (active) setRelatedArticles(articles); }).catch(() => { if (active) setRelatedArticles([]); }).finally(() => { if (active) setRelatedLoading(false); });
    return () => { active = false; };
  }, [drilldown]);

  const navigateToFeed = () => { window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); };
  const number = (value) => Number(value || 0).toLocaleString("th-TH");
  const dateLabel = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00+07:00`)) : "ไม่พบข้อมูล";
  const chartTimeline = timeline.map((item) => ({ ...item, label: item.date.slice(5) }));
  const chartParties = partyData.map((item) => ({ ...item, displayName: item.shortName || item.name }));
  const chartSources = sourceData.map((item) => ({ ...item, displayName: item.name }));
  const openParty = (state) => { const item = state?.activePayload?.[0]?.payload; if (item) setDrilldown({ kind: "party", value: item.code, label: item.name }); };
  const openSource = (state) => { const item = state?.activePayload?.[0]?.payload; if (item) setDrilldown({ kind: "source", value: item.sourceKey, label: item.name }); };
  const openTopic = (topic) => setDrilldown({ kind: "topic", value: topic.keyword, label: topic.keyword, articleIds: topic.articles.map((article) => article.id) });

  return <div className="min-h-screen bg-canvas text-navy"><header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10"><Brand /><nav className="flex items-center gap-3 text-sm font-semibold"><a href="/" className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-50 hover:text-navy">ข่าวล่าสุด</a><span className="rounded-xl bg-blue-50 px-3 py-2 text-poliscope">ภาพรวมข่าว</span></nav></div></header><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><button onClick={navigateToFeed} className="mb-4 flex items-center gap-2 text-sm font-semibold text-poliscope"><ArrowLeft size={16} /> กลับไปยังข่าวล่าสุด</button><p className="text-sm font-bold uppercase tracking-[0.2em] text-poliscope">Analytics</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">ภาพรวมข่าวการเมือง</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">สถิตินี้คำนวณจากข่าวที่ POLISCOPE รวบรวมได้ ไม่ใช่ข่าวทั้งหมดที่เผยแพร่</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setRange("7d")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${range === "7d" ? "bg-navy text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>7 วันที่ผ่านมา</button><button onClick={() => setRange("30d")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${range === "30d" ? "bg-navy text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>30 วันที่ผ่านมา</button></div></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{loading ? ["a", "b", "c", "d"].map((key) => <div key={key} className="h-32 animate-pulse rounded-3xl bg-slate-200" />) : <><AnalyticsMetric label="จำนวนข่าวที่รวบรวม" value={overview?.totalArticles} detail={`${number(overview?.totalArticlesInRange)} ข่าวในช่วงที่เลือก`} /><AnalyticsMetric label="จำนวนสำนักข่าว" value={overview?.totalSources} /><AnalyticsMetric label="พรรคการเมืองที่พบ" value={overview?.totalParties} /><AnalyticsMetric label="ข่าวที่สรุปด้วย Typhoon AI" value={overview?.totalSummarizedArticles} /></>}</div>
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between"><span>ช่วงข้อมูลที่รวบรวม: {dateLabel(overview?.earliestCollectedArticleDate?.slice?.(0, 10))} – {dateLabel(overview?.latestCollectedArticleDate?.slice?.(0, 10))}</span><span className="text-xs text-blue-700">นำเข้าล่าสุด: {overview?.lastIngestedAt ? formatDate(overview.lastIngestedAt) : "ไม่พบข้อมูล"}</span></div>
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><label className="flex flex-1 items-center gap-3 text-sm font-semibold text-slate-600">พรรคการเมือง<select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-navy"><option value="">ทุกพรรค</option>{partyData.map((party) => <option key={party.code} value={party.code}>{party.name}</option>)}</select></label><label className="flex flex-1 items-center gap-3 text-sm font-semibold text-slate-600">สำนักข่าว<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-navy"><option value="">ทุกสำนักข่าว</option>{sourceData.map((source) => <option key={source.sourceKey} value={source.sourceKey}>{source.name}</option>)}</select></label></div>
    <label className="mt-3 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={includeUnreviewed} onChange={(event) => setIncludeUnreviewed(event.target.checked)} className="rounded border-slate-300 text-poliscope" /> รวมคำแนะนำจาก AI ที่รอตรวจสอบ</label>
    {error && <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"><div className="flex items-start gap-3"><AlertCircle className="shrink-0" size={18} /><div><p className="font-bold">ยังโหลดข้อมูลวิเคราะห์ไม่ได้</p><p className="mt-1">{error}</p></div></div></div>}
      {!error && <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]"><AnalyticsCard title="จำนวนข่าวที่รวบรวม" description={`ข่าวการเมืองที่เผยแพร่ในช่วง ${range === "7d" ? "7" : "30"} วันที่เลือก · แบ่งตามวันที่เผยแพร่`}><div className="h-72">{chartTimeline.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartTimeline}><defs><linearGradient id="newsVolume" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3157A5" stopOpacity={0.28} /><stop offset="95%" stopColor="#3157A5" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [value, "ข่าว"]} labelFormatter={(label) => `วันที่ ${label}`} /><Area type="monotone" dataKey="articleCount" stroke="#3157A5" fill="url(#newsVolume)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลในช่วงนี้</div>}</div></AnalyticsCard><AnalyticsCard title="ข่าวที่กล่าวถึงพรรคการเมือง" description="จำนวนบทความที่มีความสัมพันธ์กับพรรคและผ่านการตรวจสอบแล้ว"><div className="h-72">{chartParties.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartParties} layout="vertical" margin={{ left: 12, right: 12 }} onClick={openParty}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="displayName" width={90} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [value, "ข่าว"]} /><Bar dataKey="articleCount" fill="#3157A5" radius={[0, 6, 6, 0]} cursor="pointer" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลพรรคที่ตรวจสอบแล้ว</div>}</div></AnalyticsCard><AnalyticsCard title="จำนวนข่าวตามสำนักข่าว" description="จำนวนบทความการเมืองที่เก็บได้จากแต่ละแหล่งข่าว"><div className="h-72">{chartSources.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartSources} margin={{ bottom: 36 }} onClick={openSource}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="displayName" angle={-24} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [value, "ข่าว"]} /><Bar dataKey="articleCount" fill="#5d7bc2" radius={[6, 6, 0, 0]} cursor="pointer" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลสำนักข่าว</div>}</div></AnalyticsCard><AnalyticsCard title="ประเด็นที่ถูกกล่าวถึงบ่อย" description="การวิเคราะห์คำสำคัญจากพาดหัวข่าว ไม่ใช่การจัดกลุ่มเหตุการณ์ที่ผ่านการตรวจสอบ"><div className="space-y-2">{topicData?.topics?.length ? topicData.topics.map((topic) => <button key={topic.keyword} onClick={() => openTopic(topic)} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-blue-50"><span className="font-semibold text-navy">{topic.keyword}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-poliscope">{number(topic.articleCount)} ข่าว</span></button>) : <p className="text-sm text-slate-400">ยังไม่มีหัวข้อที่เพียงพอสำหรับการแสดงผล</p>}</div></AnalyticsCard></div>}
    <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-2 text-poliscope"><TrendingUpIcon /></div><div><h2 className="text-lg font-bold text-navy">ประเด็นที่มีการรายงานเพิ่มขึ้น</h2><p className="mt-1 text-sm leading-6 text-slate-500">เปรียบเทียบจำนวนข่าวใน 7 วันล่าสุดกับ 7 วันก่อนหน้า ไม่ใช่ความนิยม ความเห็นสาธารณะ หรือความสำเร็จทางการเมือง</p></div></div>{topicData?.trendAvailable ? topicData.trends?.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{topicData.trends.map((trend) => <button key={trend.keyword} onClick={() => openTopic({ keyword: trend.keyword, articles: trend.articles })} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:border-blue-200 hover:bg-blue-50"><div className="flex items-center justify-between"><span className="font-semibold text-navy">{trend.keyword}</span><span className="text-sm font-bold text-emerald-700">+{number(trend.difference)}</span></div><p className="mt-2 text-xs text-slate-500">ล่าสุด {number(trend.recentArticleCount)} ข่าว · ช่วงก่อน {number(trend.previousArticleCount)} ข่าว</p></button>)}</div> : <p className="mt-5 text-sm text-slate-400">ยังไม่พบหัวข้อที่มีปริมาณข่าวเพิ่มขึ้น</p> : <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{topicData?.trendReason || "ต้องมีข้อมูลข่าวที่ครอบคลุมอย่างน้อย 14 วันก่อนเปรียบเทียบแนวโน้ม"}</p>}</section>
    {drilldown && <section className="mt-6 rounded-3xl border border-blue-100 bg-blue-50/40 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-poliscope">Article drill-down</p><h2 className="mt-1 text-xl font-bold text-navy">ข่าวที่เกี่ยวข้องกับ {drilldown.label}</h2></div><button onClick={() => setDrilldown(null)} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-600">ปิด</button></div>{relatedLoading ? <div className="mt-5 grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div> : relatedArticles.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{relatedArticles.map((article) => <NewsCard key={article.id} article={article} onOpen={setSelectedArticle} />)}</div> : <p className="mt-5 text-sm text-slate-500">ไม่พบข่าวที่เกี่ยวข้อง</p>}</section>}
    <p className="mt-8 text-xs leading-6 text-slate-400">ตัวเลขทั้งหมดคำนวณจากบทความการเมืองที่มีอยู่ใน PostgreSQL โดยแยกวันที่เผยแพร่จากวันที่นำเข้า และไม่ใช่สถิติข่าวการเมืองทั้งหมดในโลก</p></main><ArticleDrawer article={selectedArticle} onClose={() => setSelectedArticle(null)} /></div>;
}

function TrendingUpIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
}

function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [parties, setParties] = useState([]);
  const [party, setParty] = useState("");
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadParties = async () => {
    const response = await fetch("/api/parties");
    if (!response.ok) return;
    const payload = await response.json();
    setParties(Array.isArray(payload.parties) ? payload.parties : []);
  };

  const loadNews = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ includeUnreviewed: "true" });
      if (party) params.set("party", party);
      const response = await fetch(`/api/news?${params}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดข่าวได้");
      setArticles(Array.isArray(payload.articles) ? payload.articles : []);
      setTotalArticles(Number(payload.meta?.total ?? payload.meta?.count ?? 0));
    } catch (loadError) {
      setArticles([]);
      setTotalArticles(0);
      setError(loadError.message || "ไม่สามารถโหลดข่าวได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadParties().catch(() => {}); }, []);
  useEffect(() => { loadNews(); }, [party]);

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter((article) => [article.title, article.description, article.source?.name, ...(article.parties || []).map((item) => item.name)].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [articles, search]);

  return <div id="top" className="min-h-screen bg-canvas text-navy">
    <Header search={search} setSearch={setSearch} onRefresh={loadNews} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    <main>
      <section className="relative overflow-hidden bg-navy text-white"><div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" /><div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-poliscope/40 blur-3xl" /><div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"><div className="max-w-3xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100"><span className="h-2 w-2 rounded-full bg-emerald-400" /> ข่าวจากแหล่งข้อมูลจริง · อัปเดตตามรอบการดึงข้อมูล</div><h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl sm:leading-[1.15]">เข้าใจข่าวการเมือง<br /><span className="text-blue-300">ในไม่กี่นาที</span></h1><p className="mt-6 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">POLISCOPE ช่วยให้คุณเห็นภาพข่าวการเมืองจากหลายมุมอย่างกระชับ พร้อมสรุปภาษาไทยจาก Typhoon เมื่อคุณต้องการ</p><a href="#latest" className="mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-navy transition hover:bg-blue-50">ดูข่าวล่าสุด <ChevronRight size={17} /></a></div></div></section>
      <section id="latest" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-poliscope">Latest briefing</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-navy">ข่าวล่าสุด</h2><p className="mt-2 text-sm text-slate-500">คัดข่าวการเมืองไทยมาไว้ในที่เดียว</p></div><div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {loading ? "กำลังอัปเดต" : search.trim() ? `${filteredArticles.length} จาก ${totalArticles} ข่าวการเมือง` : `${totalArticles} ข่าวการเมือง`}</div></div>
        <div className="mt-7 flex gap-2 overflow-x-auto pb-2"><PartyChip party={{ name: "ทุกพรรค" }} active={!party} onClick={() => setParty("")} />{parties.map((item) => <PartyChip key={item.id || item.code} party={item} active={party === item.code} onClick={() => setParty(item.code)} />)}</div>
        {loading && <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>}
        {!loading && error && <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0 text-amber-600" /><div><h3 className="font-bold text-amber-900">ยังโหลดข่าวไม่ได้</h3><p className="mt-1 text-sm leading-6 text-amber-800">{error}</p><button onClick={loadNews} className="mt-4 flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white"><RefreshCw size={15} /> ลองโหลดอีกครั้ง</button></div></div></div>}
        {!loading && !error && filteredArticles.length === 0 && <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Newspaper className="mx-auto text-slate-400" size={34} /><h3 className="mt-4 font-bold text-navy">ยังไม่พบข่าวที่ตรงกับการค้นหา</h3><p className="mt-2 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือเลือกดูข่าวจากทุกพรรค</p></div>}
        {!loading && !error && filteredArticles.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{filteredArticles.map((article) => <NewsCard key={article.id || article.originalUrl} article={article} onOpen={setSelectedArticle} />)}</div>}
      </section>
      <section id="about" className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><p><span className="font-semibold text-navy">POLISCOPE</span> — อ่านให้ครบ คิดให้รอบด้าน</p><p className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600" /> ความสัมพันธ์พรรคจะแสดงเมื่อผ่านการตรวจสอบแล้ว</p></div></section>
    </main>
    <ArticleDrawer article={selectedArticle} onClose={() => setSelectedArticle(null)} />
  </div>;
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return pathname === "/analytics" ? <AnalyticsPage /> : <NewsFeed />;
}

export default App;
