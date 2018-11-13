import config from './config'
import mongoose from 'mongoose'

mongoose.Promise = global.Promise
mongoose.set('useCreateIndex', true)

const db = mongoose.connection

export default db

export const initMongo = () => {
	return new Promise((resolve, reject) => {
	  // return connection if allready open (in test for example)
	  if(mongoose.connection.readyState == 1) return resolve(db)
	    
	  mongoose.connect(config.mongodb,  { useNewUrlParser: true }, err => {
	  	if(err) reject(err)
	  	else resolve(db)
	  })
		
	})
}

export const dropDatabase = () => {
  return new Promise((resolve, reject) => {
    db.dropDatabase(err => {
      err ? reject(err) : resolve()
    })
  })
}