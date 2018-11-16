const _ = require('highland')
const { request } = require('./util')

const err = (repo, message) =>
  Object.assign(new Error(message), { repo })

const migrate = '/api/v1/repos/migrate'

// Migrate repository to Gogs.
export default opts => repo => {
  return request(`${opts.prefix}${migrate}`, {
    method: 'post',
    json: true,
    headers: {
      authorization: `token ${opts.token}`
    },
    form: Object.assign(
      {
        uid: repo.uid || opts.uid,
        clone_addr: repo.url,
        repo_name: repo.name,
        desc: repo.desc
      },

      repo.private && { private: true },

      (repo.auth || opts.auth) && {
        auth_username: repo.auth.pass || opts.auth.user,
        auth_password: repo.auth.pass || opts.auth.pass
      },

      opts.mirror && { mirror: true },
      opts.private && { private: true },

      {}
    )
  })
    .doto(response => {
      if (response.statusCode === 500) return // 500 errors have a JSON message.
      if (response.statusCode === 200 || response.statusCode === 201) return // JSON response.
      throw err(repo, `Unexpected status ${response.statusCode} from ${opts.prefix}${migrate}`)
    })
    .doto(response => _.log(`Done migrating ${repo.name} to ${response.body.html_url}`))
  
    .map(response => Object.assign({ repo }, response.body))

    .doto(({ repo, message }) => {
      if (message) throw err(repo, message)
    })
  }