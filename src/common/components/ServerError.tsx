import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, Home, RefreshCw } from "lucide-react";
import Header from "@/common/components/Header";
import Footer from "@/common/components/Footer";

type ErrorLike = {
  status?: unknown;
  statusCode?: unknown;
  response?: { status?: unknown };
  message?: unknown;
};

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  const value = error as ErrorLike;
  const candidates = [value.status, value.statusCode, value.response?.status];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && candidate >= 400) {
      return candidate;
    }
  }

  const message = typeof value.message === "string" ? value.message : "";
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function getErrorCopy(status: number | null) {
  if (status === 429) {
    return {
      code: "429",
      title: "Terlalu Banyak Permintaan",
      description:
        "Server membatasi jumlah permintaan untuk sementara. Tunggu beberapa saat lalu coba lagi.",
    };
  }

  if (status === 404) {
    return {
      code: "404",
      title: "Data Tidak Ditemukan",
      description:
        "Data yang diminta tidak tersedia di server sumber. Coba kembali ke beranda atau buka katalog komik.",
    };
  }

  if (status && status >= 500) {
    return {
      code: String(status),
      title: "Server Sedang Bermasalah",
      description: `Permintaan ke server gagal diproses (HTTP ${status}). Data mungkin sedang tidak tersedia. Coba lagi beberapa saat lagi.`,
    };
  }

  return {
    code: "500",
    title: "Server Sedang Bermasalah",
    description:
      "Permintaan ke server gagal diproses. Data mungkin sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  };
}

interface ServerErrorPanelProps {
  error: unknown;
  reset?: () => void;
  className?: string;
}

export function ServerErrorPanel({
  error,
  reset,
  className = "",
}: ServerErrorPanelProps) {
  const router = useRouter();
  const status = getErrorStatus(error);
  const copy = getErrorCopy(status);

  const handleRetry = () => {
    if (reset) {
      reset();
      return;
    }
    void router.invalidate();
  };

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`min-w-0 border border-[#27272e] bg-[#0c0c10] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#27272e] bg-[#101014] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider tabular-nums">
        <span className="text-[#f43f5e]">HTTP {copy.code}</span>
        <span className="text-[#c8c2b6]">SERVER ERROR</span>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#f43f5e]/40 bg-[#f43f5e]/10 text-[#f43f5e]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black uppercase tracking-tight text-[#f4f1ea] sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[#c8c2b6]">
              {copy.description}
            </p>
          </div>
        </div>

        {import.meta.env.DEV && error instanceof Error && error.message ? (
          <pre className="mt-5 overflow-auto whitespace-pre-wrap break-words border border-[#f43f5e]/30 bg-[#09090b] p-3 font-mono text-xs text-[#f43f5e]">
            {error.message}
          </pre>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-11 items-center gap-2 bg-[#be123c] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#f4f1ea] transition-colors hover:bg-[#9f1239]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Coba Lagi
          </button>

          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 border border-[#27272e] bg-[#141418] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#f4f1ea] transition-colors hover:border-[#f4f1ea]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Beranda
          </Link>

          <Link
            to="/home"
            className="inline-flex min-h-11 items-center gap-2 border border-[#27272e] bg-[#141418] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#c8c2b6] transition-colors hover:border-[#f4f1ea] hover:text-[#f4f1ea]"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Buka Katalog
          </Link>
        </div>
      </div>
    </section>
  );
}

interface ServerErrorPageProps {
  error: unknown;
  reset?: () => void;
}

export function ServerErrorInline({ error, reset }: ServerErrorPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#09090b] px-4 py-12 sm:px-6">
      <ServerErrorPanel
        error={error}
        reset={reset}
        className="w-full max-w-2xl"
      />
    </div>
  );
}

export default function ServerErrorPage({ error, reset }: ServerErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f1ea] selection:bg-[#be123c] selection:text-[#f4f1ea]">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <ServerErrorPanel
          error={error}
          reset={reset}
          className="w-full max-w-2xl"
        />
      </main>
      <Footer />
    </div>
  );
}
