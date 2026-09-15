"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ShiftEvent } from "../lib/calendar";
import { toICS } from "../lib/calendar";
import { parseScheduleText } from "../lib/parser";

type Mode = "pdf" | "ocr" | "";

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<Mode>("");
  const [progress, setProgress] = useState(0);
  const [feedUrl, setFeedUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<{userId:string; email:string} | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setSession(d.session || null)).catch(() => {});
  });

  async function submitAuth(e: FormEvent) {
    e.preventDefault(); setAuthError("");
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка авторизации.");
      setSession({ userId: data.userId || "", email: data.email }); setPassword("");
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Ошибка авторизации."); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setSession(null); setEvents([]); setFeedUrl(""); }

  async function extractPdfText(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str ?? "").join("\n"));
    }

    return { text: pages.join("\n"), pdf };
  }

  async function renderPdfPagesToImages(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const images: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL("image/png"));
    }

    return images;
  }

  async function runOCR(images: string[]) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng+pol");
    let result = "";

    for (let i = 0; i < images.length; i++) {
      setStatus(`OCR: страница ${i + 1} из ${images.length}`);
      const ret = await worker.recognize(images[i]);
      result += "\n" + ret.data.text;
      setProgress(Math.round(((i + 1) / images.length) * 100));
    }

    await worker.terminate();
    return result;
  }

  async function handleFile(file?: File) {
    if (!file) return;

    setFileName(file.name);
    setEvents([]);
    setStatus("");
    setProgress(0);
    setMode("");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      if (!isPdf && !isImage) {
        throw new Error("Загрузи PDF, PNG или JPG.");
      }

      if (isImage) {
        setMode("ocr");
        setStatus("Запускаю OCR…");
        const text = await runOCR([URL.createObjectURL(file)]);
        const parsed = parseScheduleText(text);
        setEvents(parsed.events);
        setStatus(parsed.events.length
          ? `OCR завершён. Найдено смен: ${parsed.events.length}`
          : "OCR завершён, но смены не распознаны. Их можно будет добавить вручную в следующей версии."
        );
        return;
      }

      setStatus("Читаю текстовый слой PDF…");
      const { text } = await extractPdfText(file);
      const parsed = parseScheduleText(text);

      if (parsed.events.length > 0) {
        setMode("pdf");
        setEvents(parsed.events);
        setStatus(`Готово. Найдено смен: ${parsed.events.length}`);
        return;
      }

      setMode("ocr");
      setStatus("Текстового слоя недостаточно. Перехожу на OCR…");
      const images = await renderPdfPagesToImages(file);
      const ocrText = await runOCR(images);
      const ocrParsed = parseScheduleText(ocrText);
      setEvents(ocrParsed.events);
      setStatus(ocrParsed.events.length
        ? `OCR завершён. Найдено смен: ${ocrParsed.events.length}`
        : "OCR завершён, но таблица не распознана. Для таких PDF мы улучшим Amazon parser."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось обработать файл.");
    }
  }

  function downloadICS() {
    const ics = toICS(events, "Amazon Work");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "amazon-work-calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createAppleFeed() {
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Amazon Work", events })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать календарь.");

      setFeedUrl(data.webcalUrl);
      localStorage.setItem("work-calendar-feed", data.webcalUrl);
      setStatus("Готово. Создана персональная ссылка Apple Calendar.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setSaving(false);
    }
  }

  function removeEvent(index: number) {
    setEvents(prev => prev.filter((_, i) => i !== index));
  }

  function updateEvent(index: number, field: keyof ShiftEvent, value: string) {
    setEvents(prev => prev.map((event, i) => i === index ? { ...event, [field]: value } : event));
  }

  if (!session) {
    return (
      <main className="container">
        <header className="header">
          <span className="badge">Amazon POZ2 • Apple Calendar</span>
          <h1>Work Calendar</h1>
          <p className="subtitle">Личный календарь смен</p>
        </header>
        <section className="card" style={{maxWidth:520, margin:"0 auto"}}>
          <h2>{authMode === "login" ? "Вход" : "Регистрация"}</h2>
          <form onSubmit={submitAuth}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{width:"100%",marginBottom:10}} />
            <input type="password" placeholder="Пароль (минимум 8 символов)" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} style={{width:"100%",marginBottom:10}} />
            {authError && <p className="error">{authError}</p>}
            <button className="primary" type="submit" style={{width:"100%"}}>{authMode === "login" ? "Войти" : "Создать аккаунт"}</button>
          </form>
          <div className="actions" style={{justifyContent:"center"}}>
            <button className="secondary" onClick={()=>{setAuthMode(authMode === "login" ? "register" : "login");setAuthError("")}}>{authMode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}</button>
          </div>
          <p className="muted" style={{marginTop:16}}>Google/Apple OAuth можно подключить после базовой авторизации, через провайдеров Auth.js.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <span className="badge">Amazon POZ2 • Apple Calendar</span>
        <h1>Work Calendar</h1>
        <p className="subtitle">PDF или фото графика → OCR → проверка → календарь</p>
        <div className="actions" style={{justifyContent:"center",marginTop:12}}><span className="muted">👤 {session.email}</span><button className="secondary" onClick={logout}>Выйти</button></div>
      </header>

      <section
        className={`card drop ${drag ? "drag" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
      >
        <div style={{ fontSize: 48 }}>📄</div>
        <h2>Загрузи график</h2>
        <p className="muted">Поддерживаются PDF, PNG и JPG. Если PDF является сканом, автоматически включится OCR.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <button className="primary" onClick={() => input.current?.click()}>Выбрать файл</button>
          <input
            ref={input}
            hidden
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
        {fileName && <p className="muted">Файл: {fileName}</p>}
        {mode && <p className="muted">Режим: {mode === "ocr" ? "OCR распознавание" : "Чтение текста PDF"}</p>}
        {progress > 0 && progress < 100 && <p className="muted">Прогресс OCR: {progress}%</p>}
        {status && <p className={events.length ? "ok" : "error"}>{status}</p>}
      </section>

      {events.length > 0 && (
        <section className="card">
          <h2>Проверка графика</h2>
          <p className="muted">Выходные не добавляются. Здесь можно вручную исправить дату или время перед экспортом.</p>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Начало</th>
                  <th>Конец</th>
                  <th>Тип</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.date}-${event.start}-${index}`}>
                    <td>
                      <input value={event.date} onChange={e => updateEvent(index, "date", e.target.value)} />
                    </td>
                    <td>
                      <input value={event.start} onChange={e => updateEvent(index, "start", e.target.value)} />
                    </td>
                    <td>
                      <input value={event.end} onChange={e => updateEvent(index, "end", e.target.value)} />
                    </td>
                    <td>{event.end < event.start ? "🌙 Ночная" : "☀️ Дневная"}</td>
                    <td>
                      <button className="secondary" onClick={() => removeEvent(index)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions">
            <button className="primary" onClick={downloadICS}>📅 Скачать .ics</button>
            <button className="primary" onClick={createAppleFeed} disabled={saving}>
              {saving ? "Создаю…" : "🍎 Создать Apple Calendar"}
            </button>
            <button className="secondary" onClick={() => setEvents([])}>Очистить</button>
          </div>
        </section>
      )}

      {feedUrl && (
        <section className="card">
          <h2>Подписка Apple Calendar</h2>
          <p className="muted">Скопируй эту ссылку и вставь в iPhone: Календарь → Календари → Добавить → Добавить подписной календарь.</p>
          <input type="text" readOnly value={feedUrl} onFocus={e => e.currentTarget.select()} style={{ width: "100%" }} />
          <div className="actions">
            <button className="secondary" onClick={() => navigator.clipboard?.writeText(feedUrl)}>Скопировать ссылку</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Следующий этап</h2>
        <p className="muted">
          Теперь OCR уже встроен. Дальше мы улучшим именно Amazon parser, чтобы он понимал сетку календаря даже когда OCR возвращает текст в неправильном порядке.
        </p>
      </section>
    </main>
  );
}
