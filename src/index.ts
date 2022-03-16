import cors from 'cors'
import express from 'express'
import 'dotenv/config'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema, execute, ExecutionArgs } from 'graphql'

import db, { Director, Film, OrderBy } from './data/store'
import seed from './data/seed'

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import qDirector from './graphql/director.graphql'
import qDirectors from './graphql/directors.graphql'
import qFilm from './graphql/film.graphql'
import qFilms from './graphql/films.graphql'

// await seed({
//   reset: true,
//   doMergeIMDB: true,
//   doFetchIMDB: false,
//   doMergeWikipedia: true,
//   doFetchWikipedia: false,
// })

// process.exit(0)

const schema = buildSchema(`#graphql
  enum Sort {
    asc
    desc
  }

  type PageURLField {
    page: String!
  }

  type PlainTextHTMLField {
    plainText: String!
    html: String!
  }

  type Thumbnail {
    source: String!
  }

  type ContentURLs {
    desktop: PageURLField
    mobile: PageURLField
  }

  type Director {
    _id: ID!
    name: String!
    lexKey: String!
    birthYear: Int!
    deathYear: Int
    thumbnail: Thumbnail
    contentURLs: ContentURLs!
    extract: String!
    extractHTML: String!
  }

  type FilmWikipediaSection {
    plotShort: PlainTextHTMLField!
    plotFull: PlainTextHTMLField!
    url: String!
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

  input OrderByInput {
    order: [Sort!]
    fields: [String!]
  }

  type Query {
    directors(orderBy: OrderByInput): [Director!]!
    director(_id: ID!): Director
    films(orderBy: OrderByInput): [Film!]!
    film(_id: ID!): Film
  }
`)

interface IDArgs {
  _id: string
}

const root = {
  directors: async (args?: { orderBy: OrderBy<Director> }) => {
    return await db.orderBy(db.directors.find({}), args?.orderBy)
  },
  director: async ({ _id }: IDArgs) => {
    return await db.directors.findOne({ _id: Number(_id) })
  },
  films: async (args?: { orderBy: OrderBy<Film> }) => {
    const films = await db.orderBy(db.films.find({}), args?.orderBy)
    return await films.map((f) =>
      db.populate(f, [{ prop: 'directors', dataStore: db.directors }])
    )
  },
  film: async ({ _id }: IDArgs) => {
    const film = await db.films.findOne({ _id: Number(_id) })
    if (film) {
      return await db.populate(film, [
        { prop: 'directors', dataStore: db.directors },
      ])
    }
    return null
  },
}

// const result = await execute({
//   schema,
//   document: qDirector,
//   rootValue: root,
//   variableValues: {
//     id: '23',
//   },
// })

// console.log(JSON.stringify(result))

const app = express()
const port = 3000

app.use(cors())
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
