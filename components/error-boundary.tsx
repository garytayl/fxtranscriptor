'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-destructive/50 rounded-lg p-6 bg-destructive/5">
            <div className="flex items-start gap-4">
              <AlertCircle className="size-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="font-mono text-sm uppercase tracking-widest mb-2 text-destructive">
                  Something went wrong
                </h2>
                <p className="text-sm text-muted-foreground mb-4 font-mono">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <Button
                  onClick={() => {
                    this.setState({ hasError: false, error: null })
                    window.location.reload()
                  }}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs uppercase tracking-widest"
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
