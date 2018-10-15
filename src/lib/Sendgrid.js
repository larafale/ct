import Sender from 'uteel-sender'
import $sendgrid from '@sendgrid/mail'
import _ from 'lodash'
import { asArray } from '../utils'



export default options => { 

  $sendgrid.setApiKey(options.apikey)

  const handler = async (template, to, subs, { renderKeys }) => {
    subs = template.subs || subs // merge additonal subs from initTemplate()
    
    // prepare tos
    let tos = []
    if(Array.isArray(to)) tos = to
    if(typeof to === 'function') tos = to(template)
    if(typeof to === 'string') tos = to.split(',')
      
    // prepare bcc (blind carbon copy)
    template.bcc = asArray(template.bcc)

    // prepare forceTo
    options.forceTo = asArray(options.forceTo)

    const meta = {
        tpl: `${(subs._tpl && subs._tpl.key) || 'not set'}`
      , mock: !!options.mock
      , tos: tos
      , force: options.forceTo
      , bcc: template.bcc
    }

    // log
    if(options.log) options.log(`email`, `process`, meta)
    
    // overide tos (place after debug)
    if(options.forceTo.length) tos = options.forceTo

    // interpolate some template keys (subject for instance)
    template = { ...template, ...renderKeys(template, subs, ['subject']) }
    

    // init ctx
    const ctx = {
      error: false, 
      email: undefined,
      response: false
    }


    ctx.email = {
        from: template.from || options.from
      , to: tos
      , bcc: template.bcc
      , subject: template.subject || ''
      , templateId: template.template_id
      , dynamic_template_data: subs
      , isMultiple: true
      , substitutionWrappers: ['{{','}}']
    }
    
    // mock
    if(options.mock) {
      ctx.mocked = true
      return ctx
    }

    return await (new Promise(resolve => {
      try {
        $sendgrid.send(ctx.email, (err, [res]) => {
          if(err && options.log) options.log.error(`sengrid`, `process`, err)
          
          ctx.error = !(res && res.statusCode == 202)
          ctx.response = (err && err.response) || err || res.toJSON() // sendgrid response
          try { ctx.error = ctx.response.body.errors || false }catch(e){} // get a more precise error
          console.log('ctx', ctx)
          resolve(ctx)
        })
      }catch(e){
        ctx.error = e 
        console.log('ctx', ctx)
        return ctx
      }
    })) 

  }

  const initTemplate = async (name, subs, { fetchJson }) => {
    try {
      const [key, lang] = name.split(':')
      const template = (typeof options.templates == 'string'
        ? (await fetchJson(options.templates))
        : options.templates
      )[key]

      // pass down enhanced subs
      template.subs = { ...subs, _tpl: { key }}

      return template
    }catch(e){
      throw new Error(`unable to fetch template "${name}"`)
    }
  }

  return Sender(handler, initTemplate)

}




