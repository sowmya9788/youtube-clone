import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import Videocard from "@/components/videocard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Crown,
  Check,
  Zap,
  Shield,
  Star,
  Download,
  Play,
  Eye,
  PlaySquare,
  Users,
  ExternalLink,
  Tv,
} from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------
   Type declaration for Razorpay (loaded via CDN script tag)
------------------------------------------------------------------ */
declare global {
  interface Window {
    Razorpay: any;
  }
}

/* ------------------------------------------------------------------
   Plan catalogue (keep in sync with server/controllers/payment.js)
------------------------------------------------------------------ */
const PLANS = [
  {
    id: "free",
    label: "Free",
    price: 0,
    priceLabel: "₹0",
    period: "forever",
    color: "from-gray-500 to-gray-600",
    borderColor: "border-gray-200 dark:border-gray-700",
    icon: Play,
    iconColor: "text-gray-500",
    features: [
      "1 video download per day",
      "Standard video quality",
      "Access to public content",
      "Basic watch history",
    ],
    restrictions: [
      "Ads shown",
      "Limited premium content",
      "No priority support",
    ],
    cta: "Current Plan",
    isPaid: false,
  },
  {
    id: "bronze",
    label: "Bronze",
    price: 99,
    priceLabel: "₹99",
    period: "one-time",
    color: "from-orange-500 to-amber-600",
    borderColor: "border-orange-300 dark:border-orange-500/50",
    icon: Zap,
    iconColor: "text-orange-500",
    features: [
      "3 video downloads per day",
      "HD video quality",
      "Access to standard premium content",
      "Full watch history",
      "Priority comment visibility",
    ],
    restrictions: ["Reduced ads", "Some premium content locked"],
    cta: "Upgrade to Bronze",
    isPaid: true,
  },
  {
    id: "silver",
    label: "Silver",
    price: 199,
    priceLabel: "₹199",
    period: "one-time",
    color: "from-slate-500 to-slate-700",
    borderColor: "border-slate-300 dark:border-slate-600",
    icon: Shield,
    iconColor: "text-slate-500",
    features: [
      "10 video downloads per day",
      "Full HD & 4K video quality",
      "Full access to premium content",
      "Minimal ads",
      "Offline watch support",
      "Early access to new features",
    ],
    restrictions: [],
    cta: "Upgrade to Silver",
    isPaid: true,
    popular: true,
  },
  {
    id: "gold",
    label: "Gold",
    price: 499,
    priceLabel: "₹499",
    period: "one-time",
    color: "from-amber-500 to-yellow-500",
    borderColor: "border-yellow-400 dark:border-yellow-500/60",
    icon: Crown,
    iconColor: "text-yellow-500",
    features: [
      "Unlimited video downloads",
      "4K Ultra HD quality",
      "Full access to ALL premium content",
      "Completely ad-free",
      "Offline watch support",
      "Priority customer support",
      "Early access to beta features",
      "Exclusive Gold badge on profile",
    ],
    restrictions: [],
    cta: "Upgrade to Gold",
    isPaid: true,
  },
];

/* ------------------------------------------------------------------
   Plan tier hierarchy — used to determine if user can "downgrade"
------------------------------------------------------------------ */
const PLAN_RANK: Record<string, number> = {
  free: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

/* ------------------------------------------------------------------
   Helper — load Razorpay checkout script once
------------------------------------------------------------------ */
const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/* ================================================================
   SUBSCRIPTION PAGE
================================================================ */
export default function SubscriptionPage() {
  const router = useRouter();
  const { user, refreshUser, subscriptions, toggleSubscribe } = useUser() as any;
  const [activeTab, setActiveTab] = useState<"channels" | "plans">("channels");
  const [subscribedVideos, setSubscribedVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  /* Sync activeTab from query param if provided */
  useEffect(() => {
    if (router.query.tab === "plans") {
      setActiveTab("plans");
    } else if (router.query.tab === "channels") {
      setActiveTab("channels");
    }
  }, [router.query.tab]);

  /* Load subscribed videos on mount and when subscriptions change */
  useEffect(() => {
    if (!user?._id) {
      setSubscribedVideos([]);
      return;
    }
    setLoadingVideos(true);
    axiosInstance
      .get(`/subscription/user/${user._id}`)
      .then((res) => {
        setSubscribedVideos(res.data.videos || []);
      })
      .catch((err) => {
        console.warn("Could not fetch subscribed videos:", err?.message);
      })
      .finally(() => setLoadingVideos(false));
  }, [user?._id, subscriptions?.length]);

  /* Unsubscribe from channel */
  const handleUnsubscribe = async (sub: any) => {
    const channelId = sub.channel?._id || sub.channel;
    const channelName =
      sub.channel?.channelname || sub.channel?.name || sub.channelName;
    setUnsubscribingId(sub._id || channelName);
    try {
      await toggleSubscribe({ channelId, channelName });
    } finally {
      setUnsubscribingId(null);
    }
  };

  /* Load payment history on mount */
  useEffect(() => {
    if (!user?._id) return;
    setLoadingHistory(true);
    axiosInstance
      .get(`/payment/status/${user._id}`)
      .then((res) => setPaymentHistory(res.data.payments || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user?._id]);

  /* ----------------------------------------------------------------
     handleUpgrade — opens Razorpay checkout for the selected plan
  ---------------------------------------------------------------- */
  const handleUpgrade = async (planId: string) => {
    if (!user) {
      toast.error("Please sign in to upgrade your plan.");
      return;
    }

    setProcessingPlan(planId);

    try {
      /* 1. Load Razorpay script */
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        setProcessingPlan(null);
        return;
      }

      /* 2. Create order on backend */
      const orderRes = await axiosInstance.post("/payment/create-order", {
        userId: user._id,
        plan: planId,
      });

      const { orderId, amount, currency, keyId, planLabel } = orderRes.data;

      /* 3. Open Razorpay checkout */
      const options = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "YourTube",
        description: `${planLabel} Plan Subscription`,
        order_id: orderId,
        prefill: {
          name: user.name || "",
          email: user.email || "",
        },
        theme: {
          color: "#dc2626",
        },
        handler: async (response: any) => {
          /* 4. Verify payment on backend */
          try {
            const verifyRes = await axiosInstance.post("/payment/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              userId: user._id,
              plan: planId,
            });

            if (verifyRes.data.success) {
              toast.success(
                `🎉 You are now on the ${planLabel} plan! A confirmation email has been sent.`
              );
              /* 5. Refresh user context so plan badge updates immediately */
              await refreshUser(user._id);
              /* 6. Reload history */
              const histRes = await axiosInstance.get(
                `/payment/status/${user._id}`
              );
              setPaymentHistory(histRes.data.payments || []);
            }
          } catch (verifyErr: any) {
            toast.error(
              verifyErr?.response?.data?.message ||
                "Payment verification failed. Please contact support."
            );
          } finally {
            setProcessingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast.error(
          `Payment failed: ${response.error?.description || "Unknown error"}`
        );
        setProcessingPlan(null);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Failed to initiate payment. Please try again."
      );
      setProcessingPlan(null);
    }
  };

  const currentPlanRank = PLAN_RANK[user?.plan || "free"];

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab("channels")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "channels"
              ? "bg-gray-900 text-white dark:bg-white dark:text-black shadow-sm"
              : "bg-gray-100 hover:bg-gray-200 dark:bg-[#202020] dark:hover:bg-[#2d2d2d] text-gray-700 dark:text-gray-300"
          }`}
        >
          <PlaySquare className="w-4 h-4" />
          <span>Subscribed Channels</span>
          {subscriptions && subscriptions.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "channels"
                  ? "bg-red-600 text-white"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
            >
              {subscriptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "plans"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-gray-100 hover:bg-gray-200 dark:bg-[#202020] dark:hover:bg-[#2d2d2d] text-gray-700 dark:text-gray-300"
          }`}
        >
          <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>VIP & Premium Plans</span>
        </button>
      </div>

      {/* ================================================================
          TAB 1: SUBSCRIBED CHANNELS & VIDEO FEED
      ================================================================ */}
      {activeTab === "channels" && (
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Subscriptions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Channels you have subscribed to and their latest uploads.
            </p>
          </div>

          {!user ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white/50 dark:bg-[#181818]/50">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 text-2xl">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Don't miss new videos
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-5">
                Sign in to see updates from your favorite YouTube channels and creators.
              </p>
              <Link
                href="/"
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold shadow-md transition-colors"
              >
                Go to Home & Sign In
              </Link>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white/50 dark:bg-[#181818]/50">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#222] text-gray-400 flex items-center justify-center mb-4 text-2xl">
                <Tv className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                No subscribed channels yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-5">
                Subscribe to your favorite creators to see their latest videos, updates, and channels here.
              </p>
              <Link
                href="/explore"
                className="px-6 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-full text-sm font-bold shadow-md transition-colors"
              >
                Explore Channels
              </Link>
            </div>
          ) : (
            <>
              {/* SUBSCRIBED CHANNELS SECTION */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-600" />
                    <span>Subscribed Channels ({subscriptions.length})</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subscriptions.map((sub: any) => {
                    const channelId = sub.channel?._id || sub.channel;
                    const channelName =
                      sub.channel?.channelname ||
                      sub.channel?.name ||
                      sub.channelName;
                    const avatarImg = sub.channel?.image;
                    const channelLink = channelId
                      ? `/channel/${channelId}`
                      : `/search?q=${encodeURIComponent(channelName)}`;
                    const isUnsubscribing =
                      unsubscribingId === (sub._id || channelName);

                    return (
                      <div
                        key={sub._id || channelName}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181818] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Link href={channelLink}>
                            <Avatar className="w-12 h-12 border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity">
                              {avatarImg ? (
                                <img
                                  src={avatarImg}
                                  alt={channelName}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                <AvatarFallback className="text-base font-bold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                                  {channelName?.[0]?.toUpperCase() || "C"}
                                </AvatarFallback>
                              )}
                            </Avatar>
                          </Link>

                          <div className="flex-1 min-w-0">
                            <Link href={channelLink}>
                              <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate hover:underline cursor-pointer">
                                {channelName}
                              </h3>
                            </Link>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Subscribed
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800/80">
                          <Link
                            href={channelLink}
                            className="flex-1 py-1.5 px-3 rounded-lg text-center text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-[#252525] dark:hover:bg-[#303030] text-gray-800 dark:text-gray-200 transition-colors"
                          >
                            Visit
                          </Link>

                          <button
                            onClick={() => handleUnsubscribe(sub)}
                            disabled={isUnsubscribing}
                            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-red-100 hover:text-red-700 dark:bg-[#2a2a2a] dark:hover:bg-red-950/50 dark:hover:text-red-400 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer disabled:opacity-50"
                            title="Unsubscribe from channel"
                          >
                            {isUnsubscribing ? "..." : "Unsubscribe"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* LATEST VIDEOS FEED SECTION */}
              <section className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-red-600" />
                  <span>Latest Videos from Subscriptions</span>
                </h2>

                {loadingVideos ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2">
                        <div className="aspect-video bg-gray-200 dark:bg-[#202020] rounded-xl" />
                        <div className="h-4 bg-gray-200 dark:bg-[#202020] rounded w-3/4" />
                        <div className="h-3 bg-gray-200 dark:bg-[#202020] rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : subscribedVideos.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-[#151515]">
                    No videos uploaded by your subscribed channels yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {subscribedVideos.map((video: any) => (
                      <Videocard key={video._id} video={video} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* ================================================================
          TAB 2: VIP & PREMIUM PLANS
      ================================================================ */}
      {activeTab === "plans" && (
        <div>
          {/* PAGE HEADER */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-8 h-8 text-yellow-500" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                YourTube Plans
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto text-sm sm:text-base">
              Unlock more with a paid plan — more downloads, premium content,
              fewer ads, and exclusive perks.
            </p>

            {/* Current plan badge */}
            {user && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-[#1c1c1c] border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200 shadow-sm">
                <Star className="w-4 h-4 text-yellow-500" />
                Your current plan:{" "}
                <span className="font-bold capitalize text-red-600 dark:text-red-400">
                  {user.plan || "free"}
                </span>
              </div>
            )}

            {!user && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium">
                Please sign in to upgrade your plan.
              </p>
            )}
          </div>

      {/* PLAN CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {PLANS.map((plan) => {
          const PlanIcon = plan.icon;
          const isCurrentPlan =
            user?.plan === plan.id || (!user?.plan && plan.id === "free");
          const isLowerPlan = PLAN_RANK[plan.id] < currentPlanRank;
          const isProcessing = processingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${plan.borderColor} bg-white shadow-md flex flex-col overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-lg text-gray-900`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm z-10">
                  Most Popular
                </div>
              )}

              {/* Card header gradient */}
              <div
                className={`bg-gradient-to-br ${plan.color} p-5 text-white shadow-inner`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <PlanIcon className="w-6 h-6 text-white" />
                  <h2 className="text-lg font-bold text-white">{plan.label}</h2>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  {plan.priceLabel}
                </div>
                <div className="text-xs text-white/90 font-medium mt-0.5">
                  {plan.period}
                </div>
              </div>

              {/* Card content area - white background with high-contrast dark text */}
              <div className="flex-1 p-5 space-y-3 bg-white text-gray-900">
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm font-medium text-gray-800"
                    >
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.restrictions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Limitations
                    </p>
                    <ul className="space-y-1.5">
                      {plan.restrictions.map((r) => (
                        <li
                          key={r}
                          className="flex items-start gap-2 text-xs text-gray-500 font-medium"
                        >
                          <span className="text-gray-400 font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* CTA area */}
              <div className="p-5 pt-0 bg-white">
                {isCurrentPlan ? (
                  <div className="w-full py-2.5 rounded-lg text-center text-sm font-semibold bg-green-50 text-green-800 border border-green-200">
                    ✓ Current Plan
                  </div>
                ) : isLowerPlan ? (
                  <div className="w-full py-2.5 rounded-lg text-center text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200">
                    Already on a higher plan
                  </div>
                ) : plan.isPaid ? (
                  <button
                    id={`upgrade-btn-${plan.id}`}
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isProcessing || !user}
                    className={`w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-sm bg-gradient-to-r ${plan.color} hover:opacity-95 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isProcessing ? "Processing…" : plan.cta}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* BENEFITS COMPARISON TABLE */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181818] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#202020] text-left border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3.5 font-bold text-gray-800 dark:text-gray-200 w-48">
                  Feature
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    className={`px-4 py-3.5 text-center font-bold capitalize ${
                      user?.plan === p.id
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {p.label}
                    {user?.plan === p.id && (
                      <span className="ml-1 text-xs font-semibold text-red-500 dark:text-red-400">
                        (you)
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { label: "Downloads / day", values: ["1", "3", "10", "∞"] },
                {
                  label: "Premium content",
                  values: ["Limited", "Standard", "Full", "Full"],
                },
                {
                  label: "Video quality",
                  values: ["HD", "HD", "4K", "4K Ultra"],
                },
                { label: "Ads", values: ["Yes", "Reduced", "Minimal", "None"] },
                { label: "Offline watch", values: ["✗", "✗", "✓", "✓"] },
                { label: "Priority support", values: ["✗", "✗", "✗", "✓"] },
              ].map((row, i) => (
                <tr
                  key={row.label}
                  className={
                    i % 2 === 0
                      ? "bg-white dark:bg-[#181818]"
                      : "bg-gray-50/60 dark:bg-[#1d1d1d]"
                  }
                >
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                    {row.label}
                  </td>
                  {row.values.map((v, idx) => (
                    <td
                      key={idx}
                      className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PAYMENT HISTORY */}
      {user && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Eye className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            Payment History
          </h2>

          {loadingHistory ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Loading history…
            </p>
          ) : paymentHistory.length === 0 ? (
            <div className="text-center py-10 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#181818] text-gray-500 dark:text-gray-400">
              <Download className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">
                No payments yet. Upgrade a plan to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181818] shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#202020] text-left border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3.5 text-gray-800 dark:text-gray-200 font-bold">
                      Date
                    </th>
                    <th className="px-4 py-3.5 text-gray-800 dark:text-gray-200 font-bold">
                      Plan
                    </th>
                    <th className="px-4 py-3.5 text-gray-800 dark:text-gray-200 font-bold">
                      Amount
                    </th>
                    <th className="px-4 py-3.5 text-gray-800 dark:text-gray-200 font-bold">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-gray-800 dark:text-gray-200 font-bold">
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paymentHistory.map((p: any) => (
                    <tr
                      key={p._id}
                      className="hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {new Date(p.transactionDate).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize font-bold text-gray-900 dark:text-white">
                        {p.plan}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        ₹{p.amount}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            p.status === "paid"
                              ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800"
                              : p.status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {p.razorpayPaymentId || p.razorpayOrderId || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

          {/* NOT SIGNED IN CTA */}
          {!user && (
            <section className="mt-8 text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white/50 dark:bg-[#181818]/50">
              <Crown className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-3">
                Sign in to view your plan and upgrade.
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold shadow-md transition-colors"
              >
                Go to Home & Sign In
              </Link>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
