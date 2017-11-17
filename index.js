const Bacon = require('baconjs')
const debug = require('debug')('signalk-simple-notifications')

module.exports = function(app) {
  var plugin = {}
  var unsubscribes = []

  plugin.id = "simple-notifications"
  plugin.name = "Simple Notifications"
  plugin.description = "Signal K server plugin to setup notifications"

  plugin.schema = {
    type: "object",
    properties: {
      paths: {
        type: "array",
        title: " ",
        "default": defaultNotification,
        items: {
          title: "Notifications",
          type: "object",
          required: ["key", "name"],
          properties: {
            "enabled": {
              title: "Enabled",
              type: "boolean",
              default: true
            },
            "key": {
              title: "SignalK Path",
              type: "string",
              default: ""
            },
            "name": {
              title: "Name",
              description: "This will be used in the message of the notification",
              type: "string",
              default: ""
            },
            "thresholds": {
              "type": "array",
              "title": " ",
              "description": "Add one or more alarm ",
              "items": {
                "type": "object",
                "title": "Alarm",
                "required": ["state", "test", "value"],
                "properties": {
                  "test": {
                    "id": "test",
                    "type": "string",
                    "title": "Test",
                    "description": "The type of comparison",
                    "name": "test",
                    "enum": ["lessthan", "greaterthan"]
                  },
                  
                  "value": {
                    "id": "value",
                    "type": "number",
                    "title": "Value",
                    "description": "The value to alarm on",
                    "name": "value",
                  },

                  "state": {
                    "type": "string",
                    "title": "Alarm State",
                    "description": "The alarm state when the value is in this zone.",
                    "default": "normal",
                    "enum": ["normal", "alert", "warn", "alarm", "emergency"]
                  },

                  "visual": {
                    title: "Visual",
                    type: "boolean",
                    default: true
                  },
                  
                  "sound": {
                    title: "Sound",
                    type: "boolean",
                    default: true
                  },
                }
              }
            }
          }
        }
      }
    }
  }

  plugin.start = function(options) {
    unsubscribes = (options.paths || []).reduce((acc, {
      key,
      enabled,
      name,
      thresholds,
    }) => {
      if(enabled) {
        var stream = app.streambundle.getSelfStream(key)
        const tests = thresholds.map((alarm, i) => {

          if ( alarm.test == 'lessthan' )
          {
            return value => value < alarm.value
          }
          else
          {
            return value => value > alarm.value
          }
        })
        acc.push(stream.map(value => {
          return tests.findIndex(test => test(value))
        }).skipDuplicates().onValue(alarmIndex => {
          sendNotificationUpdate(key, name, alarmIndex, thresholds)
        }))
      }
      return acc
    }, [])
    return true
  }

  plugin.stop = function() {
    unsubscribes.forEach(f => f())
    unsubscribes = []
  }

  function sendNotificationUpdate(key, name, alarmIndex, thresholds) {
    var value = null
    if(alarmIndex >= 0) {
      const alarm = thresholds[alarmIndex]
      value = {
        state: alarm.state,
        method: [],
        timestamp: (new Date()).toISOString()
      }
      if ( alarm.visual )
      {
        value.method.push("visual")
      }
      if ( alarm.sound )
      {
        value.method.push("sound")
      }
      var test = alarm.test == 'lessthan' ? 'less than' : 'more than';
      value["message"] = `The ${name} is ${test} ${alarm.value}`
    }
    else
    {
      value = {
        state: "normal",
        timestamp: (new Date()).toISOString(),
        message: `The ${name} is normal`
      }
    }
    const delta = {
      context: "vessels." + app.selfId,
      updates: [
        {
          source: {
            label: "self.notificationhandler"
          },
          values: [{
            path: "notifications." + key,
            value: value
          }]
        }
      ]
    }
    debug("delta: " + JSON.stringify(delta))
    app.signalk.addDelta(delta)
  }

  return plugin
}


const defaultNotification = [
  {
    "enabled": false,
    "key": "environment.depth.belowSurface",
    "name": "depth",
    "thresholds": [
      {
        "test": "lessthan",
        "value": 1.8288,
        "state": "emergency",
        "visual": true,
        "sound": true,
      }
    ]
  },
  {
    "enabled": false,
    "key": "electrical.batteries.0.voltage",
    "name": "battery",
    "thresholds": [
      {
        "test": "lessthan",
        "value": 11.5,
        "state": "alert",
        "visual": true,
        "sound": true,
      },
      {
        "test": "greaterthan",
        "value": 14.5,
        "state": "alert",
        "visual": true,
        "sound": true,
      }
    ]
  },
  {
    "enabled": false,
    "key": "propulsion.port.temperature",
    "name": "enging temperature",
    "thresholds": [
      {
        "test": "greaterthan",
        "value": 327.594,
        "state": "alert",
        "visual": true,
        "sound": true,
      }
    ]
  }
]
