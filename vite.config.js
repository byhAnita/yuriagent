import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /**
   * Relative, so the build works wherever it is served from.
   *
   * The default is '/', which assumes the app owns the domain root. GitHub
   * Pages serves a project site from '/<repo>/', so every absolute asset URL
   * 404s there and the app is a blank page with a console full of errors -
   * and it looks perfectly fine in `npm run dev`, which is what makes it a
   * deploy-day surprise rather than a bug.
   *
   * BASE_URL overrides it for a host that does want an absolute path. Same
   * arrangement rv-simulator settled on after hitting this.
   */
  base: process.env.BASE_URL ?? './',
})
