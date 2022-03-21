import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {
  Director,
  Film,
  MAXINT32,
  PageURLField,
  PlainTextHTMLField,
} from 'uncanon-types'
import { fileURLToPath } from 'url'
import db from './store'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SearchMovieData {
  results: {
    id: string
    resultType: string
    image: string
    title: string
    description: string
  }[]
}

interface TitleData {
  originalTitle: string
  image: string
  plot: string
  directors: string
  writers: string
  stars: string
  wikipedia: {
    url: string
    plotShort: PlainTextHTMLField
    plotFull: PlainTextHTMLField
  }
}

interface SummaryData {
  thumbnail?: {
    source: string
  }
  content_urls: {
    desktop: PageURLField
    mobile: PageURLField
  }
  extract: string
  extract_html: string
}

class APIClient {
  axios: AxiosInstance
  defaultNumRequests: number
  defaultRetryDelay: number

  constructor(private baseURL: string) {
    this.axios = Axios.create({
      baseURL: baseURL,
      timeout: 10_000,
    })
    this.defaultNumRequests = 3
    this.defaultRetryDelay = 3_000
  }

  async requestRetry<T>(
    path: string,
    numRequests?: number,
    retryDelay?: number
  ): Promise<AxiosResponse<T, any>> {
    let exception: unknown
    for (let i = 0; i < (numRequests || this.defaultNumRequests); i++) {
      if (i > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelay || this.defaultRetryDelay)
        })
      }
      try {
        const res = await this.axios.get<T>(path)
        return res
      } catch (ex) {
        exception = ex
      }
    }
    throw exception
  }

  async fetchData<T>(path: string): Promise<T | null> {
    try {
      const res = await this.requestRetry<T>(path)
      if (res.status === 200) {
        return res.data
      }
      return null
    } catch (ex) {
      return null
    }
  }
}

export class IMDBClient extends APIClient {
  constructor(baseURL: string, private apiKey: string) {
    super(baseURL)
  }

  async searchMovie(searchString: string): Promise<SearchMovieData | null> {
    return await this.fetchData(
      `/SearchMovie/${this.apiKey}/${encodeURIComponent(searchString)}`
    )
  }

  async title(id: string): Promise<TitleData | null> {
    return await this.fetchData(`/Title/${this.apiKey}/${id}/Wikipedia`)
  }
}

export class WikipediaClient extends APIClient {
  async summary(title: string): Promise<object | null> {
    return await this.fetchData(`/page/summary/${encodeURIComponent(title)}`)
  }
}

export async function mergeWikipediaData(doFetch: boolean = false) {
  if (!process.env.NEDB_PERSISTENCE_DIRECTORY) {
    throw new Error('NEDB_PERSISTENCE_DIRECTORY missing from env.')
  }

  const apiBase = process.env.WIKIPEDIA_API_BASE
  let summaryResults: { [key: number]: object } = {}
  if (apiBase) {
    const client = new WikipediaClient(apiBase)
    const directors: Director[] = await db.directors.find({})

    // Fetch Summary data.
    //
    if (doFetch) {
      console.log('Fetching Summary data...')
      for (let director of directors) {
        try {
          const result = await client.summary(`${director.name}`)
          if (result) {
            summaryResults[Number(director._id)] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/summaryResults.json',
        JSON.stringify(summaryResults)
      )
    }

    let json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/summaryResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('Summary data flagged as incorrect:')
    for (let director of directors) {
      if (!json.hasOwnProperty(director._id)) {
        console.log(`\t${director._id} missing.`)
      }
    }
    for (let directorID in json) {
      const result = json[directorID]
      if (
        typeof result.content_urls?.desktop?.page !== 'string' ||
        typeof result.content_urls?.mobile?.page !== 'string' ||
        typeof result.extract !== 'string' ||
        typeof result.extract_html !== 'string'
      ) {
        console.log(`\t${directorID} malformed.`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with Wikipedia Summary data.
    //
    for (let directorID in json) {
      const result = json[directorID]
      await db.directors.update(
        { _id: Number(directorID) },
        {
          $set: {
            thumbnail: result.thumbnail,
            contentURLs: {
              desktop: { page: result.content_urls.desktop.page },
              mobile: { page: result.content_urls.mobile.page },
            },
            extract: result.extract,
            extractHTML: result.extract_html,
          },
        }
      )
    }
  } else {
    throw new Error('WIKIPEDIA_API_BASE missing from env.')
  }
}

async function mergeIMDBData(doFetch: boolean = false) {
  if (!process.env.NEDB_PERSISTENCE_DIRECTORY) {
    throw new Error('NEDB_PERSISTENCE_DIRECTORY missing from env.')
  }

  const apiBase = process.env.IMDB_API_BASE
  const apiKey = process.env.IMDB_API_KEY
  let searchMovieResults: { [key: number]: object } = {}
  let titleResults: { [key: number]: object } = {}
  if (apiBase && apiKey) {
    const client = new IMDBClient(apiBase, apiKey)
    const films: Film[] = await db.films.find({})

    // Fetch SearchMovie data.
    //
    if (doFetch) {
      console.log('Fetching SearchMovie data...')
      for (let film of films) {
        try {
          const result = await client.searchMovie(`${film.title} ${film.year}`)
          if (result) {
            searchMovieResults[Number(film._id)] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/searchMovieResults.json',
        JSON.stringify(searchMovieResults)
      )
    }

    let json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/searchMovieResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('SearchMovie data flagged as incorrect:')
    for (let filmID in json) {
      const result = json[filmID]
      if (result.results.length !== 1) {
        console.log(`\t[${filmID}]: ${result.results.length} results`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with IMDB IDs.
    //
    for (let filmID in json) {
      const result = json[filmID]
      await db.films.update(
        { _id: Number(filmID) },
        { $set: { imdbID: result.results[0].id } }
      )
    }

    // Fetch Title data.
    //
    if (doFetch) {
      console.log('Fetching Title data...')
      for (let film of films) {
        try {
          const result = await client.title(film.imdbID)
          if (result) {
            titleResults[Number(film._id)] = result
          }
        } catch (ex) {
          console.log(ex)
        }
      }
      fs.writeFileSync(
        __dirname +
          process.env.NEDB_PERSISTENCE_DIRECTORY +
          '/titleResults.json',
        JSON.stringify(titleResults)
      )
    }

    json = JSON.parse(
      fs
        .readFileSync(
          __dirname +
            process.env.NEDB_PERSISTENCE_DIRECTORY +
            '/titleResults.json'
        )
        .toString('utf-8')
    )

    // Flag incorrect results.
    //
    console.log('Title data flagged as incorrect:')
    for (let filmID in json) {
      const result = json[filmID]
      if (
        typeof result.originalTitle !== 'string' ||
        typeof result.image !== 'string' ||
        typeof result.plot !== 'string' ||
        typeof result.directors !== 'string' ||
        typeof result.writers !== 'string' ||
        typeof result.stars !== 'string' ||
        typeof result.wikipedia?.url !== 'string' ||
        typeof result.wikipedia?.plotShort?.plainText !== 'string' ||
        typeof result.wikipedia?.plotShort?.html !== 'string' ||
        typeof result.wikipedia?.plotFull?.plainText !== 'string' ||
        typeof result.wikipedia?.plotFull?.html !== 'string'
      ) {
        console.log(`\t${filmID}`)
      }
    }
    console.log('\t(END)\n')

    // Update DB with IMDB Title data.
    //
    for (let filmID in json) {
      const result = json[filmID]
      await db.films.update(
        { _id: Number(filmID) },
        {
          $set: {
            originalTitle: result.originalTitle,
            image: result.image,
            plot: result.plot,
            directorsText: result.directors,
            writers: result.writers,
            stars: result.stars,
            wikipedia: {
              url: result.wikipedia.url,
              plotShort: result.wikipedia.plotShort,
              plotFull: result.wikipedia.plotFull,
            },
          },
        }
      )
    }
  } else {
    throw new Error('IMDB_API_BASE, IMDB_API_KEY missing from env.')
  }
}

async function fetchToFile(axios: AxiosInstance, url: string, path: string) {
  const writer = fs.createWriteStream(path)

  const res = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })

  res.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

async function processImage(filePath: string): Promise<string> {
  const fileSize = fs.statSync(filePath).size
  const extension = path.extname(filePath).toLowerCase()

  const doResize = fileSize > 128 * 1024
  const doConvert = !['.jpg', '.png'].includes(extension)

  let importedFilePath = filePath
  if (doResize || doConvert) {
    const image = sharp(filePath)
    if (doResize) {
      const squeeze = Math.sqrt((128 * 1024) / fileSize)
      const { width, height } = await image.metadata()
      if (width && height) {
        const newWidth = Math.trunc(squeeze * width)
        const newHeight = Math.trunc(squeeze * height)
        await image
          .resize(newWidth, newHeight)
          .jpeg({ quality: 75 })
          .toFile(filePath + '.new')
      }
    } else if (doConvert) {
      await image.jpeg({ quality: 75 }).toFile(filePath + '.new')
    }

    fs.rename(filePath + '.new', filePath, () => {})
    if (doConvert) {
      importedFilePath = filePath.slice(0, -extension.length) + '.jpg'
      fs.rename(filePath, importedFilePath, () => {})
    }
  }

  return path.basename(importedFilePath)
}

async function fetchImages() {
  const axios = Axios.create()
  const imports: String[] = [
    `import { ImageSourcePropType } from 'react-native'`,
    '',
    `import PersonPlaceholder from '../../graphics/personPlaceholder.png'`,
    '',
  ]

  const nfilms = await db.films.count({})
  let i = 0
  for (let film of await db.films.find({})) {
    i++
    console.log(`Fetching film image ${i}/${nfilms}...`)
    const paddedID = film._id.toString().padStart(2, '0')
    const fileName = `film_${paddedID}${film.image.slice(-4).toLowerCase()}`
    const filePath = __dirname + process.env.IMAGE_DIRECTORY + `/${fileName}`
    await fetchToFile(axios, film.image, filePath)
    const importedFileName = await processImage(filePath)
    imports.push(`import Film_${paddedID} from './${importedFileName}'`)
  }

  imports.push('')
  const ndirectors = await db.directors.count({})
  const skippedDirectors: number[] = []
  i = 0
  for (let director of await db.directors.find({})) {
    i++
    const paddedID = director._id.toString().padStart(2, '0')
    if (director.thumbnail) {
      console.log(`Fetching director image ${i}/${ndirectors}...`)

      const fileName = `director_${paddedID}${director.thumbnail.source
        .slice(-4)
        .toLowerCase()}`
      const filePath = __dirname + process.env.IMAGE_DIRECTORY + `/${fileName}`
      await fetchToFile(axios, director.thumbnail.source, filePath)
      const importedFileName = await processImage(filePath)
      imports.push(`import Director_${paddedID} from './${importedFileName}'`)
    } else {
      console.log(`Skipping director ${i}/${ndirectors} (no thumbnail source)`)
      skippedDirectors.push(i)
    }
  }

  imports.push('')
  imports.push(`export const FilmImages: ImageSourcePropType[] = [`)
  imports.push('  undefined,')
  for (i = 1; i <= nfilms; i++) {
    imports.push(`  Film_${i.toString().padStart(2, '0')},`)
  }
  imports.push(']')

  imports.push('')
  imports.push(`export const DirectorImages: ImageSourcePropType[] = [`)
  imports.push('  undefined,')
  for (i = 1; i <= ndirectors; i++) {
    if (skippedDirectors.includes(i)) {
      imports.push('  PersonPlaceholder,')
    } else {
      imports.push(`  Director_${i.toString().padStart(2, '0')},`)
    }
  }
  imports.push(']')

  const importsFile = __dirname + process.env.IMAGE_DIRECTORY + '/index.ts'
  console.log(`Writing imports to '${importsFile}'`)

  const importsFlat = imports.join('\n')

  fs.writeFileSync(importsFile, importsFlat)
}

export interface SeedOptions {
  reset: boolean
  doMergeIMDB: boolean
  doFetchIMDB: boolean
  doMergeWikipedia: boolean
  doFetchWikipedia: boolean
  doFetchImages: boolean
}

async function seed({
  reset,
  doMergeIMDB,
  doFetchIMDB,
  doMergeWikipedia,
  doFetchWikipedia,
  doFetchImages,
}: SeedOptions): Promise<void> {
  if (reset) {
    await db.reset()
    console.log('Existing DB files deleted.')
  }

  const existing = await db.directors.count({})
  if (existing === 0) {
    const directors = require('./directors.csv').map((d: any) => ({
      ...d,
      deathYear: d.deathYear || MAXINT32,
    }))
    db.directors.insert(directors)
    console.log(`Inserted ${await db.directors.count({})} directors.`)

    const films = require('./films.csv').map((f: any) => ({
      ...f,
      directors: eval(f.directors),
    }))
    db.films.insert(films)
    console.log(`Inserted ${await db.films.count({})} films.`)
  } else {
    console.log(
      `Not inserting: found ${await db.directors.count({})} directors.`
    )
  }

  if (doMergeIMDB) {
    await mergeIMDBData(doFetchIMDB)
  }

  if (doMergeWikipedia) {
    await mergeWikipediaData(doFetchWikipedia)
  }

  if (doFetchImages) {
    await fetchImages()
  }
}

export default seed
