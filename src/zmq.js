import config from './config'
import ZMQ from 'zeromq'
const url = require('url')
import EventEmitter from './lib/EventEmitter'
import Tx from './tx'
import Block from './block'
 
const { bitcoind, network } = config


const zmqPorts = {
    mainnet: 8331
  , regtest: 18331
  , testnet: 18331
}

const options = Object.assign({
    host: '127.0.0.1'
  , port: zmqPorts[network]
  , channels: ['rawtx', 'rawblock'] //rawtx,hashtx,rawblock,hashblock
}, { host: url.parse(bitcoind).hostname })


const { host, port, channels } = options


class Zmq extends EventEmitter {

  constructor(){
    super()
    const self = this
    
    // create an RPC connection foreach channel
    // to bypass flood miss when rawtx is used with rawblock
    channels.forEach(channel => {
      try {
        const mq = ZMQ.socket('sub')
        mq.connect(`tcp://${host}:${port}`)
        mq.subscribe(channel)

        // redispatch events
        mq.on('message', (channel, data) => { 
          channel = channel.toString()

          ZMQProxies[channel] // proxy or emit directly
            ? ZMQProxies[channel](self, data)
            : self.emit(channel, data)
        })

        // reference for later
        self[channel] = mq

      }catch(e){ console.log('e', e) }
    })
  }

}


const ZMQProxies = {
  rawtx: (instance, rawtx) => {
    instance.emit('rawtx', rawtx)
    instance.emit('tx', Tx.fromBuffer(rawtx))
  },
  rawblock: (instance, rawblock) => {
    instance.emit('rawblock', rawblock)
    instance.emit('block', Block.fromBuffer(rawblock))
  }
}


export default new Zmq()