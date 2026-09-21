"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import axiosInstance from "./axiosinstance";

// ─── Context ─────────────────────────────────────────────────────────────────
const UserContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function UserProvider({ children }) {
  // ── Auth / User state ──
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [theme, setTheme] = useState("dark");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── Subscription state ──
  const [subscriptions, setSubscriptions] = useState([]);

  // ── OTP modal state ──
  const [otpState, setOtpState] = useState({
    isOpen: false,
    email: "",
    device: null,
    location: null,
    token: null,
  });

  // ─── Hydration: initial load from localStorage ─────────────────────────────
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme") || "dark";
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");

      const savedUserStr = localStorage.getItem("user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser) {
          setUser(savedUser);
        }
      }
    } catch (_) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
      } catch (_) {}
      return next;
    });
  }, []);

  // ─── Sidebar toggle ───────────────────────────────────────────────────────
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // ─── Sync Firebase user with backend ─────────────────────────────────────
  const syncUserWithBackend = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return null;
    try {
      // Server route: POST /user/login — takes {email, name, image}
      const res = await axiosInstance.post("/user/login", {
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        image: firebaseUser.photoURL || "",
        deviceId: "web_firebase_oauth",
      });

      const data = res?.data;

      // Server returns { result: user, otpRequired: bool } OR { otpRequired: true, tempToken / token: ... }
      const activeOtpToken = data?.tempToken || data?.token;
      if (data?.otpRequired && activeOtpToken) {
        // OTP flow — open the OTP modal
        setOtpState({
          isOpen: true,
          email: firebaseUser.email,
          device: data.device || null,
          location: data.location || null,
          token: activeOtpToken,
        });
        return null; // user not set until OTP verified
      }

      const backendUser = data?.result || data?.user || data;
      return backendUser || null;
    } catch (err) {
      console.warn("Backend sync failed, using Firebase user directly:", err?.message);
      // Fallback: use Firebase user directly (app still works without backend)
      return {
        _id: firebaseUser.uid,
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        email: firebaseUser.email,
        image: firebaseUser.photoURL || "",
        plan: "free",
      };
    }
  }, []);

  // ─── Fetch subscriptions (declared before onAuthStateChanged so it is initialized first) ───
  const fetchSubscriptions = useCallback(async (userId, email) => {
    if (!userId) return;
    try {
      const userEmail = email || user?.email || "";
      const queryParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : "";
      const res = await axiosInstance.get(`/subscription/user/${userId}${queryParam}`);
      // Server may return { subscriptions: [...] } or just an array
      const subs = res?.data?.subscriptions || res?.data || [];
      setSubscriptions(Array.isArray(subs) ? subs : []);
    } catch (err) {
      console.warn("Could not load subscriptions:", err?.message);
      setSubscriptions([]);
    }
  }, [user?.email]);

  // ─── Firebase Auth: listen for auth state changes ─────────────────────────
  useEffect(() => {
    if (!auth) {
      // No Auth instance on the server – skip listener
      return;
    }
    let unsubscribe;
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const fallback = {
            _id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            email: firebaseUser.email,
            image: firebaseUser.photoURL || "",
            plan: "free",
          };

          // Immediately set active user state from Firebase so comments/interactions don't block
          setUser((prev) => {
            if (prev && (prev._id || prev.uid)) return prev;
            try {
              localStorage.setItem("user", JSON.stringify(fallback));
            } catch (_) {}
            return fallback;
          });

          const backendUser = await syncUserWithBackend(firebaseUser);
          if (backendUser) {
            const mergedUser = {
              ...backendUser,
              uid: firebaseUser.uid,
              _id: backendUser._id || firebaseUser.uid,
              name: backendUser.name || firebaseUser.displayName || "User",
              email: backendUser.email || firebaseUser.email,
              image: backendUser.image || firebaseUser.photoURL || "",
            };
            setUser(mergedUser);
            try {
              localStorage.setItem("user", JSON.stringify(mergedUser));
            } catch (_) {}
            fetchSubscriptions(mergedUser._id || mergedUser.uid, mergedUser.email);
          }
        } else {
          setUser(null);
          setSubscriptions([]);
          try {
            localStorage.removeItem("user");
          } catch (_) {}
        }
        setLoading(false);
      });
    } catch (err) {
      console.error("Firebase auth listener error:", err?.message);
      setLoading(false);
    }

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [syncUserWithBackend, fetchSubscriptions]);



  // Sync subscriptions whenever user changes
  useEffect(() => {
    const targetUserId = user?._id || user?.uid;
    if (targetUserId) {
      fetchSubscriptions(targetUserId, user?.email);
    } else {
      setSubscriptions([]);
    }
  }, [user?._id, user?.uid, user?.email, fetchSubscriptions]);

  // ─── Refresh user from backend ────────────────────────────────────────────
  const refreshUser = useCallback(async (userId) => {
    const targetId = userId || user?._id;
    if (!targetId) return;
    try {
      // Try dedicated user endpoint first, then channel endpoint
      const res = await axiosInstance.get(`/user/channel/${targetId}`);
      const updated = res?.data?.result || res?.data?.user || res?.data;
      if (updated) setUser(updated);
    } catch (err) {
      console.warn("refreshUser failed:", err?.message);
    }
  }, [user?._id]);

  // ─── Update User Plan (for Demo/Subscription updates) ─────────────────────
  const updateUserPlan = useCallback((newPlan) => {
    setUser((prev) => (prev ? { ...prev, plan: newPlan } : null));
  }, []);

  // ─── Login (manual — used by channeldialogue after channel creation) ───────
  const login = useCallback((userData) => {
    if (userData) setUser(userData);
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase signOut error:", err?.message);
    }
    setUser(null);
    setSubscriptions([]);
  }, []);

  // ─── Google Sign-In ───────────────────────────────────────────────────────
  const handlegooglesignin = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged fires after successful sign in → sets user
    } catch (err) {
      if (
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request"
      ) {
        return; // User closed popup — not an error
      }
      console.error("Google sign-in error:", err?.message);
    }
  }, []);

  // ─── Subscription helpers ─────────────────────────────────────────────────
  const isSubscribed = useCallback(
    (uploaderId, channelIdOrName) => {
      if (!subscriptions?.length) return false;
      return subscriptions.some((sub) => {
        const cId = sub?.channel?._id
          ? String(sub.channel._id)
          : sub?.channel
          ? String(sub.channel)
          : null;
        const cName =
          sub?.channelName ||
          sub?.channel?.channelname ||
          sub?.channel?.name;

        if (uploaderId && cId && String(uploaderId) === cId) return true;
        if (channelIdOrName && cId && String(channelIdOrName) === cId) return true;
        if (
          channelIdOrName &&
          cName &&
          String(cName).toLowerCase() === String(channelIdOrName).toLowerCase()
        )
          return true;
        if (
          uploaderId &&
          cName &&
          String(cName).toLowerCase() === String(uploaderId).toLowerCase()
        )
          return true;
        return false;
      });
    },
    [subscriptions]
  );

  const toggleSubscribe = useCallback(
    async (channelIdOrObj) => {
      const targetUserId = user?._id || user?.uid || user?.id;
      if (!targetUserId) return;
      // Accept either a channelId string or { channelId, channelName, email, userName }
      const channelId =
        typeof channelIdOrObj === "string"
          ? channelIdOrObj
          : channelIdOrObj?.channelId;
      const channelName =
        typeof channelIdOrObj === "object"
          ? channelIdOrObj?.channelName
          : undefined;
      const callerEmail =
        typeof channelIdOrObj === "object"
          ? channelIdOrObj?.email
          : undefined;
      const callerUserName =
        typeof channelIdOrObj === "object"
          ? channelIdOrObj?.userName
          : undefined;

      if (!channelId && !channelName) return;

      const targetChannelName = channelName || "Channel";
      const currentlySubscribed = isSubscribed(channelId, channelName);

      // Optimistic update
      if (currentlySubscribed) {
        setSubscriptions((prev) =>
          prev.filter((sub) => {
            const cId = sub?.channel?._id
              ? String(sub.channel._id)
              : sub?.channel
              ? String(sub.channel)
              : null;
            const cName =
              sub?.channelName ||
              sub?.channel?.channelname ||
              sub?.channel?.name;
            if (channelId && cId && cId === String(channelId)) return false;
            if (
              cName &&
              String(cName).toLowerCase() === String(targetChannelName).toLowerCase()
            )
              return false;
            return true;
          })
        );
      } else {
        const optimisticSub = {
          _id: `temp_${Date.now()}`,
          channel: channelId
            ? {
                _id: channelId,
                name: targetChannelName,
                channelname: targetChannelName,
              }
            : null,
          channelName: targetChannelName,
          subscribedOn: new Date().toISOString(),
        };
        setSubscriptions((prev) => [optimisticSub, ...prev]);
      }

      try {
        const res = await axiosInstance.post(`/subscription/toggle`, {
          userId: targetUserId,
          email: callerEmail || user?.email,
          userName: callerUserName || user?.name || user?.displayName,
          channelId,
          channelName: targetChannelName,
        });
        // Sync with backend truth
        await fetchSubscriptions(targetUserId, user?.email);
        return res?.data;
      } catch (err) {
        console.warn("toggleSubscribe error:", err?.message);
        // Rollback on error
        await fetchSubscriptions(targetUserId, user?.email);
      }
    },
    [user, isSubscribed, fetchSubscriptions]
  );


  // ─── OTP modal handlers ───────────────────────────────────────────────────
  const openOtpModal = useCallback((email, device, location, token) => {
    setOtpState({ isOpen: true, email, device, location, token });
  }, []);

  const cancelOtp = useCallback(() => {
    setOtpState({ isOpen: false, email: "", device: null, location: null, token: null });
    // Sign out Firebase session if OTP is cancelled
    signOut(auth).catch(() => {});
  }, []);

  const verifyOtp = useCallback(
    async (otp) => {
      const res = await axiosInstance.post("/user/verify-otp", {
        otp,
        token: otpState.token,
        tempToken: otpState.token,
      });
      const userData = res?.data?.result || res?.data?.user || res?.data;
      if (userData) {
        setUser(userData);
        fetchSubscriptions(userData._id, userData.email);
      }
      cancelOtp();
      return res?.data;
    },
    [otpState.token, fetchSubscriptions, cancelOtp]
  );

  const resendOtp = useCallback(async () => {
    const res = await axiosInstance.post("/user/resend-otp", {
      token: otpState.token,
      tempToken: otpState.token,
    });
    return res?.data;
  }, [otpState.token]);

  // ─── Context value ────────────────────────────────────────────────────────
  const value = {
    // Core auth
    user,
    currentUser: user,
    firebaseUser: auth?.currentUser || null,
    loading,
    login,
    logout,
    refreshUser,
    updateUserPlan,
    handlegooglesignin,
    // Google sign-in alias (used by some components with capital G)
    handleGooglesignin: handlegooglesignin,

    // UI
    theme,
    toggleTheme,
    isSidebarCollapsed,
    toggleSidebar,

    // Subscriptions
    subscriptions,
    isSubscribed,
    toggleSubscribe,
    fetchSubscriptions,

    // OTP
    otpState,
    openOtpModal,
    verifyOtp,
    resendOtp,
    cancelOtp,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// ─── Alias: AuthProvider → UserProvider (used in _app.tsx) ───────────────────
export const AuthProvider = UserProvider;

// ─── Named hook: useUser ─────────────────────────────────────────────────────
export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used inside UserProvider / AuthProvider");
  }
  return ctx;
}

// ─── Named hook: useAuth (alias for backward compat) ─────────────────────────
export const useAuth = useUser;

export default UserProvider;