import { Observable, Subject } from 'rxjs'
import 'rxjs/add/operator/map'
import zmq from './zmq'


const streams = {
    tx: new Subject()
  , block: new Subject()
}

// all is a combination of all events
streams.all = Observable.merge(
    streams.tx.map(item => { item.type = 'tx'; return item }) 
  , streams.block.map(item => { item.type = 'block'; return item })
)



// increment stream on zmq event
zmq.on('tx', tx => {
  // console.log('> [new tx]', tx.getId())
  streams.tx.next(tx)
})

// increment stream on zmq event
zmq.on('block', block => {
  streams.block.next(block)
})



export default streams
