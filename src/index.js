const Pdfkit = require('pdfkit')
const unidecode = require('unidecode-plus')
const Jimp = require('jimp')
const dataset = require('./dataset.json')
const svg = require('./svgdata.json')

const supportedOutputTypes = ['jpeg/buf', 'png/buf', 'jpeg/b64', 'png/b64']
const symbols = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  .split('').concat(['margin'])
const jimpObjectPromises = []
for (let i = 0; i < symbols.length; i += 1) {
  for (let j = 0; j < 6; j += 1) {
    dataset[i][j] = Buffer.from(dataset[i][j])
    jimpObjectPromises.push(Jimp.read(dataset[i][j]))
  }
}
let jimpObjects

function wrapText (str, width) {
  if (str.length > width) {
    let p = width
    while (p > 0 && str[p] !== ' ') {
      p -= 1
    }
    if (p > 0) {
      const left = str.substring(0, p)
      const right = str.substring(p + 1)
      return `${left}\n${wrapText(right, width)}`
    }
  }
  return str
}

function findMaxLen (lines) {
  let width = lines[0] ? lines[0].length : 0
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] && lines[i].length > width) {
      width = lines[i].length
    }
  }
  return width
}

function padText (str, batchSize) {
  const lines = str.split('\n')
  const padding = Array.from({
    length: batchSize + 1
  }).join(' ')
  let paddedLines = []
  const paddedParagraphs = []
  lines.forEach((element) => {
    if (element) {
      paddedLines.push((element + padding).substring(0,
        batchSize))
    } else {
      paddedLines.push(padding)
    }
    if (paddedLines.length === batchSize) {
      paddedParagraphs.push(paddedLines)
      paddedLines = []
    }
  })
  if (paddedLines.length !== 0) {
    while (paddedLines.length !== batchSize) {
      paddedLines.push(padding)
    }
    paddedParagraphs.push(paddedLines)
  }
  return paddedParagraphs
}

function cleanText (rawText) {
  return unidecode(rawText, {
    german: true,
    smartSpacing: true
  }).trim()
}

function randInt (n) {
  return Math.floor(Math.random() * n)
}

function getBatchSize () {
  let batchSize = 10
  for (let i = 0; i < 176; i += 1) {
    if (randInt(8) === 1) {
      batchSize += 1
    }
  }
  return batchSize
}

function processText (rawText) {
  const batchSize = getBatchSize()
  const str = cleanText(rawText.replace('\t', '     ').replace('\r', '\n')
    .replace('\f', '\n').replace('\v', '\n'))
  const maxLen = findMaxLen(str.replace('\n', ' ').split(' '))
  const width = maxLen > batchSize ? maxLen : batchSize
  const wrappedText = []
  str.split('\n').forEach((element) => {
    wrappedText.push(wrapText(element, width))
  })
  return [padText(wrappedText.join('\n'), width), width]
}

function checkArgType (rawText, optionalArgs) {
  if (typeof (optionalArgs) !== 'object') {
    return false
  }
  if (typeof (rawText) !== 'string') {
    return false
  }
  if (typeof (optionalArgs.outputtype) !== 'string' && typeof (optionalArgs
    .outputtype) !== 'undefined') {
    return false
  }
  if (typeof (optionalArgs.ruled) !== 'boolean' && typeof (optionalArgs
    .ruled) !== 'undefined') {
    return false
  }
  if (typeof (optionalArgs.ruled) === 'boolean' && typeof (optionalArgs
    .outputtype) === 'string' && Object.keys(optionalArgs).length !==
        2) {
    return false
  }
  if (typeof (optionalArgs.ruled) === 'boolean' && typeof (optionalArgs
    .outputtype) === 'undefined' && Object.keys(optionalArgs).length !==
        1) {
    return false
  }
  if (typeof (optionalArgs.ruled) === 'undefined' && typeof (optionalArgs
    .outputtype) === 'string' && Object.keys(optionalArgs).length !==
        1) {
    return false
  }
  if (typeof (optionalArgs.ruled) === 'undefined' && typeof (optionalArgs
    .outputtype) === 'undefined' && Object.keys(optionalArgs).length > 1) {
    return false
  }
  return true
}

function isArgValid (outputType) {
  return supportedOutputTypes.concat(['pdf']).includes(outputType)
}

function generateImageArray (str, ruled, width) {
  const imgArray = []
  str.forEach((page) => {
    const baseImage = new Jimp(18 * width + 100, 50 * width + 100,
      '#ffffff')
    let y = 50
    page.forEach((line) => {
      let x = 50
      line.split('').forEach((character) => {
        if (symbols.includes(character)) {
          baseImage.composite(jimpObjects[
            symbols.indexOf(
              character
            )][randInt(
            6
          )], x, y)
        } else {
          baseImage.composite(jimpObjects[
            symbols.indexOf(' ')][
            randInt(6)
          ], x, y)
        }
        if (ruled) {
          baseImage.composite(jimpObjects[
            symbols.indexOf(
              'margin'
            )][randInt(
            6
          )], x, y)
        }
        x += 18
      })
      y += 50
    })
    imgArray.push(baseImage.resize(2480, 3508))
  })
  return imgArray
}

function generateImages (imageArray, outputType) {
  const promisesToKeep = []
  imageArray.forEach((image) => {
    if (outputType.slice(-4, outputType.length) === '/buf') {
      promisesToKeep.push(image.getBufferAsync(
          `image/${outputType.slice(0, -4)}`
      ))
    } else {
      promisesToKeep.push(image.getBase64Async(
          `image/${outputType.slice(0, -4)}`
      ))
    }
  })
  return Promise.all(promisesToKeep)
}

function vectorPdf (str, ruled, width) {
  let doc
  const adjustScaleX = 2380 / width / 18
  const adjustScaleY = 3408 / width / 50
  str.forEach((page) => {
    if (typeof (doc) === 'undefined') {
      doc = new Pdfkit({
        size: [2480, 3508]
      })
      doc.translate(50.000000, 50.0 + 50.000000 * adjustScaleY)
      doc.scale(0.100000 * adjustScaleX, -0.100000 * adjustScaleY)
    } else {
      doc.addPage()
      doc.translate(50.000000, 50.0 + 50.000000 * adjustScaleY)
      doc.scale(0.100000 * adjustScaleX, -0.100000 * adjustScaleY)
    }
    page.forEach((line) => {
      line.split('').forEach((character) => {
        if (symbols.includes(character) && character !== ' ') {
          const symb = svg[symbols.indexOf(character)][randInt(6)]
          symb.children.forEach((element) => {
            if (element.tagName === 'path') {
              const path = element.properties.d.replace(/\n/g, ' ')
              doc.path(path).fill(symb.properties.fill)
            }
          })
        }
        doc.translate(180, 0)
      })
      doc.translate(-180 * width, -500)
    })
  })
  doc.end()
  return doc
}

function generatePdf (str, ruled, width) {
  let doc
  str.forEach((page) => {
    if (typeof (doc) === 'undefined') {
      doc = new Pdfkit({
        size: [2480, 3508]
      })
    } else {
      doc.addPage()
    }
    let y = 50
    page.forEach((line) => {
      let x = 50
      line.split('').forEach((character) => {
        if (symbols.includes(character)) {
          doc.image(dataset[symbols.indexOf(
            character
          )][randInt(6)],
          x, y, {
            width: 2380 / width,
            height: 3408 / width
          })
        } else {
          doc.image(dataset[symbols.indexOf(
            ' '
          )][randInt(6)], x, y, {
            width: 2380 / width,
            height: 3408 / width
          })
        }
        if (ruled) {
          doc.image(dataset[symbols.indexOf(
            'margin'
          )][randInt(6)],
          x, y, {
            width: 2380 / width,
            height: 3408 / width
          })
        }
        x += 2380 / width
      })
      y += 3408 / width
    })
  })
  doc.end()
  return doc
}
async function main (rawText = '', optionalArgs = {}) {
  if (!checkArgType(rawText, optionalArgs)) {
    return Promise.reject(Object.assign(new Error('Invalid arguments!'), {}))
  } else {
    const outputType = optionalArgs.outputtype || 'pdf'
    const ruled = optionalArgs.ruled || false
    const vector = optionalArgs.vector || false
    if (!isArgValid(outputType)) {
      return Promise.reject(Object.assign(new Error(
          `Invalid output type "${outputType}"!`
      ), {
        supportedOutputTypes: supportedOutputTypes.concat([
          'pdf'
        ]),
        default: 'pdf'
      }))
    } else {
      const [str, width] = processText(rawText)
      if (vector) {
        return vectorPdf(str, ruled, width)
      }
      if (outputType === 'pdf') {
        return generatePdf(str, ruled, width)
      }
      if (typeof (jimpObjects) === 'undefined') {
        const resolvedPromises = await Promise.all(
          jimpObjectPromises
        )
        jimpObjects = {}
        for (let i = 0; i < symbols.length; i += 1) {
          jimpObjects[i] = []
          for (let j = 0; j < 6; j += 1) {
            jimpObjects[i].push(resolvedPromises[6 * i + j])
          }
        }
      }
      const imageArray = generateImageArray(str, ruled, width)
      return generateImages(imageArray, outputType)
    }
  }
}
module.exports = main
