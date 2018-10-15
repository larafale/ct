import config from './config'
import bluebird from 'bluebird'
import redis from 'redis'
import adapter from 'socket.io-redis'
import url from 'url' 
import NRP from 'node-redis-pubsub'

bluebird.promisifyAll(redis)

let client

const options =  Object.assign({
    host: '127.0.0.1'
  , port: 6379
}, config.redis ? { 
    host: url.parse(config.redis).hostname
  , port: url.parse(config.redis).port  
} : {})


export { client as default }

export let isReady


export const initRedis = () => {
	return new Promise((resolve, reject) => {

		client = redis.createClient(options)
		client.options = options // attach options

		client.on("ready", function (err) {
		   resolve(client)
		   isReady = true
		})
		
		client.on("error", function (err) {
		   reject(err)
		})
	})
}

export const redisAdapter = adapter(options)




// expose a pub sub mechanism to our app
export const pubsub = new NRP({
  // emitter: redis.createClient(options),  
  // receiver: redis.createClient(options)
  emitter: client,  
  receiver: client
})