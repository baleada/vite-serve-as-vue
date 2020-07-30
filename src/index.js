// Adapted from Vitepress https://github.com/vuejs/vitepress/blob/master/src/node/server.ts
// And from Vite built-in server plugins: https://github.com/vitejs/vite/tree/d50e2e4b04d5aef67f0156c07e353f7128ad2738/src/node/server

import { existsSync } from 'fs'
import { cachedRead } from 'vite'
import debugFactory from 'debug'

const debug = debugFactory('vite-serve-as-vue:serve'),
      debugHmr = debugFactory('vite-serve-as-vue:hmr')

export default function getPlugin (required) {
  const { toVue, extensions: rawExtensions } = required,
        extensions = resolveExtensions(rawExtensions)

  return ({ app, watcher, resolver }) => {
    // hot reload .md files as .vue files
    watcher.on('change', async file => {
      if (extensions.some(extension => file.endsWith(extension))) {
        debugHmr(`reloading ${file}`)
        const timestamp = Date.now(),
              sfc = await getSfc(null, file, toVue)

        // reload the content component
        watcher.handleVueReload(file, timestamp, sfc)
      }
    })

    // inject Koa middleware
    app.use(async (ctx, next) => {
      // handle source -> vue transforms
      if (extensions.some(extension => ctx.path.endsWith(extension))) {
        const file = resolver.requestToFile(ctx.path)
        debug(`loading ${file}`)

        if (!existsSync(file)) {
          return next()
        }

        ctx.body = await getSfc(ctx, file, toVue)

        // let vite know this is supposed to be treated as vue file
        ctx.vue = true

        await next()

        return
      } 
      
      await next()
    })
  }
}

function resolveExtensions (rawExtensions) {
  return typeof rawExtensions === 'string' ? [rawExtensions] : rawExtensions
}

async function getSfc (ctx, file, toVue) {
  const source = await cachedRead(ctx, file)
  return toVue({ source: source.toString() })
}