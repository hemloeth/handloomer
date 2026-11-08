"use client"

import React, { ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface AnimatedModalProps {
    isOpen: boolean
    onClose?: () => void
    children: ReactNode
    disableClose?: boolean
}

export function AnimatedModal({ isOpen, onClose, children, disableClose = false }: AnimatedModalProps) {
    // Escape to close + initial focus (modal owns focus while open).
    const ref = React.useRef<HTMLDivElement | null>(null)
    React.useEffect(() => {
        if (!isOpen || disableClose) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.() }
        document.addEventListener("keydown", onKey)
        const prev = document.activeElement as HTMLElement | null
        const timer = setTimeout(() => {
            ref.current?.querySelector<HTMLElement>("button, a, input, [tabindex]")?.focus()
        }, 0)
        return () => { document.removeEventListener("keydown", onKey); clearTimeout(timer); prev?.focus?.() }
    }, [isOpen, onClose, disableClose])
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={() => !disableClose && onClose?.()}
                    />

                    {/* Modal Wrapper for Centering */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        {/* Modal container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{
                                type: "spring",
                                stiffness: 450,
                                damping: 30,
                            }}
                            className="w-full max-w-sm pointer-events-auto"
                        >
                            <div className="bg-background rounded-2xl border shadow-2xl p-6 drop-shadow-xl" role="dialog" aria-modal="true" ref={ref}>
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
