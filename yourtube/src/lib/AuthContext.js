import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, useEffect, useContext, createContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import { toast } from "sonner";

const UserContext = createContext();

// Helper to generate or retrieve a persistent client device identifier
const getClientDeviceId = () => {
  if (typeof window === "undefined") return "server_device";
  let deviceId = localStorage.getItem("yt_device_id");
  if (!deviceId) {
    deviceId =
      "dev_" +
      Math.random().toString(36).substring(2, 10) +
      "_" +
      Date.now().toString(36);
    localStorage.setItem("yt_device_id", deviceId);
  }
  return deviceId;
};

// Helper to apply theme to document root
const applyThemeToDOM = (themeMode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (themeMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("light");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  const toggleSidebar = (forcedState) => {
    if (typeof forcedState === "boolean") {
      setIsSidebarCollapsed(forcedState);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  // Fetch subscriptions from backend
  const fetchSubscriptions = async (userId) => {
    const targetId = userId || user?._id;
    if (!targetId) {
      setSubscriptions([]);
      return;
    }
    setLoadingSubscriptions(true);
    try {
      const res = await axiosInstance.get(`/subscription/user/${targetId}`);
      setSubscriptions(res.data.subscriptions || []);
    } catch (err) {
      console.warn("Could not fetch subscriptions:", err?.message);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Helper to check if currently subscribed to a channel
  const isSubscribed = (channelId, channelName) => {
    if (!subscriptions || subscriptions.length === 0) return false;
    return subscriptions.some((s) => {
      const subId = s.channel?._id || s.channel;
      if (channelId && subId && String(channelId) === String(subId)) {
        return true;
      }
      if (
        channelName &&
        s.channelName &&
        s.channelName.toLowerCase().trim() === String(channelName).toLowerCase().trim()
      ) {
        return true;
      }
      return false;
    });
  };

  // Subscribe / Unsubscribe toggle
  const toggleSubscribe = async ({ channelId, channelName }) => {
    if (!user?._id) {
      toast.error("Please sign in to subscribe to channels");
      return { success: false, message: "Not signed in" };
    }

    try {
      const res = await axiosInstance.post("/subscription/toggle", {
        userId: user._id,
        channelId,
        channelName,
      });

      const { subscribed, subscription: newSub, message } = res.data;

      if (subscribed && newSub) {
        setSubscriptions((prev) => [
          newSub,
          ...prev.filter((s) => {
            const sId = s.channel?._id || s.channel;
            const matchesId = channelId && sId && String(sId) === String(channelId);
            const matchesName =
              channelName &&
              s.channelName &&
              s.channelName.toLowerCase().trim() === String(channelName).toLowerCase().trim();
            return !matchesId && !matchesName;
          }),
        ]);
        toast.success(message || "Subscribed!");
      } else {
        setSubscriptions((prev) =>
          prev.filter((s) => {
            const sId = s.channel?._id || s.channel;
            const matchesId = channelId && sId && String(sId) === String(channelId);
            const matchesName =
              channelName &&
              s.channelName &&
              s.channelName.toLowerCase().trim() === String(channelName).toLowerCase().trim();
            return !matchesId && !matchesName;
          })
        );
        toast.info(message || "Unsubscribed");
      }

      return { success: true, subscribed, message };
    } catch (err) {
      console.error("toggleSubscribe error:", err);
      const errMsg =
        err?.response?.data?.message || "Failed to update subscription";
      toast.error(errMsg);
      return { success: false, message: errMsg };
    }
  };

  // OTP Verification modal state
  const [otpState, setOtpState] = useState({
    isOpen: false,
    tempToken: null,
    email: null,
    location: null,
    device: null,
    message: null,
    pendingFirebaseUser: null,
  });

  // Login handler
  const login = (userdata) => {
    setUser(userdata);
    localStorage.setItem("user", JSON.stringify(userdata));
    if (userdata?.theme) {
      setTheme(userdata.theme);
      localStorage.setItem("theme", userdata.theme);
      applyThemeToDOM(userdata.theme);
    }
  };

  // Logout handler
  const logout = async () => {
    setUser(null);
    setSubscriptions([]);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  // Manual theme switcher
  const toggleTheme = async (newTheme) => {
    const selectedTheme =
      newTheme || (theme === "dark" ? "light" : "dark");
    setTheme(selectedTheme);
    localStorage.setItem("theme", selectedTheme);
    applyThemeToDOM(selectedTheme);

    // If user is logged in, sync manual preference to database
    if (user?._id) {
      try {
        await axiosInstance.patch(`/user/theme/${user._id}`, {
          theme: selectedTheme,
          themePreference: "manual",
        });
        const updatedUser = {
          ...user,
          theme: selectedTheme,
          themePreference: "manual",
        };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      } catch (err) {
        console.error("Failed to sync theme to backend:", err);
      }
    }
  };

  // Refresh user plan/profile
  const refreshUser = async (userId) => {
    try {
      const response = await axiosInstance.get(
        `/payment/status/${userId}`
      );
      const updatedUser = {
        ...user,
        plan: response.data.plan,
      };
      login(updatedUser);
    } catch (error) {
      console.error("refreshUser error:", error);
    }
  };

  // Unified backend login caller with device & location detection
  const performBackendLogin = async (firebaseuser) => {
    const deviceId = getClientDeviceId();
    const payload = {
      email: firebaseuser.email,
      name: firebaseuser.displayName,
      image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      deviceId,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    const response = await axiosInstance.post("/user/login", payload);

    if (response.data.otpRequired) {
      // Prompt user with OTP verification dialog
      setOtpState({
        isOpen: true,
        tempToken: response.data.tempToken,
        email: response.data.email,
        location: response.data.location,
        device: response.data.device,
        message: response.data.message,
        pendingFirebaseUser: firebaseuser,
      });
      return { otpRequired: true };
    } else {
      login(response.data.result);
      return { otpRequired: false, result: response.data.result };
    }
  };

  // Google sign in popup trigger
  const handlegooglesignin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      await performBackendLogin(result.user);
    } catch (error) {
      console.error("Google sign in error:", error);
    }
  };

  // Verify OTP submission
  const verifyOtp = async (otpCode) => {
    if (!otpState.tempToken) {
      throw new Error("No active verification session");
    }
    const deviceId = getClientDeviceId();
    const response = await axiosInstance.post("/user/verify-otp", {
      tempToken: otpState.tempToken,
      otp: otpCode,
      deviceId,
    });

    if (response.data.success && response.data.result) {
      login(response.data.result);
      setOtpState({
        isOpen: false,
        tempToken: null,
        email: null,
        location: null,
        device: null,
        message: null,
        pendingFirebaseUser: null,
      });
      return response.data;
    }
    return response.data;
  };

  // Resend OTP
  const resendOtp = async () => {
    if (!otpState.tempToken) {
      throw new Error("No active verification session");
    }
    const response = await axiosInstance.post("/user/resend-otp", {
      tempToken: otpState.tempToken,
    });
    return response.data;
  };

  // Cancel OTP modal
  const cancelOtp = async () => {
    setOtpState({
      isOpen: false,
      tempToken: null,
      email: null,
      location: null,
      device: null,
      message: null,
      pendingFirebaseUser: null,
    });
    await logout();
  };

  // Initial theme and authentication hydration
  useEffect(() => {
    // 1. Initial theme load from localStorage or fallback
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      applyThemeToDOM(savedTheme);
    }

    // 2. Initial user load from localStorage
    const savedUserStr = localStorage.getItem("user");
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setUser(savedUser);
        if (savedUser.theme) {
          setTheme(savedUser.theme);
          applyThemeToDOM(savedUser.theme);
        }
      } catch (e) {}
    }

    // 3. Listen to Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (firebaseuser) {
        try {
          // If we already have a logged-in user in state with matching email, skip re-login
          const currentStored = localStorage.getItem("user");
          if (currentStored) {
            const parsed = JSON.parse(currentStored);
            if (parsed.email === firebaseuser.email) {
              setUser(parsed);
              if (parsed.theme) {
                setTheme(parsed.theme);
                applyThemeToDOM(parsed.theme);
              }
              return;
            }
          }
          await performBackendLogin(firebaseuser);
        } catch (error) {
          console.error("Auth state login error:", error);
          logout();
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch subscriptions whenever user is authenticated
  useEffect(() => {
    if (user?._id) {
      fetchSubscriptions(user._id);
    } else {
      setSubscriptions([]);
    }
  }, [user?._id]);

  return (
    <UserContext.Provider
      value={{
        user,
        theme,
        toggleTheme,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        login,
        logout,
        handlegooglesignin,
        refreshUser,
        otpState,
        verifyOtp,
        resendOtp,
        cancelOtp,
        subscriptions,
        loadingSubscriptions,
        fetchSubscriptions,
        isSubscribed,
        toggleSubscribe,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
