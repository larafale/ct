import config from './config'
import _ from 'lodash'
import fs from 'fs-extra'

import { Observable } from 'rxjs/Observable'

import zmq from './zmq'
import watchlist from './watchlist'
import bitcoind from './bitcoind'
import Block from './block'


class Chain {
  
  constructor() {
    super()  
  }


  tip() { return bitcoind.call('getblockcount') }
  getinfo() { return bitcoind.call('getblockchaininfo') }
  mempool() { return bitcoind.call('getmempoolinfo') }

  async getBlock(hash, { format, save }={}) {
    try {

      if(format == 'hex' || save){
        const hex = await bitcoind.call('getblock', hash, 0)
        if(save) Block.toFile(await Block.fromHex(hex))
        if(format == 'hex') return hex
      }

      const block = await bitcoind.call('getblock', hash)

      return {
          hash: hash
        , tx: block.tx.length
        , conf: block.confirmations
        , height: block.height
        , size: block.size
        , ts: block.time
        , prevhash: block.previousblockhash
        , network: config.network
      }
    }catch(e){
      return (e.message || 'unable to fetch block')
    }
  }

  // fetch n last blocks starting backward from prevHash
  // prevHash defaults to bestblock (chain tip)
  async blocks(n = 1, prevHash, blocks = []) {
    if(n == 0) return blocks

    const hash = prevHash || await bitcoind.call('getbestblockhash')

    const block = await this.getBlock(hash)

    blocks.push(block)

    return await this.blocks(n-1, block.prevhash, blocks)
  }

  scanForOutputs(item) {
    const addresses = watchlist.keys()
    // console.log('watchlist', addresses)
    const outputs = (addresses.length && item.findOutputs({ 
        addresses
      , script: false
      , hydrate: true
      , network: config.network 
    })) || []
    return outputs
  } 


}


export default new Chain()


