"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ShiftEvent } from "../lib/calendar";
import { toICS } from "../lib/calendar";
import { extractScheduleCode, extractSchedulePeriod, extractScheduleSummary, parseScheduleText, type ScheduleSummary } from "../lib/parser";

type Mode = "pdf" | "ocr" | "";
type Language = "ru" | "uk" | "en" | "pl";
type ParsedSchedule = {
  id: string;
  name: string;
  events: ShiftEvent[];
  summary: ScheduleSummary | null;
  month: number | null;
  year: number | null;
  token?: string;
};

type SavedCalendar = {
  token: string;
  name: string;
  month: number | null;
  year: number | null;
  eventCount: number;
  events: ShiftEvent[];
};

type Profile = {
  name: string;
  avatar: string | null;
  language: Language;
};

const uiCopy: Record<Language, { signIn: string; register: string; forgot: string; settings: string; library: string; workspace: string; upload: string; savedMonths: string; pdfSchedules: string; review: string; save: string; close: string; cancel: string; delete: string; open: string; logout: string; email: string; password: string; newPassword: string; resetPassword: string; chooseFile: string; supportedPdf: string; calendarName: string; appleCalendar: string; download: string }> = {
  ru: { signIn: "Войти", register: "Создать аккаунт", forgot: "Забыли пароль?", settings: "Настройки", library: "Библиотека", workspace: "Рабочая область", upload: "Загрузить график", savedMonths: "Сохранённые месяцы", pdfSchedules: "Графики в PDF", review: "Проверка графика", save: "Сохранить", close: "Закрыть", cancel: "Отмена", delete: "Удалить", open: "Открыть", logout: "Выйти", email: "Email", password: "Пароль", newPassword: "Новый пароль", resetPassword: "Восстановление пароля", chooseFile: "Выбрать PDF", supportedPdf: "Поддерживается только PDF", calendarName: "Название календаря", appleCalendar: "Подписка Apple Calendar", download: "Скачать .ics" },
  uk: { signIn: "Увійти", register: "Створити акаунт", forgot: "Забули пароль?", settings: "Налаштування", library: "Бібліотека", workspace: "Робоча область", upload: "Завантажити графік", savedMonths: "Збережені місяці", pdfSchedules: "Графіки в PDF", review: "Перевірка графіка", save: "Зберегти", close: "Закрити", cancel: "Скасувати", delete: "Видалити", open: "Відкрити", logout: "Вийти", email: "Email", password: "Пароль", newPassword: "Новий пароль", resetPassword: "Відновлення пароля", chooseFile: "Обрати PDF", supportedPdf: "Підтримується лише PDF", calendarName: "Назва календаря", appleCalendar: "Підписка Apple Calendar", download: "Завантажити .ics" },
  en: { signIn: "Sign in", register: "Create account", forgot: "Forgot password?", settings: "Settings", library: "Library", workspace: "Workspace", upload: "Upload schedule", savedMonths: "Saved months", pdfSchedules: "PDF schedules", review: "Schedule review", save: "Save", close: "Close", cancel: "Cancel", delete: "Delete", open: "Open", logout: "Sign out", email: "Email", password: "Password", newPassword: "New password", resetPassword: "Password recovery", chooseFile: "Choose PDF", supportedPdf: "PDF files only", calendarName: "Calendar name", appleCalendar: "Apple Calendar subscription", download: "Download .ics" },
  pl: { signIn: "Zaloguj się", register: "Utwórz konto", forgot: "Nie pamiętasz hasła?", settings: "Ustawienia", library: "Biblioteka", workspace: "Obszar pracy", upload: "Prześlij grafik", savedMonths: "Zapisane miesiące", pdfSchedules: "Grafiki PDF", review: "Sprawdzenie grafiku", save: "Zapisz", close: "Zamknij", cancel: "Anuluj", delete: "Usuń", open: "Otwórz", logout: "Wyloguj", email: "Email", password: "Hasło", newPassword: "Nowe hasło", resetPassword: "Odzyskiwanie hasła", chooseFile: "Wybierz PDF", supportedPdf: "Obsługiwane są tylko pliki PDF", calendarName: "Nazwa kalendarza", appleCalendar: "Subskrypcja Apple Calendar", download: "Pobierz .ics" }
};

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [schedules, setSchedules] = useState<ParsedSchedule[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState("");
  const [savedCalendars, setSavedCalendars] = useState<SavedCalendar[]>([]);
  const [calendarName, setCalendarName] = useState("");
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
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [profile, setProfile] = useState<Profile>({ name: "", avatar: null, language: "ru" });
  const [view, setView] = useState<"workspace" | "library">("workspace");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "ok" | "error" } | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [avatarInput, setAvatarInput] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setSession(d.session || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/calendars")
      .then(response => response.ok ? response.json() : { calendars: [] })
      .then(data => setSavedCalendars(data.calendars || []))
      .catch(() => setSavedCalendars([]));
  }, [session?.userId]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset");
    if (token) setResetToken(token);
  }, []);

  const copy = uiCopy[profile.language];

  useEffect(() => {
    if (!session) return;
    fetch("/api/profile")
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.profile) return;
        setProfile({ name: data.profile.name || "", avatar: data.profile.avatar || null, language: data.profile.language || "ru" });
      })
      .catch(() => {});
  }, [session?.userId]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault(); setAuthError("");
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка авторизации.");
      if (data.verificationRequired) {
        setVerificationEmail(email.trim().toLowerCase());
        setAuthError("Аккаунт создан. Проверь почту и перейди по ссылке подтверждения.");
        setPassword("");
        return;
      }
      setSession({ userId: data.userId || "", email: data.email }); setPassword("");
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Ошибка авторизации."); }
  }

  function notify(message: string, type: "ok" | "error" = "ok") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault();
    setForgotStatus("");
    const response = await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) });
    const data = await response.json();
    setForgotStatus(response.ok ? data.message : data.error || "Не удалось отправить письмо.");
  }

  async function resetPasswordRequest(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: resetToken, password: resetPassword }) });
    const data = await response.json();
    setResetStatus(response.ok ? "Пароль изменён. Теперь можно войти." : data.error || "Не удалось изменить пароль.");
    if (response.ok) window.history.replaceState({}, "", window.location.pathname);
  }

  async function resendVerification() {
    setResendStatus("");
    const response = await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: verificationEmail })
    });
    const data = await response.json();
    setResendStatus(response.ok ? "Письмо отправлено повторно." : data.error || "Не удалось отправить письмо.");
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setSession(null); setEvents([]); setFeedUrl(""); }

  function openSettings() {
    setProfileName(profile.name);
    setCurrentPassword("");
    setNewPassword("");
    setProfileStatus("");
    setSettingsOpen(true);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileStatus("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: profileName, avatar: avatarInput ?? profile.avatar, currentPassword, newPassword })
    });
    const data = await response.json();
    if (!response.ok) {
      setProfileStatus(data.error || "Не удалось сохранить профиль.");
      return;
    }
    setProfile({ name: data.profile.name, avatar: data.profile.avatar, language: data.profile.language || profile.language });
    setAvatarInput(null);
    setCurrentPassword("");
    setNewPassword("");
    setProfileStatus("Профиль сохранён.");
    notify("Профиль сохранён.");
  }

  async function changeLanguage(language: Language) {
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: profile.name, avatar: profile.avatar, language }) });
    if (response.ok) {
      setProfile(current => ({ ...current, language }));
      notify("Язык интерфейса сохранён.");
    }
  }

  function readAvatar(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarInput(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function extractPdfText(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    const timePattern = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/;
    const dayPattern = /^([1-9]|[12]\d|3[01])$/;
    const monthPattern = /20\d{2}|styczeń|lut(y|ego)|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień|january|february|march|april|may|june|july|august|september|october|november|december/i;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .map((item: any) => ({
          text: String(item.str ?? "").trim(),
          x: Number(item.transform?.[4] ?? 0),
          y: Number(item.transform?.[5] ?? 0)
        }))
        .filter((item: { text: string }) => item.text);

      const days = items.filter(item => dayPattern.test(item.text));
      const times = items.filter(item => timePattern.test(item.text));
      const pairs: string[] = [];

      for (const time of times) {
        const match = time.text.match(timePattern);
        if (!match) continue;

        const day = days
          .filter(candidate => candidate.y > time.y && candidate.y - time.y < 100)
          .sort((a, b) => {
            const aScore = Math.abs(a.x - time.x) + (a.y - time.y) * 0.25;
            const bScore = Math.abs(b.x - time.x) + (b.y - time.y) * 0.25;
            return aScore - bScore;
          })[0];

        if (day && Math.abs(day.x - time.x) < 60) {
          pairs.push(`${day.text} ${match[1]}-${match[2]}`);
        }
      }

      const metadata = items
        .map(item => item.text)
        .filter(text => monthPattern.test(text))
        .join(" ");
      const code = extractScheduleCode(items.map(item => item.text).join("\n"));
      const summaryNumbers = items
        .map(item => item.text)
        .filter(text => /^\d+$/.test(text))
        .slice(-3)
        .join(" ");

      pages.push(pairs.length
        ? `${metadata}\n${code}\n${pairs.join("\n")}\n${summaryNumbers}`
        : items.map(item => item.text).join("\n"));
    }

    return { text: pages.join("\n"), pages, pdf };
  }

  function buildSchedules(pages: string[]) {
    return pages
      .map((pageText, index) => {
        const parsed = parseScheduleText(pageText);
        if (!parsed.events.length) return null;
        const code = extractScheduleCode(pageText);
        const period = extractSchedulePeriod(pageText);
        return {
          id: `${code}-${index + 1}`,
          name: `${code} · ${period ? `${String(period.month).padStart(2, "0")}.${period.year}` : `Страница ${index + 1}`}`,
          events: parsed.events,
          summary: extractScheduleSummary(pageText),
          month: period?.month || null,
          year: period?.year || null
        };
      })
      .filter((schedule): schedule is ParsedSchedule => Boolean(schedule));
  }

  function selectSchedule(schedule: ParsedSchedule) {
    setActiveScheduleId(schedule.id);
    setEvents(schedule.events);
    setCalendarName(schedule.name);
    setFeedUrl("");
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

  async function prepareImageForOCR(dataUrl: string, threshold: number | null) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось прочитать изображение для OCR."));
      image.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен.");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    if (threshold === null) return canvas.toDataURL("image/png");

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const value = gray > 180 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function runOCR(images: string[]) {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng+pol");
    let result = "";

    for (let i = 0; i < images.length; i++) {
      setStatus(`OCR: страница ${i + 1} из ${images.length}`);
      // Keep the original colors as well as a high-contrast version: colored
      // calendar cells can lose characters during thresholding.
      for (const threshold of [null, 180]) {
        const prepared = await prepareImageForOCR(images[i], threshold);

        // Calendar screenshots need both block and sparse-text segmentation.
        for (const pageSegMode of [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT]) {
          await worker.setParameters({ tessedit_pageseg_mode: pageSegMode });
          const ret = await worker.recognize(prepared);
          result += "\n" + ret.data.text;
        }
      }

      setProgress(Math.round(((i + 1) / images.length) * 100));
    }

    await worker.terminate();
    return result;
  }

  async function handleFile(file?: File) {
    if (!file) return;

    setFileName(file.name);
    setEvents([]);
    setSchedules([]);
    setActiveScheduleId("");
    setStatus("");
    setProgress(0);
    setMode("");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        throw new Error("Загрузи файл в формате PDF.");
      }

      setStatus("Читаю текстовый слой PDF…");
      const { text, pages } = await extractPdfText(file);
      const parsedSchedules = buildSchedules(pages);

      if (parsedSchedules.length > 0) {
        setMode("pdf");
        setSchedules(parsedSchedules);
        selectSchedule(parsedSchedules[0]);
        setStatus(`Готово. Найдено графиков: ${parsedSchedules.length}`);
        return;
      }

      setMode("ocr");
      setStatus("Текстового слоя недостаточно. Перехожу на OCR…");
      const images = await renderPdfPagesToImages(file);
      const ocrText = await runOCR(images);
      const ocrParsed = parseScheduleText(ocrText);
      const fallbackSchedule = {
        id: "ocr-1",
        name: "График из OCR",
        events: ocrParsed.events,
        summary: extractScheduleSummary(ocrText),
        month: extractSchedulePeriod(ocrText)?.month || null,
        year: extractSchedulePeriod(ocrText)?.year || null
      };
      setSchedules(ocrParsed.events.length ? [fallbackSchedule] : []);
      setActiveScheduleId(ocrParsed.events.length ? fallbackSchedule.id : "");
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
      const schedule = schedules.find(item => item.id === activeScheduleId);
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: calendarName || schedule?.name || "Amazon Work",
          month: schedule?.month,
          year: schedule?.year,
          events
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать календарь.");

      setFeedUrl(data.webcalUrl);
      if (schedule) {
        setSchedules(current => current.map(item => item.id === schedule.id ? { ...item, token: data.token, name: calendarName || item.name } : item));
      }
      await refreshSavedCalendars();
      localStorage.setItem("work-calendar-feed", data.webcalUrl);
      setStatus("Готово. Создана персональная ссылка Apple Calendar.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setSaving(false);
    }
  }

  function openSaveModal() {
    const schedule = schedules.find(item => item.id === activeScheduleId);
    setCalendarName(calendarName || schedule?.name || "Amazon Work");
    setSaveOpen(true);
  }

  async function refreshSavedCalendars() {
    const response = await fetch("/api/calendars");
    if (response.ok) {
      const data = await response.json();
      setSavedCalendars(data.calendars || []);
    }
  }

  async function saveActiveCalendar() {
    const schedule = schedules.find(item => item.id === activeScheduleId);
    if (!schedule?.token) return createAppleFeed();

    setSaving(true);
    try {
      const response = await fetch(`/api/calendars/${schedule.token}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: calendarName || schedule.name, events })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить календарь.");
      setSchedules(current => current.map(item => item.id === schedule.id ? { ...item, name: calendarName || item.name } : item));
      await refreshSavedCalendars();
      setStatus("Изменения сохранены.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSavedCalendar(token: string) {
    try {
      const response = await fetch(`/api/calendars/${token}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить календарь.");
      setSavedCalendars(current => current.filter(calendar => calendar.token !== token));
      setSchedules(current => current.map(schedule => schedule.token === token ? { ...schedule, token: undefined } : schedule));
      setStatus("Календарь удалён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка удаления.");
    }
  }

  function loadSavedCalendar(calendar: SavedCalendar) {
    const schedule: ParsedSchedule = {
      id: `saved-${calendar.token}`,
      name: calendar.name,
      events: calendar.events || [],
      summary: null,
      month: calendar.month,
      year: calendar.year,
      token: calendar.token
    };
    setSchedules(current => [...current.filter(item => item.id !== schedule.id), schedule]);
    selectSchedule(schedule);
  }

  function removeEvent(index: number) {
    setEvents(prev => {
      const next = prev.filter((_, i) => i !== index);
      setSchedules(current => current.map(schedule => schedule.id === activeScheduleId ? { ...schedule, events: next } : schedule));
      return next;
    });
  }

  function updateEvent(index: number, field: keyof ShiftEvent, value: string) {
    setEvents(prev => {
      const next = prev.map((event, i) => i === index ? { ...event, [field]: value } : event);
      setSchedules(current => current.map(schedule => schedule.id === activeScheduleId ? { ...schedule, events: next } : schedule));
      return next;
    });
  }

  if (!session) {
    return (
      <main className="container">
        <header className="header simple-header"><h1>Work Calendar</h1></header>
        <section className="card" style={{maxWidth:520, margin:"0 auto"}}>
          <h2>{authMode === "login" ? copy.signIn : copy.register}</h2>
          <form onSubmit={submitAuth}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={{width:"100%",marginBottom:10}} />
            <input type="password" placeholder="Пароль (минимум 8 символов)" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} style={{width:"100%",marginBottom:10}} />
            {authError && <p className="error">{authError}</p>}
            {verificationEmail && <button type="button" className="secondary" onClick={resendVerification}>Отправить письмо ещё раз</button>}
            {resendStatus && <p className={resendStatus.startsWith("Письмо") ? "ok" : "error"}>{resendStatus}</p>}
            <button className="primary" type="submit" style={{width:"100%"}}>{authMode === "login" ? copy.signIn : copy.register}</button>
          </form>
          {authMode === "login" && <button className="link-button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }}>{copy.forgot}</button>}
          <div className="actions" style={{justifyContent:"center"}}>
            <button className="secondary" onClick={()=>{setAuthMode(authMode === "login" ? "register" : "login");setAuthError("")}}>{authMode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}</button>
          </div>
        </section>
        {forgotOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setForgotOpen(false)}><section className="modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="section-kicker">Безопасный доступ</span><h2>{copy.resetPassword}</h2></div><button className="icon-button" onClick={() => setForgotOpen(false)} aria-label={copy.close}>×</button></div><form onSubmit={requestPasswordReset}><label className="field-label">{copy.email}<input type="email" value={forgotEmail} onChange={event => setForgotEmail(event.target.value)} required autoFocus /></label><p className="muted">Мы отправим ссылку для создания нового пароля.</p>{forgotStatus && <p className="ok">{forgotStatus}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setForgotOpen(false)}>{copy.close}</button><button className="primary">Отправить ссылку</button></div></form></section></div>}
        {resetToken && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="section-kicker">{copy.newPassword}</span><h2>Создать пароль</h2></div><button className="icon-button" onClick={() => { setResetToken(""); window.history.replaceState({}, "", window.location.pathname); }} aria-label={copy.close}>×</button></div><form onSubmit={resetPasswordRequest}><label className="field-label">{copy.newPassword}<input type="password" minLength={8} value={resetPassword} onChange={event => setResetPassword(event.target.value)} required autoFocus /></label>{resetStatus && <p className={resetStatus.startsWith("Пароль") ? "ok" : "error"}>{resetStatus}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => { setResetToken(""); window.history.replaceState({}, "", window.location.pathname); }}>{copy.cancel}</button><button className="primary">{copy.save}</button></div></form></section></div>}
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header simple-header">
        <h1>Work Calendar</h1>
        <div className="header-actions">
          <button className="user-chip user-button" onClick={() => setProfileMenuOpen(open => !open)} aria-expanded={profileMenuOpen}>
            {profile.avatar ? <img src={profile.avatar} alt="" /> : <span className="avatar-placeholder">{(profile.name || session.email).slice(0, 1).toUpperCase()}</span>}
          </button>
          {profileMenuOpen && <div className="profile-menu"><strong>{profile.name || session.email}</strong><button onClick={openSettings}>{copy.settings}</button><button onClick={logout}>Выйти</button></div>}
        </div>
        <nav className="main-nav" aria-label="Навигация"><button className={view === "workspace" ? "nav-link active" : "nav-link"} onClick={() => setView("workspace")}>{copy.workspace}</button><button className={view === "library" ? "nav-link active" : "nav-link"} onClick={() => setView("library")}>{copy.library}</button></nav>
      </header>

      {view === "library" && savedCalendars.length > 0 && (
        <section className="saved-menu">
          <div className="saved-menu-heading">
            <div>
              <span className="section-kicker">Библиотека</span>
              <h2>{copy.savedMonths}</h2>
            </div>
            <span className="saved-count">{savedCalendars.length} графиков</span>
          </div>
          <div className="saved-list">
            {[...savedCalendars].sort((a, b) => `${b.year || 0}-${b.month || 0}`.localeCompare(`${a.year || 0}-${a.month || 0}`)).map((calendar, index, all) => {
              const group = `${calendar.year || "Без года"}-${calendar.month || 0}`;
              const previous = index > 0 ? `${all[index - 1].year || "Без года"}-${all[index - 1].month || 0}` : "";
              return <div key={calendar.token}>{group !== previous && <div className="library-group">{calendar.month ? `Месяц ${String(calendar.month).padStart(2, "0")}.${calendar.year}` : "Без даты"}</div>}<div className="saved-row"><div className="saved-row-main"><span className="month-mark">{calendar.month ? String(calendar.month).padStart(2, "0") : "--"}</span><div><strong>{calendar.name}</strong><span className="saved-meta">{calendar.year || "Без года"} · {calendar.eventCount} смен</span></div></div><div className="saved-row-actions"><button className="secondary compact" onClick={() => { loadSavedCalendar(calendar); setView("workspace"); }}>Открыть</button><button className="danger-button" onClick={() => deleteSavedCalendar(calendar.token)} aria-label={`Удалить ${calendar.name}`}>Удалить</button></div></div></div>;
            })}
          </div>
        </section>
      )}

      {view === "workspace" && <section
        className={`card drop ${drag ? "drag" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
      >
        <div style={{ fontSize: 48 }}>📄</div>
        <h2>{copy.upload}</h2>
        <p className="muted">{copy.supportedPdf}. Если PDF является сканом, автоматически включится OCR.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <button className="primary" onClick={() => input.current?.click()}>{copy.chooseFile}</button>
          <input
            ref={input}
            hidden
            type="file"
            accept="application/pdf,.pdf"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
        {fileName && <p className="muted">Файл: {fileName}</p>}
        {mode && <p className="muted">Режим: {mode === "ocr" ? "OCR распознавание" : "Чтение текста PDF"}</p>}
        {progress > 0 && progress < 100 && <p className="muted">Прогресс OCR: {progress}%</p>}
        {status && <p className={events.length ? "ok" : "error"}>{status}</p>}
      </section>}

      {view === "workspace" && schedules.length > 1 && (
        <section className="card">
          <h2>{copy.pdfSchedules}</h2>
          <p className="muted">Каждая страница PDF распознана как отдельный календарь. Выбери график для проверки и создания своей ссылки Apple Calendar.</p>
          <div className="actions">
            {schedules.map(schedule => {
              const selected = schedule.id === activeScheduleId;
              const expected = schedule.summary?.total;
              const actual = schedule.events.length;
              return (
                <button
                  key={schedule.id}
                  className={selected ? "primary" : "secondary"}
                  onClick={() => selectSchedule(schedule)}
                >
                  {schedule.name} · {actual}{expected ? `/${expected}` : ""}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === "workspace" && events.length > 0 && (
        <section className="card">
          <h2>{copy.review}</h2>
          <p className="muted">Выходные не добавляются. Здесь можно вручную исправить дату или время перед экспортом.</p>
          <label className="muted" style={{ display: "block", marginBottom: 12 }}>
            {copy.calendarName}
            <input value={calendarName} onChange={e => setCalendarName(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          </label>
          {(() => {
            const active = schedules.find(schedule => schedule.id === activeScheduleId);
            if (!active?.summary) return null;
            const dayCount = events.filter(event => event.kind === "day").length;
            const nightCount = events.filter(event => event.kind === "night").length;
            const matches = events.length === active.summary.total
              && dayCount === active.summary.day
              && nightCount === active.summary.night;
            return (
              <p className={matches ? "ok" : "error"}>
                {matches ? "✓ " : "⚠ "}Найдено {events.length} из {active.summary.total} смен · дневных {dayCount}/{active.summary.day}, ночных {nightCount}/{active.summary.night}
              </p>
            );
          })()}

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
            <button className="primary" onClick={downloadICS}>📅 {copy.download}</button>
            <button className="primary" onClick={() => schedules.find(item => item.id === activeScheduleId)?.token ? saveActiveCalendar() : openSaveModal()} disabled={saving}>
              {saving ? "Сохраняю…" : schedules.find(item => item.id === activeScheduleId)?.token ? "💾 Сохранить изменения" : "💾 Сохранить график"}
            </button>
            <button className="secondary" onClick={() => setEvents([])}>Очистить</button>
          </div>
        </section>
      )}

      {view === "workspace" && feedUrl && (
        <section className="card">
          <h2>{copy.appleCalendar}</h2>
          <p className="muted">Скопируй эту ссылку и вставь в iPhone: Календарь → Календари → Добавить → Добавить подписной календарь.</p>
          <input type="text" readOnly value={feedUrl} onFocus={e => e.currentTarget.select()} style={{ width: "100%" }} />
          <div className="actions">
            <button className="secondary" onClick={() => navigator.clipboard?.writeText(feedUrl)}>Скопировать ссылку</button>
          </div>
        </section>
      )}

      {saveOpen && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setSaveOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title">
            <div className="modal-heading"><div><span className="section-kicker">Новый календарь</span><h2 id="save-title">Сохранить график</h2></div><button className="icon-button" onClick={() => setSaveOpen(false)} aria-label="Закрыть">×</button></div>
            <label className="field-label">Название<input value={calendarName} onChange={event => setCalendarName(event.target.value)} autoFocus /></label>
            <p className="muted">График будет сохранён на сервере вместе с месяцем и годом из PDF.</p>
            <div className="modal-actions"><button className="secondary" onClick={() => setSaveOpen(false)}>Отмена</button><button className="primary" onClick={() => { setSaveOpen(false); void createAppleFeed(); }}>Сохранить</button></div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setSettingsOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading"><div><span className="section-kicker">Аккаунт</span><h2 id="settings-title">Настройки профиля</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Закрыть">×</button></div>
            <form onSubmit={saveProfile}>
              <div className="profile-preview">{avatarInput || profile.avatar ? <img src={avatarInput || profile.avatar || ""} alt="Аватар" /> : <span>{(profile.name || session.email).slice(0, 1).toUpperCase()}</span>}<label className="secondary file-button">Изменить аватар<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => readAvatar(event.target.files?.[0])} /></label></div>
              <label className="field-label">Имя<input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="Как к тебе обращаться" /></label>
              <label className="field-label">Язык интерфейса<select value={profile.language} onChange={event => void changeLanguage(event.target.value as Language)}><option value="ru">Русский</option><option value="uk">Українська</option><option value="en">English</option><option value="pl">Polski</option></select></label>
              <div className="settings-divider">Смена пароля</div>
              <label className="field-label">Текущий пароль<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
              <label className="field-label">Новый пароль<input type="password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Минимум 8 символов" /></label>
              {profileStatus && <p className={profileStatus === "Профиль сохранён." ? "ok" : "error"}>{profileStatus}</p>}
              <div className="modal-actions"><button type="button" className="secondary" onClick={() => setSettingsOpen(false)}>Закрыть</button><button type="submit" className="primary">Сохранить профиль</button></div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}
