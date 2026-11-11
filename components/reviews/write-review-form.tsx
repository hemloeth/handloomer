"use client"

import { useState, useEffect } from "react"
import { StarRating } from "@/components/common/star-rating"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface WriteReviewFormProps {
  productId: string
  productName: string
  onSubmit?: (reviewData: any) => void
  onCancel?: () => void
  className?: string
}

export function WriteReviewForm({
  productId,
  productName,
  onSubmit,
  onCancel,
  className
}: WriteReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [title, setTitle] = useState("")
  const [comment, setComment] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null)

  // Pre-fill user details if logged in
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auth_user")
      if (stored) {
        const user = JSON.parse(stored)
        if (user.name) setName(user.name)
        if (user.email) setEmail(user.email)
      }
    } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error("Please select a star rating")
      return
    }

    if (!name.trim()) {
      toast.error("Please enter your name")
      return
    }

    if (!comment.trim()) {
      toast.error("Please enter your review comment")
      return
    }

    setIsSubmitting(true)

    try {
      const { apiUpload } = await import("@/lib/api")
      
      const formData = new FormData()
      formData.append('rating', String(rating))
      formData.append('name', name.trim())
      if (email.trim()) formData.append('email', email.trim())
      if (title.trim()) formData.append('title', title.trim())
      formData.append('comment', comment.trim())
      
      if (photos.length > 0) {
        photos.forEach(photo => {
          formData.append('photos', photo)
        })
      }
      
      await apiUpload(`/api/review/product/${productId}`, formData)

      const successMsg = "Thank you! Your review has been submitted and will appear on the product page once approved by our moderation team."
      setSubmittedMessage(successMsg)
      toast.success("Review submitted for approval!")

      if (onSubmit) {
        onSubmit({
          rating,
          name: name.trim(),
          email: email.trim(),
          title: title.trim(),
          comment: comment.trim(),
        })
      }

      // Reset form
      setRating(0)
      setTitle("")
      setComment("")
      setPhotos([])
    } catch (error: any) {
      console.error('Error submitting review:', error)
      toast.error(error.message || 'Error submitting review. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedMessage) {
    return (
      <div className={cn("bg-emerald-50/80 border border-emerald-200 rounded-lg p-6 text-center space-y-3", className)}>
        <h4 className="font-serif text-lg text-emerald-800 font-medium">Review Submitted!</h4>
        <p className="text-sm text-emerald-700 max-w-md mx-auto">{submittedMessage}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSubmittedMessage(null)
            if (onCancel) onCancel()
          }}
          className="mt-2 text-emerald-800 border-emerald-300 hover:bg-emerald-100/50"
        >
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("bg-card border border-border rounded-lg p-4 sm:p-6", className)}>
      <h3 className="text-lg font-medium mb-1">Write a Review</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        Share your experience with <span className="font-medium text-foreground">{productName}</span>. No account required — your review will be published upon moderation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Rating <span className="text-destructive">*</span>
          </label>
          <StarRating
            rating={rating}
            interactive
            onRatingChange={setRating}
            size="md"
            className="mb-1"
          />
          <p className="text-xs text-muted-foreground">
            Click on the stars to rate this product
          </p>
        </div>

        {/* Reviewer Name and Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reviewer-name" className="block text-sm font-medium mb-1">
              Your Name <span className="text-destructive">*</span>
            </label>
            <input
              id="reviewer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-background"
            />
          </div>

          <div>
            <label htmlFor="reviewer-email" className="block text-sm font-medium mb-1">
              Your Email <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              id="reviewer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya@example.com"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-background"
            />
          </div>
        </div>

        {/* Review Headline/Title */}
        <div>
          <label htmlFor="review-title" className="block text-sm font-medium mb-1">
            Review Title <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
          </label>
          <input
            id="review-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Beautiful fabric and fast shipping!"
            maxLength={100}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-background"
          />
        </div>

        {/* Review Comment */}
        <div>
          <label htmlFor="comment" className="block text-sm font-medium mb-1">
            Your Review <span className="text-destructive">*</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical text-sm bg-background"
            placeholder="Describe the fabric quality, color accuracy, drape, and overall satisfaction..."
            maxLength={1000}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            {comment.length}/1000 characters
          </p>
        </div>

        {/* Photos */}
        <div>
          <label htmlFor="photos" className="block text-sm font-medium mb-1">
            Add Photos <span className="text-xs text-muted-foreground font-normal">(up to 5 images)</span>
          </label>
          <input
            type="file"
            id="photos"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                const selectedFiles = Array.from(e.target.files).slice(0, 5)
                setPhotos(selectedFiles)
              }
            }}
            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
          {photos.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {photos.map((photo, i) => (
                 <div key={i} className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[150px] border border-border">
                   {photo.name}
                 </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className="flex-1"
            size="sm"
          >
            {isSubmitting ? "Submitting for Moderation..." : "Submit Review"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              size="sm"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
