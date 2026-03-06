import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Plugin to prevent Vite/Rollup from detecting and trying to bundle
 * JASSUB's internal web worker. JASSUB uses `new Worker(new URL('./worker/worker.js', import.meta.url))`
 * as a fallback, but we provide our own workerUrl from public/jassub/ at runtime.
 * This plugin breaks the static pattern so Rollup skips the worker bundling.
 */
function jassubWorkerFix() {
  return {
    name: 'jassub-worker-fix',
    transform(code, id) {
      if (id.includes('jassub') && id.endsWith('jassub.js')) {
        // Break the new Worker(new URL('./worker/worker.js', import.meta.url)) pattern
        // so Rollup's static analysis does not try to bundle it as a worker asset.
        return {
          code: code
            .replace(
              `new Worker(new URL('./worker/worker.js',import.meta.url)`,
              `new Worker(new URL('./worker/worker' + '.js', import.meta.url)`
            )
            .replace(
              `new Worker(new URL("./worker/worker.js",import.meta.url)`,
              `new Worker(new URL("./worker/worker" + ".js", import.meta.url)`
            )
            .replace(
              `new Worker(new URL('./worker/worker.js', import.meta.url)`,
              `new Worker(new URL('./worker/worker' + '.js', import.meta.url)`
            )
            .replace(
              `new Worker(new URL("./worker/worker.js", import.meta.url)`,
              `new Worker(new URL("./worker/worker" + ".js", import.meta.url)`
            ),
          map: null
        }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [jassubWorkerFix(), react()],
    worker: {
      format: 'es'
    }
  }
})
