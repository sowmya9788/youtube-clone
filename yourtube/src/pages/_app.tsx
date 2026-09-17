import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import OtpModal from "@/components/OtpModal";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "../lib/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <title>YourTube</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>

      <div className="min-h-screen bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-white transition-colors">
        <Header />

        <Toaster richColors position="top-right" />

        <OtpModal />

        <div
          className="flex w-full"
          style={{ minHeight: "calc(100vh - 56px)" }}
        >
          <Sidebar />

          <main className="flex-1 min-w-0 overflow-x-hidden">
            <Component {...pageProps} />
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}