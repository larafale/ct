import mongoose from 'mongoose'

/*
 * Adds error handling middlewares into a given schema.
 */
export default function ProcessMongoDBErrors(schema) {
  schema.post('save', mongodbErrorHandler)
  schema.post('update', mongodbErrorHandler)
  schema.post('findOneAndUpdate', mongodbErrorHandler)
  schema.post('insertMany', mongodbErrorHandler)
}


function mongodbErrorHandler (err, doc, next) {
  if (err.name !== 'MongoError' || err.code != 11000) {
    return next(err)
  }

  try{
    const path = err.message.split('index: ')[1].split('_1 dup ')[0]
    const value = ''

    const validationError = new mongoose.Error.ValidationError()
    validationError.errors[path] = validationError.errors[path] || {}
    validationError.errors[path].kind = 'duplicate'
    validationError.errors[path].value = value
    validationError.errors[path].path = path
    validationError.errors[path].message = '{0} already exist.'.replace('{0}', path)
    validationError.errors[path].reason = err.message
    validationError.errors[path].name = err.name

    next(validationError)

  }catch(e){
    next()
  }

}

