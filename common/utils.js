const encUrls = {
  tosho: decodeURIComponent(atob('aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3Jn')),
  pahe: decodeURIComponent(atob('aHR0cHM6Ly9hbmltZXBhaGUuc2k=')),
  paheimages: decodeURIComponent(atob('aHR0cHM6Ly9pLmFuaW1lcGFoZS5zaQ==')),
  nyaaApi: decodeURIComponent(atob('aHR0cHM6Ly9ueWFhYXBpLm9ucmVuZGVyLmNvbS9ueWFh'))
}

function isTruthyWithZero(value) {
  return Boolean(value) || value === 0
}

export { isTruthyWithZero }

export default encUrls
