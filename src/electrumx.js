import config from './config'
import net from 'net' 
import url from 'url'
import Random from 'random-js'
const R = Random()

import { addressToScriptHash } from './address'
import { log } from './services/logger'
import { asArray } from './utils'



const options = Object.assign({
    host: '127.0.0.1'
  , port: 50001
}, { 
    host: url.parse(config.electrumx).hostname
  , port: url.parse(config.electrumx).port  
})


const socket = new net.Socket()
export { socket as default }

socket.options = options
socket.setNoDelay(true)
socket.setKeepAlive(true, 0)


const resolves = {}
const rejects = {}
let retrying = false



function makeConnection () {
  socket.connect(options)
}


export const initElectrumx = () => (new Promise(resolve => {
  makeConnection()  
  resolve(socket)
}))

// socket.on('end',     endHandler)
// socket.on('timeout', timeoutHandler)
// socket.on('drain',   drainHandler)
// socket.on('error',   errorHandler)


socket.on('connect', () => {
  // console.log('connected')
  retrying = false
})

socket.on('close', () => {
  if (!retrying) {
    retrying = true
    // console.log('Reconnecting...')
  }
  setTimeout(makeConnection, 1000)
})

socket.on('data', (data) => {
  try {
    const lines = data.toString().split('\n')
    lines.splice(-1,1) // clean last item of split (empty string)
    lines.map(line => {
      line = JSON.parse(line)
      if(line.error) rejects[line.id] && rejects[line.id](line.error)
      else resolves[line.id] && resolves[line.id](line.result)
    })
  }catch(e){
    log.error('electrumx', e)
  }
})


// Call electrumX RPC
// ex: 
// const result = await client.call('server.banner')
//
socket.call = (method, ...params) => {
  const call = { id: R.integer(1, 10000), method }
  if(params.length) call.params = params

  return new Promise((resolve, reject) => {
    // store promise handlers, to be called on data received
    resolves[call.id] = (value) => {
      resolve(value)
      delete resolves[call.id]
      delete rejects[call.id]
    }

    rejects[call.id] = (err) => {
      reject(err)
      delete resolves[call.id]
      delete rejects[call.id]
    }

    socket.write(`${JSON.stringify(call)}\n`)
  })
} 





// Input some addresses, get utxos indexed by address
export const listunspent = async addresses => {
  return new Promise(async (resolve, reject) => {
    addresses = asArray(addresses)

    try{
      
      Promise.all(addresses.map(
        a => socket.call('blockchain.scripthash.listunspent', addressToScriptHash(a, 'reverse'))
      ))
      .then(utxos => {
        const utxosByAddress = {}
        utxos.map((unspents, index) => { 
          const address = addresses[index]

          // append address to utxo
          unspents = unspents.map(v => {
            v.address = address
            return v
          })
          
          utxosByAddress[address] = unspents 
        })

        resolve(utxosByAddress)
      }) 
      .catch(err => {
        reject(err)
      }) 

    }catch(err){
      reject(err)
    }
  })
}


