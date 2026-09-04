import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-6xl">🌾</span>
        <h1 className="font-playfair text-3xl font-bold text-charcoal">
          Une erreur inattendue s'est produite
        </h1>
        <p className="font-dm text-charcoal/60 max-w-md">
          Rechargez la page. Si le problème persiste, contactez le support.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-forest text-cream font-syne font-bold px-6 py-3 rounded-full hover:bg-forest/80 transition-colors"
        >
          Recharger la page
        </button>
      </div>
    )
    return this.props.children
  }
}
