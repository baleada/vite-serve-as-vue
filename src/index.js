// Adapted from Vitepress https://github.com/vuejs/vitepress/blob/master/src/node/server.ts
// And from Vite built-in server plugins: https://github.com/vitejs/vite/tree/d50e2e4b04d5aef67f0156c07e353f7128ad2738/src/node/server

import { existsSync, statSync } from 'fs'
import { cachedRead } from 'vite'
import { createFilter } from '@rollup/pluginutils'
import debugFactory from 'debug'

const debug = debugFactory('vite-serve-as-vue:serve'),
      debugHmr = debugFactory('vite-serve-as-vue:hmr')

export default function getPlugin (required) {
  const { toVue, include, exclude, test: rawTest } = required,
        test = resolveTest(include, exclude, rawTest)

  return ({ app, watcher, resolver }) => {
    // hot reload .md files as .vue files
    watcher.on('change', async file => {
      const source = await cachedRead(null, file)

      if (test({ source: source.toString(), id: file, createFilter })) {
        debugHmr(`reloading ${file}`)
        const timestamp = Date.now(),
              sfc = await toVue({ source: source.toString(), id: file })

        // reload the content component
        watcher.handleVueReload(file, timestamp, sfc)
      }
    })

    // inject Koa middleware
    app.use(async (ctx, next) => {
      const file = resolver.requestToFile(ctx.path)
      
      // Guard against files that don't exist and directories
      if (!existsSync(file) || !isFileSync(file)) {
        return next()
      }

      const source = await cachedRead(ctx, file)
      
      if (test({ source: source.toString(), id: file, createFilter })) {
        debug(`loading ${file}`)

        ctx.body = await toVue({ source: source.toString(), id: file })

        // let vite know this is supposed to be treated as vue single file component
        ctx.vue = true

        await next()

        return
      } 
      
      await next()
    })
  }
}

function resolveTest (include, exclude, test) {
  return typeof test === 'function'
    ? test
    : ({ id, createFilter }) => createFilter(include, exclude)(id)
}

function isFileSync (path) {
  return statSync(path).isFile()
}
