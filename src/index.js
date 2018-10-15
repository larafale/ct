import '@babel/polyfill'

import config from './config'
import _ from 'lodash'
import Rx from 'rxjs'

import { cluster } from './cluster'
import ctx from './ctx'
import chain from './chain'
import stream from './stream'
import Block from './block'
import expressapp, { server } from './express'
import mongoCon, { initMongo } from './mongo'
import { initRedis, redisAdapter, pubsub } from './redis'
import io from './io'
import watchlist from './watchlist'
import electrumx, { initElectrumx } from './electrumx'
import Invoice from './models/invoice'
import { log } from './services/logger'  
 

   
try {
 
  (async ()=>{
    console.log(`
      
---------------------------
  C O R E T O O L - 1 . 0
---------------------------
    `)



    log('global', 'config', config)
    log('global', 'start', { pid: process.pid, network: config.network })

    // start express server
    server.listen(config.port)
    log('http', 'ready', { port: config.port })
   
    // start io server
    io.attach(server)
    io.adapter(redisAdapter)
    log('io', 'ready', { port: config.port })

 
    initElectrumx()
      .then(client => log('electrumx', 'ready', client.options))
      .catch(err => log.error('electrumx', err))


    initRedis()
      .then(client => {
        log('redis', 'ready', client.options)

        // start cluster election
        cluster.startElection(true)
      })
      .catch(err => log.error('redis', err)) 


    initMongo()
      .then(db => {
        log('mongo', 'ready', { url: config.mongodb })

        // init watchlist
        Invoice.watchlist()
          .then(list => { log('watchlist', 'ready', { addresses: Object.keys(list).length }); return list })
          .then(watchlist.set)
          .catch(e => log.error('watchlist', e) )

        // confirm unsynced state
        Invoice.updateUnconfirmed(ctx.tip.height)

        // scan expired every minute
        Rx.Observable.interval(60000).subscribe(() => {
          Invoice.updateExpired()
        })
      })
      .catch(err => {
        log.error('mongo', err)
      })






    // on new tx
    stream.tx.subscribe(raw => {
      const height = ctx.tip.height
      const tx = raw.vanilla()
      const outputs = chain.scanForOutputs(raw)
      // outputs.length && console.log('outputs', outputs)

      if(!cluster.isMaster()) return

      io.of(config.ns).emit('tx', tx)
      Invoice.processOutputs(outputs, 'tx', height)
    })

    // on new block
    stream.block.subscribe(raw => {
      const height = ctx.tip.height + 1 // latest height
      const block = { ...raw.vanilla(), height }

      ctx.tip = { height, ts: block.ts } // update tip
      ctx.last_blocks.unshift(block) // add to last_blocks pile

      if(!cluster.isMaster()) return

      io.of(config.ns).emit('tip', ctx.tip)
      io.of(config.ns).emit('block', block)

      log('chain', 'new block', { height, hash: block.hash })

      const outputs = chain.scanForOutputs(raw)
      Invoice.processOutputs(outputs, 'block', height)
      Invoice.updateUnconfirmed(height)
    })


    process.on('warning', e => console.warn(e.stack));

    // gracefull shutdown of services
    process.on('SIGINT', () => {
 
      log.warn('global', `${cluster.id} shutdown [master:${cluster.isMaster()}]`)

      // Stops the server from accepting new connections and finishes existing connections.
      server.close(err => {
        if (err) {
          console.error(err)
          process.exit(1)
        }

        // close your database connection and exit with success (0 code)
        mongoCon.close(function () {
          process.exit(0)
        })
      })
    })


  })()

}catch(e){
  console.log('e', e)
}


