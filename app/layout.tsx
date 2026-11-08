import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from "@/context/cart-context"
import { WishlistProvider } from "@/context/wishlist-context"
import { AuthProvider } from "@/context/auth-context"
import { CartSidebar } from "@/components/cart/cart-sidebar"
import { CartToast } from "@/components/cart/cart-toast"
import WhatsAppFloat from "@/components/common/whatsapp-float"
import { ClientOnly } from "@/components/common/client-only"
import { ProductProvider } from "@/context/product-context"
import { fetchProductsFromDB } from "@/lib/products"
import { Toaster } from "sonner"
import './globals.css'

// Removed force-dynamic to allow Next.js static rendering and caching

const getBaseUrl = () => {
  let url = process.env.NEXT_PUBLIC_SITE_URL || 'https://linensarees.com';
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  return new URL(url);
}

export const metadata: Metadata = {
  metadataBase: getBaseUrl(),
  title: 'The Handloomer | Authentic Handcrafted Pure Linen Sarees',
  description: 'Discover the exquisite collection of authentic handwoven pure linen and handloom sarees. Handcrafted elegance for the modern woman by The Handloomer.',
  generator: 'v0.app',
  icons: {
    icon: '/faveicon.jpg',
    apple: '/faveicon.jpg',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch products on the Server to preserve SEO
  const initialProducts = await fetchProductsFromDB()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://pub-f54fad280ec34c659747cdd738e55b2d.r2.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pub-f54fad280ec34c659747cdd738e55b2d.r2.dev" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ProductProvider initialProducts={initialProducts}>
            <CartProvider>
              <WishlistProvider>
                {children}
                <ClientOnly>
                  <CartToast />
                  <CartSidebar />
                  <WhatsAppFloat />
                </ClientOnly>
              </WishlistProvider>
            </CartProvider>
          </ProductProvider>
        </AuthProvider>
        <Analytics />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
