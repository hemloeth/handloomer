// Detail-shaped skeleton (no spinner copy) — keeps layout stable while streaming.
export default function ProductLoading() {
    return (
        <div className="min-h-screen">
            <div style={{ paddingTop: 'calc(var(--header-offset))' }} className="max-w-[1500px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8 grid lg:grid-cols-2 gap-8">
                <div className="aspect-[500/650] bg-muted animate-pulse" />
                <div className="space-y-4">
                    <div className="h-6 bg-muted animate-pulse w-1/3" />
                    <div className="h-10 bg-muted animate-pulse w-2/3" />
                    <div className="h-6 bg-muted animate-pulse w-1/4" />
                    <div className="h-6 bg-muted animate-pulse w-1/5" />
                    <div className="h-12 bg-muted animate-pulse" />
                    <div className="h-12 bg-muted animate-pulse" />
                </div>
            </div>
        </div>
    )
}
