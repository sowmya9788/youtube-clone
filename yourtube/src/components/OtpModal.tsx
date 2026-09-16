import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/lib/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ShieldAlert, ShieldCheck, Mail, MapPin, Monitor, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

const OtpModal = () => {
  const { otpState, verifyOtp, resendOtp, cancelOtp } = useUser() as any;
  const [otpValue, setOtpValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (otpState?.isOpen) {
      setOtpValue("");
      setErrorMsg("");
      setCooldown(60);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [otpState?.isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpState?.isOpen && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpState?.isOpen, cooldown]);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    setOtpValue(val);
    setErrorMsg("");
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpValue.length !== 6) {
      setErrorMsg("Please enter a 6-digit verification code");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await verifyOtp(otpValue);
      toast.success(res?.message || "Login verified successfully! Welcome back.");
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || "Invalid or expired OTP code";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErrorMsg("");
    try {
      const res = await resendOtp();
      toast.success(res?.message || "New code sent to your email!");
      setCooldown(60);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || "Failed to resend code";
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  if (!otpState?.isOpen) return null;

  return (
    <Dialog open={otpState.isOpen} onOpenChange={(open) => !open && cancelOtp()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-white border dark:border-gray-800 p-6 rounded-2xl shadow-xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-14 h-14 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            New Device or Location Detected
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            To keep your account secure, we sent a 6-digit code to{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {otpState.email}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Security Details Card */}
        <div className="bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 my-2 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">
              <strong>Device:</strong> {otpState.device?.deviceName || "Web Browser"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">
              <strong>Location:</strong> {otpState.location?.city || "Unknown City"},{" "}
              {otpState.location?.state || "Unknown State"}
            </span>
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">
              Enter 6-Digit Security Code
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpValue}
                onChange={handleOtpChange}
                placeholder="• • • • • •"
                className="w-full text-center text-2xl font-mono tracking-[0.4em] py-3 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-900 dark:text-white focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="one-time-code"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            {errorMsg && (
              <p className="text-xs text-red-500 font-medium text-center">{errorMsg}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading || otpValue.length !== 6}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl shadow transition-colors"
            >
              {loading ? "Verifying Code..." : "Verify & Complete Sign In"}
            </Button>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1 pt-1">
              <span>Didn&apos;t receive the email?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className={`font-semibold transition-colors flex items-center gap-1 ${
                  cooldown > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </button>
            </div>
          </div>
        </form>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-1 flex justify-center">
          <button
            type="button"
            onClick={cancelOtp}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            Cancel Sign In
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtpModal;
