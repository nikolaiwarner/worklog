#!/usr/bin/env node
var { homedir } = require('os')
var moment = require('moment')
var fs = require('fs')
var mkdirp = require('mkdirp')
var minimist = require('minimist')
var open = require('open')
var path = require('path')
var args = minimist(process.argv.slice(2))
var yaml = require('js-yaml')

var usage = `Usage

  worklog hello

  Options:
    --date -d
    --edit -e
    --todo -t
    --week -w
    --yesterday -y
`

var HOME_DIR = homedir()
var DATA_DIR = path.join(HOME_DIR, '.worklog', 'logs')

mkdirp.sync(DATA_DIR)

var dateString = args.date || args.d || formatDate(new Date())

if (args.help || args.h) {
  console.log(usage)
} else if (args.new) {
  newDay(dateString)
} else if (args._.length) {
  var message = args._.join(' ')
  if (message.toLowerCase().startsWith('todo ')) {
    addLine(dateString, 'todo', message.substr(5))
  } else {
    addLine(dateString, 'actions', message)
  }
} else if (args.add || args.a) {
  addLine(dateString, 'actions', args.add)
} else if (args.todo || args.t) {
  addLine(dateString, 'todo', args.add)
} else if (args.edit || args.e) {
  editFile(dateString)
} else if (args.week || args.w) {
  showWeek(dateString)
} else if (args.date || args.d) {
  showDay(args.date)
} else if (args.today) {
  showDay()
} else if (args.yesterday || args.y) {
  dateString = formatDate(moment().subtract(1, 'day'))
  showDay(dateString)
} else {
  showDay()
}

function addLine (dateString, section, message) {
  section = section || 'actions'
  var data = getDay(dateString)
  data[section] = data[section] || []
  data[section].push(message)
  saveFile(dateString, data)
  showDay(dateString)
}

function filenameFromDateString (dateString) {
  return DATA_DIR + '/' + dateString + '.yml'
}

function formatDate (date) {
  return moment(date).format('YYYY-MM-DD')
}

function newDay (dateString) {
  var data = {
    actions: [],
    date: dateString
  }
  saveFile(dateString, data)
  return data
}

function editFile (dateString) {
  var filename = filenameFromDateString(dateString)
  open(filename)
}

function getDay (dateString) {
  var filename = filenameFromDateString(dateString)
  if (!fs.existsSync(filename)) {
    return newDay(dateString)
  }
  return loadFile(dateString)
}

function showDay (dateString) {
  var date = moment(dateString)
  var data = getDay(formatDate(dateString))
  var dateLine = '\n# ' + date.format('YYYY-MM-DD - dddd')
  if (date.isSame(moment(), 'day')) {
    dateLine = dateLine + ' - TODAY'
  }
  console.log(dateLine)
  console.log('- Log:')
  if (data.actions && data.actions.length) {
    data.actions.forEach(function (action) {
      if (typeof action === 'object') {
        action = JSON.stringify(action)
        console.log('  - ' + action)
      } else {
        console.log('  - ' + action)
      }
    })
  }
  if (data.todo && data.todo.length) {
    console.log('- Todo:')
    data.todo.forEach(function (action) {
      console.log('  - ' + action)
    })
  }
}

function showWeek (dateString) {
  for (let index = 7; index >= 0; index--) {
    var date = moment(dateString).subtract(index, 'day')
    var data = getDay(formatDate(date))
    console.log('\n# ' + moment(data.date).format('YYYY-MM-DD - dddd'))
    if (data.actions && data.actions.length) {
      console.log('- Log:')
      if (data.actions && data.actions.length) {
        data.actions.forEach(function (action) {
          console.log('  - ' + action)
        })
      }
    }
    if (data.todo && data.todo.length) {
      console.log('- Todo:')
      data.todo.forEach(function (action) {
        console.log('  - ' + action)
      })
    }
    if ((!data.actions || !data.actions.length) && (!data.todo || !data.todo.length)) {
      console.log('- empty')
    }
  }
}

function loadFile (dateString) {
  try {
    var file = yaml.safeLoad(fs.readFileSync(filenameFromDateString(dateString), 'utf8'))
    return file
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

function saveFile (dateString, data) {
  try {
    if (!data.actions) { data.action = [] }
    let yamlData = yaml.safeDump(data, {
      sortKeys: true
    })
    fs.writeFileSync(filenameFromDateString(dateString), yamlData, 'utf8', function (err) {
      if (err) {
        return console.log(err)
      }
    })
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}
