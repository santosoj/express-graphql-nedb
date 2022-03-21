import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'
import { Director, Film } from 'uncanon-types'
import { fileURLToPath } from 'url'
import db, { OrderBy } from './data/store'

const __filename = fileURLToPath(import.meta.url)

// await seed({
//   reset: false,
//   doMergeIMDB: false,
//   doFetchIMDB: false,
//   doMergeWikipedia: false,
//   doFetchWikipedia: false,
//   doFetchImages: true,
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

  type FilmStub {
    _id: ID!
    title: String!
    image: String!
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
    film: FilmStub!
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
    const directors = await db.orderBy(db.directors.find({}), args?.orderBy)

    return await directors.map(async (d) => {
      const film = await db.films.findOne({
        directors: { $elemMatch: d._id },
      })
      if (film) {
        return {
          ...d,
          film: { _id: film._id, title: film.title, image: film.image },
        }
      }
      return d
    })
  },
  director: async ({ _id }: IDArgs) => {
    const director = await db.directors.findOne({ _id: Number(_id) })
    if (director) {
      const film = await db.films.findOne({
        directors: { $elemMatch: director._id },
      })
      if (film) {
        return {
          ...director,
          film: { _id: film?._id, title: film.title, image: film.image },
        }
      }
      return director
    }
    return null
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
