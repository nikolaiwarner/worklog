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

var usage = `
  worklog

  Version: 1.0.1

  Usage:
  $ worklog made a treasure
  $ worklog todo find a nice cave
  $ worklog --done 0

  Options:
    --date -d
    --edit -e
    --todo -t
    --week -w
    --yesterday -y
    --tomorrow
    --procrastinate -p --to date
`

var HOME_DIR = homedir()
var DATA_DIR = path.join(HOME_DIR, '.worklog', 'logs')

mkdirp.sync(DATA_DIR)

var dateString = args.date || args.d || formatDate(new Date())

// console.log(dateString)
// console.log(args)

if (args.help || args.h || args.v) {
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
  addLine(dateString, 'actions', (args.add || args.a))
} else if (args.remove !== undefined || args.rm !== undefined || args.r !== undefined) {
  removeAction({
    dateString,
    index: (args.remove || args.rm || args.r),
    isTodo: !!(args.todo || args.t)
  })
} else if (args.todo || args.t) {
  addLine(dateString, 'todo', args.add)
} else if (args.done !== undefined) {
  markTodoDone(dateString, args.done)
} else if (args.edit || args.e) {
  editFile(dateString)
} else if (args.week || args.w) {
  showWeek(dateString)
} else if (args.today) {
  showDay(formatDate(new Date()))
} else if (args.tomorrow) {
  dateString = formatDate(moment().add(1, 'day'))
  showDay(dateString)
} else if (args.yesterday || args.y) {
  dateString = formatDate(moment().subtract(1, 'day'))
  showDay(dateString)
} else if (args.procrastinate || args.p) {
  procrastinate(dateString, args.to)
} else {
  console.log('Use -h or --help for help')
  showDay(dateString)
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
  if (!fs.existsSync(filename)) {
    newDay(dateString)
  }
  open(filename)
}

function getDay (dateString) {
  var filename = filenameFromDateString(dateString)
  if (!fs.existsSync(filename)) {
    return newDay(dateString)
  }
  return loadFile(dateString)
}

// Items with more `priorityString` with be ordered first!
function sortByPriority (items, priorityString) {
  priorityString = priorityString || '!'
  var regex = new RegExp(priorityString, 'g')
  return items.sort(function (a, b) {
    return (b.match(regex) || []).length - (a.match(regex) || []).length
  })
}

function renderActionLine (index, action) {
  console.log(`  ${index}: ` + action)
}

function showDay (dateString) {
  var date = moment(dateString)
  var data = getDay(formatDate(dateString))
  var dateLine = '\n# ' + date.format('YYYY-MM-DD - dddd')
  if (date.isSame(moment(), 'day')) {
    dateLine = dateLine + ' - TODAY'
  }
  if (date.isSame(moment().add(1, 'day'), 'day')) {
    dateLine = dateLine + ' - TOMORROW'
  }
  console.log(dateLine)
  console.log('- Done:')
  if (data.actions && data.actions.length) {
    data.actions.forEach(function (action, index) {
      if (typeof action === 'object') {
        action = JSON.stringify(action)
        renderActionLine(index, action)
      } else {
        renderActionLine(index, action)
      }
    })
  }
  if (data.todo && data.todo.length) {
    console.log('- Todo:')
    sortByPriority(data.todo).forEach(function (action, index) {
      renderActionLine(index, action)
    })
  }
}

function showWeek (dateString) {
  for (let index = 7; index >= 0; index--) {
    var date = moment(dateString).subtract(index, 'day')
    var data = getDay(formatDate(date))
    console.log('\n# ' + moment(data.date).format('YYYY-MM-DD - dddd'))
    if (data.actions && data.actions.length) {
      console.log('- Done:')
      if (data.actions && data.actions.length) {
        data.actions.forEach(function (action, index) {
          renderActionLine(index, action)
        })
      }
    }
    if (data.todo && data.todo.length) {
      console.log('- Todo:')
      data.todo.forEach(function (action, index) {
        renderActionLine(index, action)
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
    if (data.todo) {
      data.todo = sortByPriority(data.todo)
    }
    const yamlData = yaml.safeDump(data, {
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

// Move a day's todo to another day, defaulting to tomorrow
function procrastinate (dateString, futureDateString) {
  // Proper procrastination requires skipping weekends
  futureDateString = futureDateString || dateString
  if (moment(dateString).day() === 5) {
    futureDateString = formatDate(moment(dateString).add(3, 'day'))
  } else {
    futureDateString = formatDate(moment(dateString).add(1, 'day'))
  }
  var futureDay = getDay(futureDateString)
  var day = getDay(dateString)
  if (day.todo) {
    futureDay.todo = futureDay.todo || []
    day.todo.forEach(function (item) {
      futureDay.todo.push(item)
    })
    saveFile(futureDateString, futureDay)
    delete day.todo
    saveFile(dateString, day)
  }
  showDay(dateString)
  showDay(futureDateString)
}

function markTodoDone (dateString, index) {
  var day = getDay(dateString)
  if (day.todo && day.todo[index] !== undefined) {
    day.actions.push(day.todo[index])
    day.todo.splice(index, 1)
    saveFile(dateString, day)
    showDay(dateString)
  } else {
    console.log('>>> Todo not found')
  }
}

function removeAction ({ dateString, index, isTodo }) {
  var day = getDay(dateString)
  if (isTodo) {
    if (day.todo && day.todo[index]) {
      day.todo.splice(index, 1)
      saveFile(dateString, day)
      showDay(dateString)
    } else {
      console.log('>>> Not found')
    }
  } else {
    if (day.actions && day.actions[index]) {
      day.actions.splice(index, 1)
      saveFile(dateString, day)
      showDay(dateString)
    } else {
      console.log('>>> Not found')
    }
  }
}
