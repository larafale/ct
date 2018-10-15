import config from './config'
import fs from 'fs-extra'
import _ from 'lodash'
import { Block } from 'bitcoinjs-lib'



export default Block

// Load Block from file
Block.fromFile = async (hash, network) => 
  Block.fromBuffer(await fs.readFile(`./data/${network || config.network}/blocks/${hash}`))


// Save Block to file
Block.toFile = async (block) => {
  return await fs.writeFile(`./data/${config.network}/blocks/${block.getId()}`, block.toBuffer())
}

Block.prototype.vanilla = function(){
  return {
      hash: this.getId()
    , tx: this.transactions.length
    , size: this.byteLength()
    , ts: this.timestamp
  }
} 
 

Block.prototype.findOutputs = function(options){
  return this.find('outputs', options)
}

Block.prototype.findInputs = function(options){
  return this.find('inputs', options)
}

Block.prototype.find = function(type, options){

  const blockhash = this.getId()
  const ts = this.timestamp
  const proxy = {
      outputs: 'findOutputs'
    , inputs: 'findInputs'
  }


  let items = _.flatten(this.transactions.map((tx, i) => {
    return tx[proxy[type]](options)
  }))

  // appen blockhash & ts
  items = _.map(items, el => {
    if(options.hydrate){
      el.blockhash = blockhash
      el.ts = ts
    }
    return el
  })

  return items
}


// return total sats of outputs
Block.prototype.getOutputsTotal = function() {
  return this.transactions.reduce((acc, tx) => acc + tx.getOutputsTotal(), 0)
}

