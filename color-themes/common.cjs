function radixColorsWithoutName(colors, fg) {
  const newObj = { fg }
  Object.entries(colors).forEach(([k, v]) => {
    if (k.endsWith('10') || k.endsWith('11') || k.endsWith('12')) {
      newObj[parseInt(k.slice(-2), 10)] = v
    } else {
      newObj[parseInt(k.slice(-1), 10)] = v
    }
  })
  return newObj
}

function appendRadixColor(colors, newColor) {
  const newObj = {}
  Object.entries(colors).forEach(([k, v]) => {
    if (k > 1) {
      newObj[k - 1] = v
    }
  })
  newObj[12] = newColor
  return newObj
}

module.exports = {
  radixColorsWithoutName,
  appendRadixColor,
}
