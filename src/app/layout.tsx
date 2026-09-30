import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLens AI — Source-linked consultation support",
  description:
    "Synthetic prototype. Reconstructs context from patient-held evidence for Bangladesh clinics. Modular monolith per GP FutureMakers Full Architecture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <header className="border-b border-ink-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-500 text-white">
                <span className="font-semibold">M</span>
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">MedLens AI</p>
                <p className="text-xs leading-tight text-ink-500">
                  Source-linked consultation support · Configuration B demo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-accent-100 px-2 py-1 font-medium text-accent-700">
                Synthetic data
              </span>
              <span className="rounded-full bg-ink-100 px-2 py-1 font-medium text-ink-600">
                Architecture v1.0
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t border-ink-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-500">
            MedLens AI · GP FutureMakers competition prototype. Synthetic
            Rahima case only. No real-patient data. No clinical advice.
          </div>
        </footer>
      </body>
    </html>
  );
}