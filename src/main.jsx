import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="min-h-screen bg-canvas text-navy">
      <section className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-poliscope">POLISCOPE</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">เข้าใจข่าวการเมืองในไม่กี่นาที</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
            แพลตฟอร์มข่าวการเมืองที่รวบรวมข้อมูลจากแหล่งข่าวจริง พร้อมเครื่องมือสรุปข่าวภาษาไทยอย่างเป็นกลาง
          </p>
          <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-navy px-5 py-3 text-sm font-medium text-white shadow-soft">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            กำลังเตรียมพื้นที่ข่าวสำหรับคุณ
          </div>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
