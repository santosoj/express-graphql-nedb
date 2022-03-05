import express from 'express'
import 'dotenv/config'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'

import db, { Director, Film, OrderBy } from './data/store'
import seed from './data/seed'

import { IMDBClient } from './data/seed'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const apiBase = process.env.IMDB_API_BASE
const apiKey = process.env.IMDB_API_KEY
let client: IMDBClient
let searchMovieResults: { [key: number]: object } = {}
if (apiBase && apiKey) {
  client = new IMDBClient(apiBase, apiKey)
  const films: Film[] = await db.films.find({})
  for (let film of films) {
    console.log(film.title)
    try {
      const result = await client.searchMovie(film.title)
      if (result) {
        searchMovieResults[film._id] = result
      }
    } catch (ex) {
      console.log(ex)
    }
  }

  fs.writeFileSync(
    __dirname + '/searchMovieResults.json',
    JSON.stringify(searchMovieResults)
  )

  // const result = await client.searchMovie('scheisse')
  // console.log(JSON.stringify(result))
}
process.exit(0)

await seed(true)

const schema = buildSchema(`#graphql
  enum Sort {
    asc
    desc
  }

  input OrderByInput {
    order: [Sort]
    fields: [String]
  }

  type Director {
    _id: ID!
    name: String!
    lexKey: String!
    birthYear: Int!
    deathYear: Int
  }

  type Film {
    _id: ID!
    title: String!
    year: Int!
    directors: [Director!]!
  }

  type Query {
    hello: String
    directors(orderBy: OrderByInput): [Director!]!
    films(orderBy: OrderByInput): [Film!]!
  }
`)

const root = {
  hello: () => 'Hello world!',
  directors: async ({ orderBy }: { orderBy: OrderBy<Director> }) => {
    return await db.orderBy(db.directors.find({}), orderBy)
  },
  films: async ({ orderBy }: { orderBy: OrderBy<Film> }) => {
    const films = await db.orderBy(db.films.find({}), orderBy)
    return await films.map((f) =>
      db.populate(f, [{ prop: 'directors', dataStore: db.directors }])
    )
  },
}

const app = express()
const port = 3000

app.use(
  '/graphql',
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
)

app.listen(port, () => {
  console.log(`Express listening on port ${port}`)
})
