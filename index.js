const Koa = require('koa')
const range = require('koa-range')

const { router } = require('./routes')
const app = new Koa()

const port = process.env.PORT || 3000

app
  // logger
  .use(async (ctx, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
  })
  // accept range
  .use(range)
  // routes
  .use(router.middleware())
  .use(router.allowedMethods())

  // Support basic global controls serving as a usual Koa app
  .use(async (ctx, next) => {
    ctx.set('server', 'nginx')
    await next()
  })
  // Listen and enjoy
  .listen(port, () => console.log(`Listening on port ${port}!`))
