const fs = require('fs')
const http2 = require('http2')
const Koa = require('koa')

const { router } = require('./routes')
const app = new Koa()

const vhost = /^(v\.)?javl0l\.com$/
const port = process.env.PORT || 3000

app
  // logger
  .use(async (ctx, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
  })
  // vhost
  .use((ctx, next) => {
    const host = ctx.get(':authority') || ctx.hostname
    ctx.assert(vhost.test(host), 404)
    return next()
  })
  // routes
  .use(router.middleware())
  .use(router.allowedMethods())

  // Support basic global controls serving as a usual Koa app
  .use(async (ctx, next) => {
    ctx.set('server', 'nginx')
    await next()
  })
  // Listen and enjoy
  // .listen(port, () => console.log(`Listening on port ${port}!`))
http2
  .createSecureServer({
    key: fs.readFileSync('./priv.pem'),
    cert: fs.readFileSync('./cert.pem'),
    allowHTTP1: true
  }, app.callback())
  .listen(port)

