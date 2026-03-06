export const anilistQueryObject = `
id,
idMal,
type,
title {
  romaji,
  english,
  native,
  userPreferred
},
description(asHtml: false),
season,
seasonYear,
format,
status,
episodes,
chapters,
volumes,
duration,
averageScore,
popularity,
genres,
isFavourite,
coverImage {
  extraLarge,
  medium,
  color
},
source,
countryOfOrigin,
isAdult,
bannerImage,
synonyms,
nextAiringEpisode {
  timeUntilAiring,
  episode
},
startDate {
  year,
  month,
  day
},
endDate {
  year,
  month,
  day
},
trailer {
  id,
  site
},
streamingEpisodes {
  title,
  thumbnail
},
mediaListEntry {
  id,
  progress,
  repeat,
  status,
  customLists(asArray: true),
  score(format: POINT_10)
},
studios(isMain: true) {
  nodes {
    name
  }
},
airingSchedule(page: 1, perPage: 1, notYetAired: true) {
  nodes {
    episode,
    airingAt
  }
},
relations {
  edges {
    relationType(version:2),
    node {
      id,
      title {userPreferred},
      coverImage {medium},
      type,
      status,
      format,
      episodes,
      chapters,
      volumes,
      synonyms,
      season,
      seasonYear,
      startDate {
        year,
        month,
        day
      },
      endDate {
        year,
        month,
        day
      }
    }
  }
}`

/* ------------------------------------------------------ */

const query = `type: ANIME, search: $search, sort: $sort, onList: $onList, status: $status, status_not: $status_not, season: $season, seasonYear: $year, genre: $genre, format: $format, format_not: MUSIC`

export const getParsedAnilistQuery = (variables) => {
  const contentType = localStorage.getItem('contentType') || 'ANIME'
  const typeStr = contentType === 'MANGA' ? 'MANGA' : 'ANIME'

  let queryStr = `type: ${typeStr}`

  if (contentType === 'HENTAI') {
    if (!variables?.isAdult) queryStr += `, isAdult: true`
  } else {
    if (!variables?.isAdult) queryStr += `, isAdult: false`
  }

  for (const key in variables) {
    // generate the query string
    if (variables[key] && variables[key] && key !== 'watchStatus' && key !== 'userId') {
      if (key === 'isAdult' && variables[key] === 'false') {
        queryStr += `, isAdult: false`
      } else if (key === 'isAdult' && variables[key] === 'true') {
        queryStr += `, isAdult: true`
      } else {
        queryStr += `, ${key}: ${variables[key]}`
      }
    }
  }

  return queryStr
}
