import { Component, type ReactNode } from 'react'

interface SceneBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

/**
 * Se a cena 3D falhar (WebGL negado pelo navegador/driver, textura que não carrega),
 * mostra o `fallback` no lugar de quebrar a página.
 */
export class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Cena 3D indisponível; mostrando a versão estática.', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
