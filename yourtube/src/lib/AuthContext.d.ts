import { ReactNode } from "react";

export interface UserContextValue {
  user: any | null;
  currentUser?: any | null;
  firebaseUser?: any | null;
  loading: boolean;
  login: (userData: any) => void;
  logout: () => Promise<void>;
  refreshUser: (userId?: string) => Promise<void>;
  updateUserPlan: (newPlan: string) => void;
  handlegooglesignin: () => Promise<void>;
  handleGooglesignin: () => Promise<void>;
  theme: string;
  toggleTheme: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  subscriptions: any[];
  isSubscribed: (uploaderId?: string, channelIdOrName?: string) => boolean;
  toggleSubscribe: (channelIdOrObj: string | { channelId?: string; channelName?: string }) => Promise<any>;
  otpState: {
    isOpen: boolean;
    email: string;
    device: any;
    location: any;
    token: string | null;
  };
  openOtpModal: (email: string, device: any, location: any, token: string) => void;
  verifyOtp: (otp: string) => Promise<any>;
  resendOtp: () => Promise<any>;
  cancelOtp: () => void;
}

export function UserProvider(props: { children: ReactNode }): JSX.Element;
export const AuthProvider: typeof UserProvider;

export function useUser(): UserContextValue;
export const useAuth: typeof useUser;

export default UserProvider;
