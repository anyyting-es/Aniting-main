// src/renderer/src/utils/bestMatch.js
// Simple string-similarity helper to pick the best AnimeAV1 search result

/**
 * Normalize a title for comparison: lowercase, strip common noise, collapse whitespace.
 */
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
}

/**
 * Compute a simple bigram-based similarity score between two strings (Dice coefficient).
 * Returns a value between 0 (no match) and 1 (identical).
 */
function diceCoefficient(a, b) {
  const aNorm = normalize(a)
  const bNorm = normalize(b)
  if (aNorm === bNorm) return 1

  if (aNorm.length < 2 || bNorm.length < 2) return 0

  const bigramsA = new Set()
  for (let i = 0; i < aNorm.length - 1; i++) {
    bigramsA.add(aNorm.substring(i, i + 2))
  }

  const bigramsB = new Set()
  for (let i = 0; i < bNorm.length - 1; i++) {
    bigramsB.add(bNorm.substring(i, i + 2))
  }

  let intersection = 0
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size)
}

/**
 * Given an array of search results (each with a `.title` property) and a target title,
 * pick the result whose title is the best match.
 *
 * If romaji and english titles are available, we try both and pick the higher score.
 */
export function pickBestResult(searchResults, targetTitles) {
  if (!searchResults || searchResults.length === 0) return null
  if (searchResults.length === 1) return searchResults[0]

  // targetTitles can be a string or { romaji, english }
  const titles =
    typeof targetTitles === 'string'
      ? [targetTitles]
      : [targetTitles?.romaji, targetTitles?.english].filter(Boolean)

  if (titles.length === 0) return searchResults[0]

  let bestResult = searchResults[0]
  let bestScore = -1

  for (const result of searchResults) {
    for (const target of titles) {
      const score = diceCoefficient(result.title, target)
      if (score > bestScore) {
        bestScore = score
        bestResult = result
      }
    }
  }

  return bestResult
}
