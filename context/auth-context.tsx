"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { apiGet, apiPost, apiPut, setApiDedupeScope } from "@/lib/api"

interface User {
    _id?: string
    name: string
    email: string
    phone: string
}

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isHydrated: boolean
    loginEvent: number  // Increments on each login — cart/wishlist watch this
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    signup: (name: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isHydrated, setIsHydrated] = useState(false)
    const [loginEvent, setLoginEvent] = useState(0)

    // Keep the API de-duplication identity scoped to the CURRENT account, so a
    // logged-out or different-account in-flight read can never satisfy another
    // account's request. Uses only the non-secret user id (or "anon").
    useEffect(() => {
        setApiDedupeScope(user?._id ? String(user._id) : "anon")
    }, [user])

    // Authenticated session restoration on mount:
    // Never treat unverified cached profile data as proof of authentication.
    // Call GET /api/user/profile to verify token validity, expiration, and revocation.
    useEffect(() => {
        let isMounted = true;

        const restoreSession = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem("user_token") : null;
            if (!token) {
                if (isMounted) {
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem("auth_user");
                    }
                    setUser(null);
                    setIsHydrated(true);
                }
                return;
            }

            try {
                // Authoritatively verify session with the backend profile endpoint
                const data = await apiGet('/api/user/profile');
                const profileUser = data?.user || (data?._id ? data : null);

                if (isMounted) {
                    if (profileUser && profileUser._id) {
                        const verifiedUser: User = {
                            _id: profileUser._id,
                            name: profileUser.name,
                            email: profileUser.email,
                            phone: profileUser.phone,
                        };
                        setUser(verifiedUser);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem("auth_user", JSON.stringify(verifiedUser));
                        }
                    } else {
                        // Empty or unrecognized profile payload
                        setUser(null);
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem("auth_user");
                            localStorage.removeItem("user_token");
                        }
                    }
                }
            } catch (err: any) {
                // Session expired, revoked, invalid, or 401/403
                if (isMounted) {
                    setUser(null);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem("auth_user");
                        localStorage.removeItem("user_token");
                    }
                }
            } finally {
                if (isMounted) {
                    setIsHydrated(true);
                }
            }
        };

        restoreSession();

        const handleSessionExpired = () => {
            setUser(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem("auth_user");
                localStorage.removeItem("user_token");
            }
        };
        window.addEventListener("auth:session_expired", handleSessionExpired);
        return () => {
            isMounted = false;
            window.removeEventListener("auth:session_expired", handleSessionExpired);
        };
    }, []);

    const signup = async (name: string, email: string, phone: string, password: string) => {
        try {
            const data = await apiPost('/api/user/register', { name, email, phone, password })

            const userData = { _id: data._id, name: data.name, email: data.email, phone: data.phone }
            setUser(userData)
            if (typeof window !== 'undefined') {
                localStorage.setItem("auth_user", JSON.stringify(userData));
                if (data.token) { localStorage.setItem("user_token", data.token); }
            }

            // Signal cart/wishlist to sync
            setLoginEvent(prev => prev + 1)

            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message || "Something went wrong. Please try again." }
        }
    }

    const login = async (email: string, password: string) => {
        try {
            const data = await apiPost('/api/user/login', { email, password })

            const userObj = data.user || data;
            const userData = { _id: userObj._id, name: userObj.name, email: userObj.email, phone: userObj.phone }
            setUser(userData)
            if (typeof window !== 'undefined') {
                localStorage.setItem("auth_user", JSON.stringify(userData));
                if (data.token) { localStorage.setItem("user_token", data.token); }
            }

            // Signal cart/wishlist to sync
            setLoginEvent(prev => prev + 1)

            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message || "Invalid email or password" }
        }
    }

    const logout = async () => {
        try {
            await apiPost('/api/user/logout', {})
        } catch (error) {
            console.error("Logout API failed:", error)
        }
        setUser(null)
        if (typeof window !== 'undefined') {
            localStorage.removeItem("auth_user");
            localStorage.removeItem("user_token");
        }
    }

    const updateProfile = async (data: Partial<User>) => {
        if (!user) return

        // Persist to the server FIRST; only mirror into local state on success.
        // Throws on failure so the caller can surface the error and keep the
        // previous values intact.
        await apiPut('/api/user/profile', data)

        const updatedUser = { ...user, ...data }
        setUser(updatedUser)
        if (typeof window !== 'undefined') {
            localStorage.setItem("auth_user", JSON.stringify(updatedUser))
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isHydrated,
                loginEvent,
                login,
                signup,
                logout,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
