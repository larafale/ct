import _ from 'lodash'


export const dump = (obj, i) => {
  const n = Number(i || 0)
  const indent = Array(2 + n).join("-")

  for(let key in obj) {
    if(obj.hasOwnProperty(key)) {
      const isF = typeof obj[key] === 'function'
      console.log(`${indent} ${key}${isF?'()':''}`)
    }
  }

  if(obj) {
    if(Object.getPrototypeOf) {
      dump(Object.getPrototypeOf(obj), n + 1)
    } else if(obj.__proto__) {
      dump(obj.__proto__, n + 1)
    }
  }
}


//  string/array to array
export const asArray = (input, { delim = ',', trim = true, uniq = true, compact = true } = {}) => {
  let output = typeof input == 'string'
    ? input.split(delim)
    : input || []

  if(trim) output = _.map(output, v => (typeof v == 'string' ? v.trim() : v))
  if(compact) output = _.compact(output)
  if(uniq) output = _.uniq(output)

  return output
}


// Flatten deep object
// flatten({ a: 'b', foo: { bar: 'baz' }}) => { 'a': 'b' , 'foo.bar': 'baz' }
// tostring return all value to string, for example service like sendgrid who dont accept other types
export const flatten = (object, sep = '.', toString = false) => {
  const isRealObject = (o) => {
    return typeof o === 'object' 
        && o != null
        && !(o instanceof Date)
  }
  
  const flat =  Object.assign({}, ...function _flatten(objectBit, path = '' ) {
    return [].concat(
      ...Object.keys(objectBit).map(
        key => {
          const value = objectBit[key]
          return isRealObject(value)
            ? _flatten(value, `${path}${sep}${key}`)
            : ({ [`${path}${sep}${key}`]: toString
                ? ''+value 
                : value 
              })
        }
      )
    )
  }(object))

  return Object.keys(flat).reduce((acc, key) => {
    acc[key.replace(sep, '')] = flat[key]
    return acc
  }, {})
}



export const money = function(number, symbol = "$", places = 2, thousand = ",", decimal = ".") {
  let negative = number < 0 ? "-" : "",
      i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
      j = (j = i.length) > 3 ? j % 3 : 0
  let string = negative 
    + (j ? i.substr(0, j) + thousand : "") 
    + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) 
    + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "")
  
  if(symbol == "$") string = symbol+string
  else if(symbol) string = string+symbol
  
  return string
}


export const is = {

  email: email => { 
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(email)
  },

  notEmpty: (o = {}) => {
    return Object.keys(o).length ? o : false
  }

}

  






