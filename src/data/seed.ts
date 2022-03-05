import db, { Director, Film } from './store'

const MAXINT32 = 0x7fffffff

async function seed(reset: boolean = false): Promise<void> {
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
}

export default seed
