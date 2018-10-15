import config from './config'
import Rx from 'rxjs'
import url from 'url'
import chain from './chain'
import Pile from './lib/Pile'
import { events } from './io'
import { log } from './services/logger'

const ctx = {
    node: { network: config.network, host: url.parse(config.bitcoind).hostname }
  , mempool: {}
  , tip: { height: 0, ts: 0 }
  , last_blocks: Pile(5, [])
}

// init tip
chain.tip().then(height => {
  ctx.tip = { height }
  log('chain', 'ready', { height })
})

// init last blocks
chain.blocks(5).then(blocks => {
  ctx.last_blocks.unshift(...blocks)
  ctx.tip.ts = ctx.last_blocks[0].ts // set tip timestamp
})


// update mempool info
Rx.Observable.interval(20000).startWith(0).subscribe(() => {
  chain.mempool().then(mempool => {
    ctx.mempool = mempool
    events.mempool() // emit io event
  })
})

export default ctx