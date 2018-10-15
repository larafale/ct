import config from './config'
import { log } from './services/logger'
import redis, { isReady, pubsub } from './redis'


export const cluster = { 
    id: `${config.network}-${process.env.pm_id||0}-${process.env.INSTANCE_ID||0}` || new Date%1000 // random instance id
  , masterId: '' // id of master instance, yet to be defined
  , ns: `${config.network}:` // namespace redis key, and pususb
} 

// is this instance the master instance ?
cluster.isMaster = () => (cluster.id == cluster.masterId)

// notify all instances to re start an election
cluster.restartElection = () => { 
  pubsub.emit(`${cluster.ns}restartElection`, cluster.id) 
}

// election function 
cluster.startElection = (init) => { 
  // try to set lock on key "master" for 2 seconds
  const fn = () => redis.setAsync(`${cluster.ns}master`, cluster.id, 'EX', 2, 'NX') 
    .then((data) => {
      return data != 'OK' 
        ? false // not elected 
        : pubsub.emit(`${cluster.ns}newMaster`, cluster.id)
    }).catch(console.log)

  if(init) setTimeout(fn, 2500) // on init call, wait the 2s lock before trigger the set()
  else fn()
}

// restart election in case of master shuting down
pubsub.on(`${cluster.ns}restartElection`, (clusterId) => {
  cluster.startElection()
})  

// on new master elected, update masterId
pubsub.on(`${cluster.ns}newMaster`, masterId => { 
  cluster.masterId = masterId 
  if(cluster.isMaster()) log('cluster', `${masterId} elected`)
}) 

// on process exit or failure, restart election (all intances concerned)
process.on('SIGINT', () => cluster.restartElection() ) 

