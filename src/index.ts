import express from 'express'
import 'dotenv/config'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'

import db, { Director, Film, OrderBy } from './data/store'
import seed from './data/seed'

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// await seed(true, true, false)

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

  type PlainTextHTMLField {
    plainText: String!
    html: String!
  }

  type FilmWikipediaSection {
    plotShort: PlainTextHTMLField!
    plotFull: PlainTextHTMLField!
  }

  type Film {
    _id: ID!
    imdbID: String!
    title: String!
    year: Int!
    directors: [Director!]!
    originalTitle: String!
    image: String!
    plot: String!
    directorsText: String!
    writers: String!
    stars: String!
    wikipedia: FilmWikipediaSection!
  }

  type Query {
    hello: String
    directors(orderBy: OrderByInput): [Director!]!
    films(orderBy: OrderByInput): [Film!]!
    film(_id: ID!): Film
  }
`)

const root = {
  hello: () => 'Hello world!',
  directors: async (args?: { orderBy: OrderBy<Director> }) => {
    return await db.orderBy(db.directors.find({}), args?.orderBy)
  },
  films: async (args?: { orderBy: OrderBy<Film> }) => {
    const films = await db.orderBy(db.films.find({}), args?.orderBy)
    return await films.map((f) =>
      db.populate(f, [{ prop: 'directors', dataStore: db.directors }])
    )
  },
  film: async ({ _id }: { _id: string }) => {
    const film = await db.films.findOne({ _id: Number(_id) })
    if (film) {
      return await db.populate(film, [
        { prop: 'directors', dataStore: db.directors },
      ])
    }
    return null
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
