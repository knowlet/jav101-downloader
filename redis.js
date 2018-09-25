const { promisify } = require('util')
const redis = require('redis')

const client = redis.createClient({
  host: process.env.redis || 'redis',
  password: 'jav101'
})

client.on('error', function (err) {
  console.log('Error ' + err)
  client.quit(process.abort)
})

// init
// client.flushall()

module.exports = {
  client,
  r: {
    getAsync: promisify(client.get).bind(client),
    hexists: promisify(client.hexists).bind(client),
    hget: promisify(client.hget).bind(client),
    hgetall: promisify(client.hgetall).bind(client)
  }
}
