const _ = require('highland')
const { request: makeRequest } = require('./util')

const err = (repo, message) =>
    Object.assign(new Error(message), { repo })

const request = base => opts => {
    return makeRequest(Object.assign({ json: true }, opts, base))
        .doto(response => {
            if (response.statusCode === 500) return // 500 errors have a JSON message.
            if (response.statusCode === 200 || response.statusCode === 201) return // JSON response.
            throw err(undefined, `Unexpected status ${response.statusCode} from ${opts.url}: ${response.body && response.body.message}`)
        })
}

const requestGogs = opts => request(Object.assign({}, {
    headers: {
        authorization: `token ${opts['--gogs-token']}`
    },
    form: opts['--gogs-user'] && {
        auth_username: opts['--gogs-user'],
        auth_password: opts['--gogs-pass']
    }
}))

const requestGitblit = opts => request(
    Object.assign({}, opts['--gitblit-user'] && {
        auth: {
            user: opts['--gitblit-user'],
            pass: opts['--gitblit-pass']
        }
    })
)

const addOrganisation = repo => {
    let [name, _name] = repo.name.split('/')
    name = (name || _name).replace('.git', '')
    return _.extend({name, organization: repo.projectPath}, repo)
}

const findOrg = '/api/v1/orgs/'

const orgsCache = {}

const getOrgUIds = opts => repo => {
    if (!repo.organization || repo.organization === '') return _([repo])
    if (orgsCache[repo.organization]) return _([Object.assign({}, repo, {
        uid: orgsCache[repo.organization]
    })])
    return requestGogs(opts)({
            url: `${opts['--gogs-prefix']}${findOrg}${repo.organization}`,
        })
        .flatMap(response => [response.body])
        .doto(org => orgsCache[repo.organization] = org.id)
        // .doto(_.log)
        .map(org => Object.assign({}, repo, { uid: org.id }))
        // .collect()
}

export const repos = opts =>
    requestGitblit(opts)({
        url: `${opts['--gitblit']}/rpc/?req=LIST_REPOSITORIES`,
    })
    .flatMap(response => [response.body])
    .flatMap(repos => _.keys(repos).map(url => Object.assign({ url }, repos[url])))
    .uniqBy((a, b) => a.url === b.url)
    .map(addOrganisation)
    .map(({ name, url, description, organization }) => ({ name, url, desc: description, organization }))
    .flatMap(getOrgUIds(opts))
    // .pluck('uid').uniq()
    .compact()
    // .each(repo => {
    //     _.log(repo)
    // })
    .collect()
    .each(result => _.log(result, result.length)) // terminate for debugging
