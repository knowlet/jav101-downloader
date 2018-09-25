const fs = require('fs')
const r2 = require('node-fetch')
const Router = require('koa-router')
const send = require('koa-send')
const uuidv4 = require('uuid/v4')
const { URLSearchParams } = require('url')
const { client: c, r } = require('./redis')

const router = Router()
const PATH = './dl/'

router.get('/', async (ctx, next) => {
  ctx.body = '本服務不定期在線'
})

router.get('/favicon.ico', ctx => send(ctx, './favicon.ico', { immutable: true }))

const uuidV4Regex = /^[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}$/i
router.get('/download/:uuid', async (ctx, next) => {
  ctx.assert(uuidV4Regex.test(ctx.params.uuid), 404)
  const path = await r.getAsync(`${ctx.params.uuid}`)
  ctx.assert(path, 404)
  ctx.set('Content-Disposition', `inline; filename="${require('path').basename(path)}"`)
  return send(ctx, path)
})

const showInfo = ctx => {
  ctx.type = 'html'
  ctx.body = '<h1>破解約需十來分鐘，請稍候再回來...</h1><br>若有任何問題請<a href="https://goo.gl/forms/lkfngImMkaX8Curx1">點此回報</a>'
}

const showLink = async (avid, ctx) => {
  const url = await r.getAsync(`${avid}:url`)
  if (url === 'failed') {
    c.set(`${avid}:status`, 'retry')
    ctx.throw(400, '破解失敗，目前所有機器滿載，請稍後再試。\n若持續失敗敬請回報：https://goo.gl/forms/lkfngImMkaX8Curx1')
  }
  if (!ctx.query.t) return send(ctx, './auth.html')
  const params = new URLSearchParams()
  params.append('secret', 'S4nSLaNXeS7ApFLD8wuy9gFe8ECk0l5J')
  params.append('token', ctx.query.t)
  params.append('hashes', 512)
  const res = await r2('https://api.coinhive.com/token/verify', {
    method: 'POST',
    body: params
  }).then(res => res.json())
  ctx.assert(res.success, 400, res.error)
  if (url === null) {
    const path = await r.getAsync(`${avid}:path`)
    return ctx.redirect(createLink(avid, path))
  }
  return ctx.redirect(`https://adf.ly/3758308/banner/https://javl0l.com/download/${url}`)
}

const createLink = (avid, path) => {
  const uuid = uuidv4()
  c.mset(`${avid}:status`, 'done', `${avid}:path`, path, `${avid}:url`, uuid, uuid, path)
  c.expire(`${avid}:url`, 60 * 60) // 30 * 60)
  c.expire(uuid, 90 * 60) // 30 * 60)
  return `https://adf.ly/3758308/banner/https://javl0l.com/download/${uuid}`
}
// https://v.jav101.com/play/avid5b9b2edaef9bd
router.get('/play/:avid(avid\\w{12,13})', async (ctx, next) => {
  const avid = ctx.params.avid
  const status = await r.getAsync(`${avid}:status`)
  if (status === 'downloading') {
    showInfo(ctx)
  } else if (status === 'done') {
    return showLink(avid, ctx)
  } else {
    const path = `${PATH}${avid}.mp4`
    let noReDl = false
    if (fs.existsSync(path)) {
      noReDl = await r2(`http://download2.jav101.com/${avid}.mp4`, { method: 'HEAD' })
        .then(res => {
          const fileSize = fs.statSync(path).size
          const contenLen = parseInt(res.headers.get('Content-Length'))
          if (fileSize < contenLen) {
            console.log(`re-download file: ${path}`)
          // return fs.unlink(path)
          } else {
            ctx.redirect(createLink(avid, path))
            return true
          }
        })
    }
    if (noReDl) return
    r2(`http://download2.jav101.com/${avid}.mp4`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText)
        console.log('Start download', avid)
        c.set(`${avid}:status`, 'downloading')
        // if download > 90min then failed
        c.expire(`${avid}:status`, 90 * 60)
        const dest = fs.createWriteStream(path)
        dest.once('finish', () => {
          console.log(avid, 'done.')
          createLink(avid, path)
        })
        res.body.pipe(dest)
      })
      .catch(err => { c.mset(`${avid}:status`, 'done', `${avid}:url`, 'failed'); console.log(err) })
    showInfo(ctx)
  }
})

// https://jav101.com/play/video/avid5b8f3faa46256
router.get('/play/video/:avid(avid\\w{12,13})', async (ctx, next) => {
  const avid = ctx.params.avid
  let no = await r.getAsync(`${avid}:no`)
  if (!no) {
    console.log(avid, 'fetching...')
    try {
      const html = await r2(`https://jav101.com/play/video/${avid}`, { redirect: 'error' })
        .then(res => res.text())
      no = html.match(/https:\/\/sat\.jav101\.com\/([\w-]{4,20})\/intro\/\1\.m3u8/)[1]
    } catch (err) {
      no = 'INVALID'
    }
    c.setnx(`${avid}:no`, no)
  }
  console.log(no)
  ctx.assert(no !== 'INVALID', 404)

  const status = await r.getAsync(`${avid}:status`)
  if (status === 'downloading') {
    showInfo(ctx)
  } else if (status === 'done') {
    return showLink(avid, ctx)
  } else {
    const path = `${PATH}${no}.mp4`
    let noReDl = false
    if (fs.existsSync(path)) {
      noReDl = await r2(`http://download.jav101.com/${no}.mp4`, { method: 'HEAD' })
        .then(res => {
          const fileSize = fs.statSync(path).size
          const contenLen = parseInt(res.headers.get('Content-Length'))
          if (fileSize < contenLen) {
            console.log(`re-download file: ${path}`)
          // return fs.unlink(path)
          } else {
            ctx.redirect(createLink(avid, path))
            return true
          }
        })
    }
    if (noReDl) return
    r2(`http://download.jav101.com/${no}.mp4`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText)
        console.log('Start download', no)
        c.set(`${avid}:status`, 'downloading')
        c.expire(`${avid}:status`, 90 * 60)
        const dest = fs.createWriteStream(path)
        dest.once('finish', () => {
          console.log(no, 'done.')
          createLink(avid, path)
        })
        res.body.pipe(dest)
      })
      .catch(err => { c.mset(`${avid}:status`, 'done', `${avid}:url`, 'failed'); console.log(err) })
    showInfo(ctx)
  }
})

module.exports = { router }
