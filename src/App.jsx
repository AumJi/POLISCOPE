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
      {party.name || party.shortName || party.code}
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
      <div className="relative h-48 overflow-hidden"><ArticleImage article={article} /><div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy backdrop-blur">การเมือง</div></div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="font-semibold text-poliscope">{article.source?.name || "แหล่งข่าวไม่ระบุ"}</span><span className="flex shrink-0 items-center gap-1"><Clock3 size={13} /> {formatDate(article.publishedAt)}</span></div>
        <h3 className="mt-3 line-clamp-3 text-lg font-bold leading-8 text-navy">{article.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{truncate(article.description)}</p>
        <div className="mt-auto pt-5">
          {article.parties?.length > 0 && <div className="mb-4 flex flex-wrap gap-2"><ShieldCheck size={16} className="mt-1 text-emerald-600" aria-label="ความสัมพันธ์ที่ตรวจสอบแล้ว" />{article.parties.map((party) => <span key={`${article.id}-${party.code}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-poliscope">{party.shortName || party.name}</span>)}</div>}
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

function ArticleDrawer({ article, onClose }) {
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

function App() {
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
      const params = party ? `?party=${encodeURIComponent(party)}` : "";
      const response = await fetch(`/api/news${params}`);
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

export default App;
