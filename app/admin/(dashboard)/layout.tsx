"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { PageTransition } from "@/components/admin/page-transition"
import { CategoryProvider } from "@/context/category-context"
import { ProductProvider } from "@/context/product-context"
import { BlogProvider } from "@/context/blog-context"
import { apiGet, clearAdminToken } from "@/lib/api"
import { Loader2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

export const ADMIN_SESSION_VERIFIED_KEY = "handloomer_admin_session_verified"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    // Dead manual-collapse model removed — sidebar uses hover/focus expansion only.

    // Session guard below.
    // One session manager: if already verified this lifecycle (flag set),
    // stay on UI and verify silently; hard load shows minimal loader once.
    // Backend verify-token remains authoritative — flag is UX only.
    const [isAuthorizing, setIsAuthorizing] = useState(() => {
        try { return sessionStorage.getItem(ADMIN_SESSION_VERIFIED_KEY) !== "true" } catch { return true }
    })
    const [authError, setAuthError] = useState<string | null>(null)

    useEffect(() => {
        const verifyAdminSession = async () => {
            const userStr = localStorage.getItem("auth_user")
            if (!userStr) {
                router.push("/admin")
                return
            }
            try {
                const user = JSON.parse(userStr)
                if (user.role !== "admin") {
                    throw new Error("Account does not possess administrator privileges.")
                }
                const res = await apiGet<{ success: boolean; user: any }>("/api/admin-auth/verify-token")
                if (res.success) {
                    try { sessionStorage.setItem(ADMIN_SESSION_VERIFIED_KEY, "true") } catch {}
                    setIsAuthorizing(false)
                } else {
                    throw new Error("Backend verification failed.")
                }
            } catch (err: any) {
                localStorage.removeItem("auth_user")
                clearAdminToken()
                try { sessionStorage.removeItem(ADMIN_SESSION_VERIFIED_KEY) } catch {}
                setAuthError(err.message || "Session expired. Please log in again.")
                toast.error(err.message || "Administrative session expired. Please log in again.")
                setTimeout(() => {
                    router.push("/admin")
                }, 2000)
            }
        }
        void verifyAdminSession()
    }, [router])

    if (authError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFBF7] px-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4 animate-bounce">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <h1 className="text-xl font-serif font-bold text-primary mb-2">Access Denied</h1>
                <p className="text-sm text-muted-foreground max-w-xs">{authError}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#8B7355] font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Redirecting to portal...
                </div>
            </div>
        )
    }

    // Minimal professional loader (hard load only; silent verify otherwise).
    if (isAuthorizing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center">
                <p className="text-sm font-serif text-primary mb-2">The Handloomer Admin</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying session…</span>
                </div>
            </div>
        )
    }

    return (
        <CategoryProvider>
            <ProductProvider>
                <BlogProvider>
                    <div className="min-h-screen bg-muted/40" data-admin-root="true">
                        <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                        <div className="fixed top-0 inset-x-0 z-50 h-16 bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                            <AdminHeader onMenuClick={() => setIsSidebarOpen(true)} />
                        </div>
                        <div className="h-16 w-full pointer-events-none" aria-hidden="true" />
                        {/* Content reserves exactly the 64px collapsed rail width */}
                        <div className="flex flex-col min-w-0 lg:pl-16">
                            <main className="flex-1 px-3 py-4 md:px-4 w-full">
                                <PageTransition>
                                    {children}
                                </PageTransition>
                            </main>
                        </div>
                    </div>
                </BlogProvider>
            </ProductProvider>
        </CategoryProvider>
    )
}
